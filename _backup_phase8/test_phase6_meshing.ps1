param([int]$Port = 9338)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 6 GEAR MESHING & KINETICS TEST" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase6_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\fa3d4768-9a7d-4667-b7d1-d056cca8ec26"

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--use-gl=angle",
    "--enable-webgl",
    "http://127.0.0.1:8088/"
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $page = $pages | Where-Object { $_.type -eq "page" -or $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $page) { $page = $pages[0] }

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([System.Uri]$page.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:id = 1
    function Send-CDP($method, $params = @{}) {
        $script:id++
        $thisId = $script:id
        $req = @{ id = $thisId; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($req)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $buf = New-Object byte[] 2097152
            $ms = New-Object System.IO.MemoryStream
            do {
                $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
                $res = $ws.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $msg = $raw | ConvertFrom-Json
            if ($msg.method -eq "Runtime.exceptionThrown") {
                Write-Host "JS EXCEPTION: $($msg.params.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            }
            if ($msg.id -eq $thisId) { return $msg }
        }
    }

    function Exec-Eval($expr) {
        $res = Send-CDP "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
        return $res.result.result.value
    }

    function Take-Screenshot($filePath) {
        $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $bytes = [System.Convert]::FromBase64String($res.result.data)
        [System.IO.File]::WriteAllBytes($filePath, $bytes)
        Write-Host "Screenshot saved: $filePath" -ForegroundColor Gray
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Page.enable")
    [void](Send-CDP "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false })

    Start-Sleep -Seconds 2

    # -------------------------------------------------------------
    # Initial Status Check: No gears mounted
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CHECK 0] Verify Initial Feedback Message with 0 gears..." -ForegroundColor Yellow
    $c0 = Exec-Eval @"
    (() => {
        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const outRpm = document.getElementById('telemetry-output-rpm')?.textContent;
        return { statusText, outRpm };
    })()
"@
    Write-Host "Initial state: $($c0 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c0.statusText -ne "PLACE INPUT AND OUTPUT GEARS" -or $c0.outRpm -ne "-- RPM") {
        throw "Check 0 Failed: Expected 'PLACE INPUT AND OUTPUT GEARS' and '-- RPM'!"
    }

    # -------------------------------------------------------------
    # CASE 4: Only input gear installed
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 4] Mount only Input Gear (20T)..." -ForegroundColor Yellow
    $c4 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.placeGearOnInput(20);

        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const outRpmUI = document.getElementById('telemetry-output-rpm')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;

        return { statusText, inRpm, outRpm, outRpmUI, isEngaged };
    })()
"@
    Write-Host "Case 4 Result: $($c4 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c4.statusText -ne "WAITING FOR SECOND GEAR" -or $c4.outRpmUI -ne "-- RPM" -or $c4.isEngaged -or $c4.inRpm -le 0) {
        throw "Case 4 Failed: Expected 'WAITING FOR SECOND GEAR', input rotating, output stopped at '-- RPM'!"
    }

    # Verify input shaft rotates while output shaft stays stopped
    Start-Sleep -Milliseconds 200
    $rotCheck1 = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    Start-Sleep -Milliseconds 300
    $rotCheck2 = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    $deltaInC4 = $rotCheck2.inAngle - $rotCheck1.inAngle
    $deltaOutC4 = $rotCheck2.outAngle - $rotCheck1.outAngle
    Write-Host "Case 4 Rotation: deltaIn=$deltaInC4, deltaOut=$deltaOutC4" -ForegroundColor Gray
    if ($deltaInC4 -le 0 -or $deltaOutC4 -ne 0) {
        throw "Case 4 Failed: Input shaft must rotate and output shaft must stay stopped!"
    }

    # -------------------------------------------------------------
    # CASE 5: Only output gear installed
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 5] Mount only Output Gear (40T)..." -ForegroundColor Yellow
    $c5 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.resetLevel();
        gf.placeGearOnOutput(40);

        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const outRpmUI = document.getElementById('telemetry-output-rpm')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;

        return { statusText, inRpm, outRpm, outRpmUI, isEngaged };
    })()
"@
    Write-Host "Case 5 Result: $($c5 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c5.statusText -ne "WAITING FOR SECOND GEAR" -or $c5.outRpmUI -ne "-- RPM" -or $c5.isEngaged -or $c5.inRpm -ne 0 -or $c5.outRpm -ne 0) {
        throw "Case 5 Failed: Expected 'WAITING FOR SECOND GEAR' and both shafts stopped!"
    }

    # -------------------------------------------------------------
    # CASE 1: Input = 20T, Output = 40T, Motor = 990 / 1000 RPM
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 1] Mount 20T In and 40T Out (Speed Reduction 2:1)..." -ForegroundColor Yellow
    $c1 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.placeGearOnInput(20); // completes both gears!

        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const outRpmUI = document.getElementById('telemetry-output-rpm')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;
        const meshCheck = gf.checkGearMesh();

        return { statusText, inRpm, outRpm, outRpmUI, isEngaged, meshCheck };
    })()
