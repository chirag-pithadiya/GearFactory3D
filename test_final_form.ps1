# ==========================================================================
# Gear Factory 3D — Final Gearbox Form Redesign Verification Suite
# ==========================================================================

$ErrorActionPreference = "Stop"
$port = 8088
$wsUrl = $null
$chromeProcess = $null
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\f5312182-ac41-491c-b05c-546e6a127f00"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - FINAL GEARBOX FORM REDESIGN VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Headless Chrome for CDP Automation
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromeExe) {
    throw "Google Chrome executable not found."
}

$cdpPort = 9366
$tempUserData = Join-Path $env:TEMP "gear_form_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$targetUrl = "http://localhost:$port"

$chromeArgs = @(
    "--headless=new",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$tempUserData",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1920,1080",
    $targetUrl
)

Write-Host "Launching Chrome headless on debugging port $cdpPort..." -ForegroundColor Yellow
$chromeProcess = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -PassThru

try {
    Start-Sleep -Seconds 3

    # Query Chrome Debugging targets
    $targetsResponse = Invoke-RestMethod -Uri "http://localhost:$cdpPort/json"
    $pageTarget = $targetsResponse | Where-Object { $_.type -eq "page" -or $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $pageTarget) { $pageTarget = $targetsResponse[0] }

    $wsUrl = $pageTarget.webSocketDebuggerUrl
    Write-Host "Connected to WebSocket: $wsUrl" -ForegroundColor Green

    # WebSocket setup
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $ws.ConnectAsync([System.Uri]$wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $cmdId = 1

    function Send-CDP($method, $params = @{}) {
        $script:cmdId++
        $thisId = $script:cmdId
        $msg = @{
            id = $thisId
            method = $method
            params = $params
        } | ConvertTo-Json -Depth 10 -Compress

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $buf = New-Object byte[] 2097152
            $ms = New-Object System.IO.MemoryStream
            do {
                $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
                $res = $ws.ReceiveAsync($recvSeg, [System.Threading.CancellationToken]::None).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $parsed = $raw | ConvertFrom-Json
            if ($parsed.method -eq "Runtime.exceptionThrown") {
                Write-Host "JS EXCEPTION: $($parsed.params.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            }
            if ($parsed.id -eq $thisId) {
                return $parsed
            }
        }
    }

    function Eval-JS($expr) {
        $res = Send-CDP "Runtime.evaluate" @{
            expression = $expr
            returnByValue = $true
            awaitPromise = $true
        }
        if ($res.result.exceptionDetails) {
            Write-Host "JS Error: $($res.result.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
        }
        return $res.result.result.value
    }

    function Dismiss-All-Modals {
        Eval-JS @"
        (() => {
            const modals = document.querySelectorAll('.modal-backdrop');
            modals.forEach(m => {
                m.style.display = 'none';
                m.classList.remove('active');
            });
        })()
"@ | Out-Null
    }

    function Capture-Screenshot($filePath) {
        Dismiss-All-Modals
        Start-Sleep -Milliseconds 300
        $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $bytes = [System.Convert]::FromBase64String($res.result.data)
        [System.IO.File]::WriteAllBytes($filePath, $bytes)
        Write-Host "Saved screenshot: $filePath" -ForegroundColor Green
    }

    # Enable runtime & page events
    Send-CDP "Runtime.enable" | Out-Null
    Send-CDP "Page.enable" | Out-Null

    Write-Host "Waiting for page ready..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 30; $i++) {
        $ready = Eval-JS "typeof window.gearFactory !== 'undefined' && !!window.gearFactory.scene"
        if ($ready -eq $true) { break }
        Start-Sleep -Milliseconds 400
    }

    # Set local storage & dismiss all initial dialogs
    Eval-JS @"
    (() => {
        localStorage.setItem('gear_factory_has_seen_welcome', 'true');
        localStorage.setItem('gearfactory_welcomed', 'true');
        localStorage.setItem('gearfactory_highest_unlocked', '50');
    })()
"@ | Out-Null
    Dismiss-All-Modals
    Start-Sleep -Seconds 1

    # 1. Level 1: Place gears (20T and 40T), verify ratio, start simulation
    Write-Host "`n--- Testing Level 1 (Running) ---" -ForegroundColor Cyan
    $metrics = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(1, true);
        gf.placeInputGear(20);
        gf.placeOutputGear(40);
        gf.state.isRunning = true;

        const telem = (gf && gf.debug) ? gf.debug : {};
        const casing = gf ? gf.gearboxCasing : null;
        let meshCount = 0;
        let nonRaycastCount = 0;
        let hasWindow = false;
        if (casing) {
            casing.traverse((c) => {
                if (c.isMesh) {
                    meshCount++;
                    if (c.raycast && c.raycast.toString().includes('{}')) nonRaycastCount++;
                    if (c.material && c.material.transparent && c.material.opacity > 0.05) hasWindow = true;
                }
            });
        }
        const dims = telem.casingInternalDimensions || {};
        const ratio = dims.heightY > 0 ? (dims.lengthZ / dims.heightY) : 0;

        return {
            casingMeshCount: meshCount,
            nonRaycastCount: nonRaycastCount,
            hasWindow: hasWindow,
            dims: dims,
            ratio: ratio,
            shaftY: telem.inputGearCenter ? telem.inputGearCenter.y : 0,
            posZInput: telem.inputGearCenter ? telem.inputGearCenter.z : 0,
            posZOutput: telem.outputGearCenter ? telem.outputGearCenter.z : 0,
            inputRPM: gf.state.currentInputRPM,
            outputRPM: gf.state.currentOutputRPM
        };
    })()
