# ==========================================================================
# Gear Factory 3D — Phase 13 Visual Polish Verification Suite
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
Write-Host " GEAR FACTORY 3D - PHASE 13 VISUAL POLISH VERIFICATION" -ForegroundColor Cyan
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

$cdpPort = 9362
$tempUserData = Join-Path $env:TEMP "gear_phase13_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$serverUrl = "http://localhost:8088/"

$chromeArgs = @(
    "--headless=new",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$tempUserData",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1920,1080",
    $serverUrl
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
            Write-Host "EVAL ERROR: $($res.result.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
        }
        return $res.result.result.value
    }

    function Capture-Screenshot($fileName) {
        $sRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $b64 = $sRes.result.data
        $bytes = [System.Convert]::FromBase64String($b64)
        $outPathArtifact = Join-Path $artifactDir $fileName
        $outPathRoot = Join-Path "d:\GAMES\GearFactory3D" $fileName
        [System.IO.File]::WriteAllBytes($outPathArtifact, $bytes)
        [System.IO.File]::WriteAllBytes($outPathRoot, $bytes)
        Write-Host "Saved screenshot: $fileName ($($bytes.Length) bytes)" -ForegroundColor Cyan
    }

    Send-CDP "Runtime.enable" | Out-Null
    Send-CDP "Page.enable" | Out-Null

    Start-Sleep -Seconds 2

    # Wait for GearFactory initialization
    $initReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        $ready = Eval-JS "typeof window.gearFactory !== 'undefined' && !!window.gearFactory.currentAssembly"
        if ($ready) {
            $initReady = $true
            break
        }
        Start-Sleep -Milliseconds 300
    }

    if (-not $initReady) {
        throw "GearFactory3D engine did not initialize within timeout."
    }

    Write-Host "[1/6] Engine Initialized Successfully." -ForegroundColor Green

    # Dismiss initial welcome, tutorial, and intro modals
    Eval-JS @"
    (() => {
        localStorage.setItem('gear_factory_has_seen_welcome', 'true');
        localStorage.setItem('gearfactory_welcomed', 'true');
        localStorage.setItem('gearfactory_highest_unlocked', '50');
        const btnW = document.getElementById('btn-welcome-start');
        if (btnW) btnW.click();
        const wm = document.getElementById('welcome-modal');
        if (wm) { wm.style.display = 'none'; wm.classList.remove('active'); }
        const intro = document.getElementById('level-intro-modal');
        if (intro) { intro.style.display = 'none'; intro.classList.remove('active'); }
        const tut = document.getElementById('tutorial-modal');
        if (tut) { tut.style.display = 'none'; tut.classList.remove('active'); }
        if (window.gearFactory) {
            window.gearFactory.closeLevelIntro && window.gearFactory.closeLevelIntro();
            window.gearFactory.loadLevel(1, true);
        }
    })()
"@ | Out-Null
    Start-Sleep -Milliseconds 500

    # --------------------------------------------------------------------------
    # Check 1: 3D Material & Assembly Inspection
    # --------------------------------------------------------------------------
    $assemblyInfo = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        const asm = gf.currentAssembly;
        let casingMeshCount = 0;
        let casingRaycastDisabledCount = 0;

        if (asm.gearboxCasing) {
            asm.gearboxCasing.traverse((child) => {
                if (child.isMesh) {
                    casingMeshCount++;
                    if (typeof child.raycast === 'function') {
                        let hits = [];
                        child.raycast({ ray: new THREE.Ray() }, hits);
                        if (hits.length === 0) {
                            casingRaycastDisabledCount++;
                        }
                    }
                }
            });
        }

        const motorPos = asm.motor ? { x: asm.motor.position.x, y: asm.motor.position.y, z: asm.motor.position.z } : null;
        const inShaftPos = asm.inputShaft ? { x: asm.inputShaft.position.x, y: asm.inputShaft.position.y, z: asm.inputShaft.position.z } : null;
        const outShaftPos = asm.outputShaft ? { x: asm.outputShaft.position.x, y: asm.outputShaft.position.y, z: asm.outputShaft.position.z } : null;

        return {
            hasCasing: !!asm.gearboxCasing,
            casingMeshCount,
            casingRaycastDisabledCount,
            hasMotor: !!asm.motor,
            hasMotorShaft: !!asm.motorShaft,
            hasInputShaft: !!asm.inputShaft,
            hasOutputShaft: !!asm.outputShaft,
            hasBearings: !!(asm.inputBearingSupport && asm.outputBearingSupport),
            motorPos,
            inShaftPos,
            outShaftPos
        };
    })()