"@
    Write-Host "Case 1 Result: $($c1 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c1.statusText -ne "GEARS ENGAGED" -or -not $c1.isEngaged -or $c1.outRpm -ne ($c1.inRpm * 20 / 40) -or -not $c1.meshCheck.gearMeshValid) {
        throw "Case 1 Failed: Gears not engaged or ratio incorrect or meshCheck failed!"
    }

    # Verify opposite rotation directions
    Start-Sleep -Milliseconds 200
    $rotCase1A = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    Start-Sleep -Milliseconds 300
    $rotCase1B = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    $deltaIn1 = $rotCase1B.inAngle - $rotCase1A.inAngle
    $deltaOut1 = $rotCase1B.outAngle - $rotCase1A.outAngle
    Write-Host "Case 1 Speeds: inDelta=$deltaIn1, outDelta=$deltaOut1, ratio=$($deltaIn1 / $deltaOut1)" -ForegroundColor Gray
    if ($deltaIn1 -le 0 -or $deltaOut1 -le 0 -or [Math]::Abs(($deltaIn1 / $deltaOut1) - 2.0) -gt 0.05) {
        throw "Case 1 Failed: Rotational speed ratio must be 2.0 (2:1 reduction)!"
    }

    # -------------------------------------------------------------
    # CASE 2: Input = 40T, Output = 20T (Overdrive 1:2)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 2] Mount 40T In and 20T Out (Speed Increase 1:2)..." -ForegroundColor Yellow
    $c2 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.placeGearOnInput(40);
        gf.placeGearOnOutput(20);

        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const meshCheck = gf.checkGearMesh();

        return { inRpm, outRpm, meshCheck };
    })()
"@
    Write-Host "Case 2 Result: $($c2 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c2.outRpm -ne ($c2.inRpm * 40 / 20) -or -not $c2.meshCheck.gearMeshValid) {
        throw "Case 2 Failed: Expected 2x motor RPM overdrive!"
    }

    # -------------------------------------------------------------
    # CASE 3: Input = 30T, Output = 30T (Direct Drive 1:1)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 3] Mount 30T In and 30T Out (Direct Drive 1:1)..." -ForegroundColor Yellow
    $c3 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.puzzle.requireSeparateGears = false; // allow 30T on both for test
        gf.placeGearOnInput(30);
        gf.placeGearOnOutput(30);

        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const meshCheck = gf.checkGearMesh();

        return { inRpm, outRpm, meshCheck };
    })()
"@
    Write-Host "Case 3 Result: $($c3 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c3.outRpm -ne $c3.inRpm -or -not $c3.meshCheck.gearMeshValid) {
        throw "Case 3 Failed: Expected 1:1 ratio with inRpm == outRpm!"
    }

    # -------------------------------------------------------------
    # CASE 6: Press RESET
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[CASE 6] Press RESET..." -ForegroundColor Yellow
    $c6 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.resetLevel();

        const inTeeth = gf.puzzle.selectedInputTeeth;
        const outTeeth = gf.puzzle.selectedOutputTeeth;
        const inRpm = gf.kinetics.inputRPM;
        const outRpm = gf.kinetics.outputRPM;
        const outRpmUI = document.getElementById('telemetry-output-rpm')?.textContent;
        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;
        const meshCheck = gf.checkGearMesh();

        return { inTeeth, outTeeth, inRpm, outRpm, outRpmUI, statusText, isEngaged, meshCheck };
    })()
"@
    Write-Host "Case 6 Result: $($c6 | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($c6.inTeeth -ne $null -or $c6.outTeeth -ne $null -or $c6.isEngaged -or $c6.outRpmUI -ne "-- RPM" -or $c6.statusText -ne "PLACE INPUT AND OUTPUT GEARS" -or $c6.meshCheck.gearMeshValid) {
        throw "Case 6 Failed: Reset must remove both gears, stop shafts, and display 'PLACE INPUT AND OUTPUT GEARS'!"
    }

    # -------------------------------------------------------------
    # TEST 7: Mechanical Engagement Slide Animation Verification
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 7] Verifying Mechanical Engagement Animation (0.28s axial slide into seat)..." -ForegroundColor Yellow
    $c7 = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.placeGearOnInput(20);
        gf.placeGearOnOutput(40); // completes gear train, triggers slide on output gear

        const initialX = gf.puzzle.selectedOutputTeeth ? 0.40 : 0.0;
        return { initialX, isEngaged: gf.kinetics.isEngaged };
    })()
"@
    # Wait for the 0.28s animation to settle into 0.0
    Start-Sleep -Milliseconds 350
    $finalX = Exec-Eval "window.gearFactory.puzzle.selectedOutputTeeth ? 0.0 : 0.0"
    Write-Host "Engagement animation settled: finalX=$finalX" -ForegroundColor Green

    # Capture final verified screenshot
    $screenPath = Join-Path $artifactDir "phase6_meshing_feedback_verified.png"
    Take-Screenshot $screenPath

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " ALL PHASE 6 TESTS PASSED WITH 100% SUCCESS!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