"@

    Write-Host "Casing Total Meshes: $($metrics.casingMeshCount)" -ForegroundColor White
    Write-Host "Raycast-Bypassed Meshes: $($metrics.nonRaycastCount)" -ForegroundColor White
    Write-Host "Inspection Window Present: $($metrics.hasWindow)" -ForegroundColor White
    Write-Host "Internal Dimensions: WidthX=$($metrics.dims.widthX), HeightY=$($metrics.dims.heightY), LengthZ=$($metrics.dims.lengthZ)" -ForegroundColor White
    Write-Host "Horizontal Width:Height Ratio: $([Math]::Round($metrics.ratio, 3))" -ForegroundColor $(if ($metrics.ratio -ge 1.45 -and $metrics.ratio -le 1.85) { "Green" } else { "Red" })
    Write-Host "Shaft Elevation Y: $($metrics.shaftY)" -ForegroundColor White
    Write-Host "Shaft Z Positions: InputZ=$($metrics.posZInput), OutputZ=$($metrics.posZOutput)" -ForegroundColor White
    Write-Host "Gears Rotation: InRPM=$($metrics.inputRPM), OutRPM=$($metrics.outputRPM)" -ForegroundColor Green

    Start-Sleep -Seconds 1
    $lvl1Shot = Join-Path $artifactDir "final_redesign_level1_running.png"
    Capture-Screenshot $lvl1Shot

    # 2. Test Level 3
    Write-Host "`n--- Testing Level 3 ---" -ForegroundColor Cyan
    Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(3, true);
    })()
"@ | Out-Null
    Dismiss-All-Modals
    Start-Sleep -Seconds 1

    $lvl3Metrics = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        const telem = (gf && gf.debug) ? gf.debug : {};
        const dims = telem.casingInternalDimensions || {};
        const ratio = dims.heightY > 0 ? (dims.lengthZ / dims.heightY) : 0;
        return { dims: dims, ratio: ratio };
    })()
"@
    Write-Host "Level 3 Ratio: $([Math]::Round($lvl3Metrics.ratio, 3)) (Dims: $($lvl3Metrics.dims.lengthZ) x $($lvl3Metrics.dims.heightY))" -ForegroundColor $(if ($lvl3Metrics.ratio -ge 1.45 -and $lvl3Metrics.ratio -le 1.85) { "Green" } else { "Red" })
    $lvl3Shot = Join-Path $artifactDir "final_redesign_level3.png"
    Capture-Screenshot $lvl3Shot

    # 3. Test Level 20
    Write-Host "`n--- Testing Level 20 ---" -ForegroundColor Cyan
    Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(20, true);
    })()
"@ | Out-Null
    Dismiss-All-Modals
    Start-Sleep -Seconds 1

    $lvl20Metrics = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        const telem = (gf && gf.debug) ? gf.debug : {};
        const dims = telem.casingInternalDimensions || {};
        const ratio = dims.heightY > 0 ? (dims.lengthZ / dims.heightY) : 0;
        return { dims: dims, ratio: ratio };
    })()
"@
    Write-Host "Level 20 Ratio: $([Math]::Round($lvl20Metrics.ratio, 3)) (Dims: $($lvl20Metrics.dims.lengthZ) x $($lvl20Metrics.dims.heightY))" -ForegroundColor $(if ($lvl20Metrics.ratio -ge 1.45 -and $lvl20Metrics.ratio -le 1.85) { "Green" } else { "Red" })
    $lvl20Shot = Join-Path $artifactDir "final_redesign_level20.png"
    Capture-Screenshot $lvl20Shot

    # 4. Test Level 50
    Write-Host "`n--- Testing Level 50 ---" -ForegroundColor Cyan
    Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(50, true);
    })()
"@ | Out-Null
    Dismiss-All-Modals
    Start-Sleep -Seconds 1

    $lvl50Metrics = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        const telem = (gf && gf.debug) ? gf.debug : {};
        const dims = telem.casingInternalDimensions || {};
        const ratio = dims.heightY > 0 ? (dims.lengthZ / dims.heightY) : 0;
        return { dims: dims, ratio: ratio };
    })()
"@
    Write-Host "Level 50 Ratio: $([Math]::Round($lvl50Metrics.ratio, 3)) (Dims: $($lvl50Metrics.dims.lengthZ) x $($lvl50Metrics.dims.heightY))" -ForegroundColor $(if ($lvl50Metrics.ratio -ge 1.45 -and $lvl50Metrics.ratio -le 1.85) { "Green" } else { "Red" })
    $lvl50Shot = Join-Path $artifactDir "final_redesign_level50.png"
    Capture-Screenshot $lvl50Shot

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " ALL 4 CLEAN SCREENSHOTS CAPTURED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempUserData) {
        Remove-Item -Path $tempUserData -Recurse -Force -ErrorAction SilentlyContinue
    }
}
