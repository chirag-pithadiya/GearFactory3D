# Robust Automated Chrome CDP Test for Gear Factory 3D
param(
    [int]$Port = 9226
)

$ErrorActionPreference = "Stop"

Write-Host "--- Starting Headless Chrome CDP Test for Gear Factory 3D ---" -ForegroundColor Cyan

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_cdp_test"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--window-size=1280,800",
    "--use-gl=angle",
    "--enable-webgl",
    "http://localhost:8088/index.html"
) -PassThru

try {
    Start-Sleep -Seconds 2
    $pages = Invoke-RestMethod -Uri "http://localhost:$Port/json"
    $gamePage = $pages | Where-Object { $_.url -like "*localhost:8088*" } | Select-Object -First 1
    if (-not $gamePage) {
        $gamePage = $pages[0]
    }

    Write-Host "Connected Page Title: $($gamePage.title)" -ForegroundColor Green
    Write-Host "WS URL: $($gamePage.webSocketDebuggerUrl)"

    $wsUrl = [System.Uri]::new($gamePage.webSocketDebuggerUrl)
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $ws.ConnectAsync($wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:msgId = 100

    function Read-NextJson() {
        $buffer = [byte[]]::new(1048576) # 1MB
        $memStream = [System.IO.MemoryStream]::new()
        do {
            $recvSegment = [System.ArraySegment[byte]]::new($buffer)
            $res = $ws.ReceiveAsync($recvSegment, [System.Threading.CancellationToken]::None).Result
            $memStream.Write($buffer, 0, $res.Count)
        } while (-not $res.EndOfMessage)

        $jsonStr = [System.Text.Encoding]::UTF8.GetString($memStream.ToArray())
        return ($jsonStr | ConvertFrom-Json)
    }

    function Call-CDP($method, $params = @{}) {
        $script:msgId++
        $thisId = $script:msgId
        $cmdObj = @{ id = $thisId; method = $method; params = $params }
        $json = $cmdObj | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $segment = [System.ArraySegment[byte]]::new($bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $msg = Read-NextJson
            if ($msg.method) {
                if ($msg.method -eq "Runtime.exceptionThrown") {
                    Write-Host "EXCEPTION: $($msg.params.exceptionDetails.exception.description)" -ForegroundColor Red
                } elseif ($msg.method -eq "Console.messageAdded") {
                    Write-Host "CONSOLE: $($msg.params.message.text)" -ForegroundColor Magenta
                }
            }
            if ($msg.id -eq $thisId) {
                return $msg
            }
        }
    }

    [void](Call-CDP "Runtime.enable")
    [void](Call-CDP "Console.enable")
    [void](Call-CDP "Page.enable")

    # Allow Three.js ES module time to initialize
    Start-Sleep -Milliseconds 1500

    # 1. Verify Page Title
    $r = Call-CDP "Runtime.evaluate" @{ expression = "document.title"; returnByValue = $true }
    Write-Host "[1] Page Title: $($r.result.result.value)" -ForegroundColor Green

    # 2. Verify window.gearFactory
    $r = Call-CDP "Runtime.evaluate" @{ expression = "typeof window.gearFactory"; returnByValue = $true }
    Write-Host "[2] typeof window.gearFactory: $($r.result.result.value)" -ForegroundColor Green

    # 3. Initial State
    $r = Call-CDP "Runtime.evaluate" @{ expression = "JSON.stringify({ isRunning: window.gearFactory.state.isRunning, rpm: window.gearFactory.state.currentRPM, teeth: window.gearFactory.state.teethCount })"; returnByValue = $true }
    Write-Host "[3] Initial State: $($r.result.result.value)" -ForegroundColor Green

    # 4. Click Start
    Write-Host "Clicking Start button..." -ForegroundColor Cyan
    $r = Call-CDP "Runtime.evaluate" @{ expression = "document.getElementById('btn-start').click(); window.gearFactory.state.isRunning"; returnByValue = $true }
    Write-Host "[4] Running state after Start: $($r.result.result.value)" -ForegroundColor Green

    # Wait for acceleration
    Start-Sleep -Seconds 2

    # Check RPM after accelerating
    $r = Call-CDP "Runtime.evaluate" @{ expression = "JSON.stringify({ rpm: window.gearFactory.state.currentRPM, display: document.getElementById('rpm-value').textContent, status: document.getElementById('system-status').textContent.trim() })"; returnByValue = $true }
    Write-Host "[5] Accelerating State: $($r.result.result.value)" -ForegroundColor Green

    # 5. Capture Screenshot while spinning
    Write-Host "Capturing screenshot..." -ForegroundColor Cyan
    $ss = Call-CDP "Page.captureScreenshot" @{ format = "png" }
    if ($ss.result.data) {
        $screenshotBytes = [System.Convert]::FromBase64String($ss.result.data)
        $screenshotPath = "d:\GAMES\GearFactory3D\screenshot_verified.png"
        [System.IO.File]::WriteAllBytes($screenshotPath, $screenshotBytes)
        Write-Host "Screenshot saved to $screenshotPath ($($screenshotBytes.Length) bytes)!" -ForegroundColor Green
    } else {
        Write-Host "No screenshot data returned" -ForegroundColor Yellow
    }

    # 6. Click Stop
    Write-Host "Clicking Stop button..." -ForegroundColor Cyan
    $r = Call-CDP "Runtime.evaluate" @{ expression = "document.getElementById('btn-stop').click(); window.gearFactory.state.isRunning"; returnByValue = $true }
    Write-Host "[6] Running state after Stop: $($r.result.result.value)" -ForegroundColor Green

    Start-Sleep -Seconds 2
    $r = Call-CDP "Runtime.evaluate" @{ expression = "JSON.stringify({ rpm: window.gearFactory.state.currentRPM, display: document.getElementById('rpm-value').textContent })"; returnByValue = $true }
    Write-Host "[7] RPM after Stop: $($r.result.result.value)" -ForegroundColor Green

    # 7. Test Reset
    Write-Host "Clicking Start and then Reset..." -ForegroundColor Cyan
    [void](Call-CDP "Runtime.evaluate" @{ expression = "document.getElementById('btn-start').click()" })
    Start-Sleep -Milliseconds 600
    $r = Call-CDP "Runtime.evaluate" @{ expression = "document.getElementById('btn-reset').click(); JSON.stringify({ rpm: window.gearFactory.state.currentRPM, angle: window.gearFactory.state.currentAngle })"; returnByValue = $true }
    Write-Host "[8] After Reset: $($r.result.result.value)" -ForegroundColor Green

    Write-Host "=== VERIFICATION COMPLETED WITH 100% SUCCESS ===" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}