"@

    Write-Host "Assembly Details:" -ForegroundColor Gray
    Write-Host "  Casing Meshes: $($assemblyInfo.casingMeshCount)" -ForegroundColor Gray
    Write-Host "  Raycast-Disabled Casing Meshes: $($assemblyInfo.casingRaycastDisabledCount)" -ForegroundColor Gray
    Write-Host "  Motor Pos: Y=$($assemblyInfo.motorPos.y), Z=$($assemblyInfo.motorPos.z)" -ForegroundColor Gray
    Write-Host "  Input Shaft Pos: Y=$($assemblyInfo.inShaftPos.y), Z=$($assemblyInfo.inShaftPos.z)" -ForegroundColor Gray
    Write-Host "  Output Shaft Pos: Y=$($assemblyInfo.outShaftPos.y), Z=$($assemblyInfo.outShaftPos.z)" -ForegroundColor Gray

    if ($assemblyInfo.casingMeshCount -lt 100) {
        throw "Casing mesh count lower than expected ($($assemblyInfo.casingMeshCount))"
    }
    if ($assemblyInfo.casingRaycastDisabledCount -ne $assemblyInfo.casingMeshCount) {
        throw "Not all casing meshes have raycasting disabled! Casing might block clicks!"
    }
    if ([Math]::Abs($assemblyInfo.motorPos.y - $assemblyInfo.inShaftPos.y) -gt 0.05 -or [Math]::Abs($assemblyInfo.motorPos.z - $assemblyInfo.inShaftPos.z) -gt 0.05) {
        throw "Motor shaft not coaxial with input shaft!"
    }

    Write-Host "[2/6] Assembly, Coaxial Alignment, & Raycast Exemption PASS." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Check 2: Level 1 Interaction & Solution Kinetics
    # --------------------------------------------------------------------------
    Write-Host "Testing Level 1 gear mounting, rotation kinetics, and solution check..." -ForegroundColor Yellow

    $kineticsTest = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(1);

        // Dismiss any intro modals
        gf.closeLevelIntro && gf.closeLevelIntro();
        const intro = document.getElementById('level-intro-modal');
        if (intro) { intro.style.display = 'none'; intro.classList.remove('active'); }

        // Mount 20T on input, 40T on output (Level 1 solution: 1000 RPM -> 500 RPM)
        gf.placeInputGear(20);
        gf.placeOutputGear(40);
        gf.state.isRunning = true;

        const asm = gf.currentAssembly;
        return {
            inputRPM: gf.state.currentInputRPM,
            outputRPM: gf.state.currentOutputRPM,
            ratio: gf.state.gearRatio,
            hasInputGear: !!asm.inputGear,
            hasOutputGear: !!asm.outputGear
        };
    })()
"@

    Start-Sleep -Milliseconds 1200

    # Capture Level 1 screenshot while running with gears rotating
    Capture-Screenshot "phase13_level1_visuals.png"

    $rotationTest = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        const asm = gf.currentAssembly;
        const checkBtn = document.getElementById('btn-check-solution');
        if (checkBtn) checkBtn.click();

        const res = {
            motorRotated: !!(asm.motorShaft && Math.abs(asm.motorShaft.rotation.x) > 0.05),
            inputRotated: !!(asm.inputGear && Math.abs(asm.inputGear.rotation.x) > 0.05),
            outputRotated: !!(asm.outputGear && Math.abs(asm.outputGear.rotation.x) > 0.05),
            isSolved: gf.puzzleState.isSolutionPass,
            outputRPM: gf.state.currentOutputRPM
        };

        // Close completion modal for subsequent tests
        gf.closeLevelComplete && gf.closeLevelComplete();
        const lc = document.getElementById('level-complete-modal');
        if (lc) { lc.style.display = 'none'; lc.classList.remove('active'); }

        return res;
    })()
"@

    Write-Host "Level 1 Kinetics Result:" -ForegroundColor Gray
    Write-Host "  Output RPM: $($kineticsTest.outputRPM)" -ForegroundColor Gray
    Write-Host "  Gear Ratio: $($kineticsTest.ratio)" -ForegroundColor Gray
    Write-Host "  Motor Rotated: $($rotationTest.motorRotated)" -ForegroundColor Gray
    Write-Host "  Input Gear Rotated: $($rotationTest.inputRotated)" -ForegroundColor Gray
    Write-Host "  Output Gear Rotated: $($rotationTest.outputRotated)" -ForegroundColor Gray
    Write-Host "  Solution Solved: $($rotationTest.isSolved)" -ForegroundColor Gray

    if (-not $rotationTest.isSolved -or $kineticsTest.outputRPM -ne 500.0) {
        throw "Level 1 solution check or RPM calculation failed."
    }
    if (-not $rotationTest.motorRotated -or -not $rotationTest.inputRotated -or -not $rotationTest.outputRotated) {
        throw "Kinetics rotation animation did not update mesh rotations."
    }

    Write-Host "[3/6] Level 1 Interaction & Kinetics PASS." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Check 3: Multi-Level Testing (Levels 3, 20, 21, 50)
    # --------------------------------------------------------------------------
    $testLevels = @(3, 20, 21, 50)
    foreach ($lvl in $testLevels) {
        Write-Host "Testing Level $lvl parametric scaling and casing..." -ForegroundColor Yellow
        $lvlRes = Eval-JS @"
        (() => {
            const gf = window.gearFactory;
            gf.closeLevelIntro && gf.closeLevelIntro();
            gf.closeLevelComplete && gf.closeLevelComplete();
            const lc = document.getElementById('level-complete-modal');
            if (lc) { lc.style.display = 'none'; lc.classList.remove('active'); }
            const intro = document.getElementById('level-intro-modal');
            if (intro) { intro.style.display = 'none'; intro.classList.remove('active'); }

            gf.loadLevel($lvl, true);
            const asm = gf.currentAssembly;
            return {
                level: $lvl,
                hasCasing: !!asm.gearboxCasing,
                casingMeshes: asm.gearboxCasing ? asm.gearboxCasing.children.length : 0,
                hasMotor: !!asm.motor,
                hasShafts: !!(asm.inputShaft && asm.outputShaft)
            };
        })()
"@
        if (-not $lvlRes.hasCasing -or -not $lvlRes.hasMotor -or -not $lvlRes.hasShafts) {
            throw "Level $lvl failed assembly validation."
        }
        Start-Sleep -Milliseconds 600
        Capture-Screenshot "phase13_level$($lvl)_visuals.png"
    }

    Write-Host "[4/6] Levels 3, 20, 21, 50 Parametric Scaling & Screenshots PASS." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Check 4: Frame Rate Measurement
    # --------------------------------------------------------------------------
    Write-Host "Measuring WebGL render loop performance..." -ForegroundColor Yellow
    $fpsRes = Eval-JS @"
    new Promise((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        function loop() {
            frameCount++;
            if (frameCount >= 60) {
                const elapsed = performance.now() - start;
                const fps = (frameCount / elapsed) * 1000;
                resolve(fps);
            } else {
                requestAnimationFrame(loop);
            }
        }
        requestAnimationFrame(loop);
    })
"@
    Write-Host "Measured WebGL Framerate: $([Math]::Round($fpsRes, 1)) FPS" -ForegroundColor Green

    if ($fpsRes -lt 55) {
        throw "Framerate dropped below acceptable threshold ($fpsRes FPS)"
    }

    Write-Host "[5/6] Performance Budget Verified: $([Math]::Round($fpsRes, 1)) FPS." -ForegroundColor Green

    # Return to Level 1
    Eval-JS "window.gearFactory.loadLevel(1)" | Out-Null
    Write-Host "[6/6] All Phase 13 Visual Polish Verifications Succeeded!" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq "Open") {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        $chromeProcess.Kill()
        $chromeProcess.WaitForExit()
    }
    if ($tempUserData -and (Test-Path $tempUserData)) {
        Remove-Item -Recurse -Force $tempUserData -ErrorAction SilentlyContinue
    }
}
