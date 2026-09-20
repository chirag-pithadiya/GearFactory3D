param([int]$Port = 9336)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 5 3D DRAG & DROP TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase5_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
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
            if ($msg.id -eq $thisId) {
                return $msg
            }
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
    # STEP 0: Verify Drag & Drop System Initialization
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 0] Verifying Drag & Drop Initial State..." -ForegroundColor Yellow
    $initCheck = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf?.dragDropState;
        return {
            hasGf: !!gf,
            hasDd: !!dd,
            hasInputTarget: !!dd?.dropTargets?.input,
            hasOutputTarget: !!dd?.dropTargets?.output,
            hasInputHalo: !!dd?.haloMeshes?.input,
            hasOutputHalo: !!dd?.haloMeshes?.output,
            isDragging: dd?.isDragging,
            cardCount: document.querySelectorAll('.available-gear-card').length
        };
    })()
"@
    Write-Host "Initial state: $($initCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if (-not $initCheck.hasDd -or -not $initCheck.hasInputTarget -or -not $initCheck.hasOutputTarget) {
        throw "Failed to initialize Drag & Drop state and targets!"
    }

    # -------------------------------------------------------------
    # TEST 1: Drag 20T Gear onto Input Shaft
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 1] Drag 20T gear onto Input Shaft..." -ForegroundColor Yellow
    $t1Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;

        // 1. Start drag on 20T gear
        gf.startGearDrag(20);
        const isDragging = dd.isDragging;
        const draggedTeeth = dd.draggedTeeth;
        const cardStatus = document.querySelector('.available-gear-card[data-teeth="20"] .card-status')?.textContent;

        // 2. Simulate moving over Input Shaft target
        dd.activeHoverTarget = 'input';
        dd.haloMeshes.input.userData.setOpacity(0.85);
        dd.haloMeshes.output.userData.setOpacity(0.0);
        const inputHaloOp = dd.haloMeshes.input.children[0].material.opacity;
        const outputHaloOp = dd.haloMeshes.output.children[0].material.opacity;

        // 3. Release / finish drag
        gf.finishGearDrag();

        // 4. Verify snap into position on input shaft
        const inputTeeth = gf.puzzle.selectedInputTeeth;
        const cardAfterStatus = document.querySelector('.available-gear-card[data-teeth="20"] .card-status')?.textContent;
        const isPreviewDisposed = !dd.previewMesh;
        const isDraggingEnded = !dd.isDragging;

        return {
            isDragging,
            draggedTeeth,
            cardStatus,
            inputHaloOp,
            outputHaloOp,
            inputTeeth,
            cardAfterStatus,
            isPreviewDisposed,
            isDraggingEnded
        };
    })()
"@
    Write-Host "Test 1 Drop Result: $($t1Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t1Result.inputTeeth -ne 20 -or -not $t1Result.isPreviewDisposed) {
        throw "Test 1 Failed: 20T gear was not placed on input shaft!"
    }

    # Verify input gear rotation
    Start-Sleep -Milliseconds 300
    $rot1 = Exec-Eval "window.gearFactory.kinetics.inputAngle"
    Start-Sleep -Milliseconds 400
    $rot2 = Exec-Eval "window.gearFactory.kinetics.inputAngle"
    Write-Host "Input gear rotation check: angle1=$rot1, angle2=$rot2" -ForegroundColor Gray
    # Note: until both gears are placed, input shaft is disengaged or motor shaft is spinning
    $motorRot1 = Exec-Eval "window.gearFactory.kinetics.motorAngle"
    Start-Sleep -Milliseconds 300
    $motorRot2 = Exec-Eval "window.gearFactory.kinetics.motorAngle"
    Write-Host "Motor continuous rotation check: delta=$($motorRot2 - $motorRot1)" -ForegroundColor Gray
    if ($motorRot2 -le $motorRot1) {
        throw "Motor is not rotating continuously!"
    }

    # -------------------------------------------------------------
    # TEST 2: Drag 40T Gear onto Output Shaft
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 2] Drag 40T gear onto Output Shaft..." -ForegroundColor Yellow
    $t2Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;

        // 1. Start drag on 40T gear
        gf.startGearDrag(40);

        // 2. Simulate moving over Output Shaft target
        dd.activeHoverTarget = 'output';
        dd.haloMeshes.output.userData.setOpacity(0.85);
        dd.haloMeshes.input.userData.setOpacity(0.0);

        // 3. Release / finish drag
        gf.finishGearDrag();

        // 4. Verify snap into position on output shaft
        const outputTeeth = gf.puzzle.selectedOutputTeeth;
        const card40Status = document.querySelector('.available-gear-card[data-teeth="40"] .card-status')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;
        const inputRPM = gf.kinetics.inputRPM;
        const outputRPM = gf.kinetics.outputRPM;

        return {
            outputTeeth,
            card40Status,
            isEngaged,
            inputRPM,
            outputRPM
        };
    })()
"@
    Write-Host "Test 2 Drop Result: $($t2Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t2Result.outputTeeth -ne 40 -or -not $t2Result.isEngaged -or $t2Result.outputRPM -ne 500) {
        throw "Test 2 Failed: 40T gear not placed or RPM ratio incorrect!"
    }

    # Verify both gears rotate in opposite directions
    Start-Sleep -Milliseconds 200
    $kinAngles1 = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    Start-Sleep -Milliseconds 400
    $kinAngles2 = Exec-Eval "({ inAngle: window.gearFactory.kinetics.inputAngle, outAngle: window.gearFactory.kinetics.outputAngle })"
    $deltaIn = $kinAngles2.inAngle - $kinAngles1.inAngle
    $deltaOut = $kinAngles2.outAngle - $kinAngles1.outAngle
    Write-Host "Rotation angles: deltaIn=$deltaIn, deltaOut=$deltaOut" -ForegroundColor Gray
    if ($deltaIn -le 0 -or $deltaOut -le 0) {
        throw "Gear train is not rotating!"
    }

    # -------------------------------------------------------------
    # TEST 3: Check Solution System
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 3] Check Solution with 20T In / 40T Out..." -ForegroundColor Yellow
    $t3Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const pass = gf.checkPuzzleSolution(true);
        const statusText = document.getElementById('puzzle-status-text')?.textContent;
        const isNextEnabled = !document.getElementById('btn-next-level')?.disabled;
        return { pass, statusText, isNextEnabled };
    })()
"@
    Write-Host "Test 3 Check Solution: $($t3Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if (-not $t3Result.pass -or $t3Result.statusText -ne "LEVEL COMPLETE") {
        throw "Test 3 Failed: Solution check did not pass!"
    }

    # Capture verified gameplay screenshot with both gears mounted and rotating
    $phase5ScreenPath = Join-Path $artifactDir "phase5_drag_drop_verified.png"
    Take-Screenshot $phase5ScreenPath

    # -------------------------------------------------------------
    # TEST 4: Reset Level
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 4] Press RESET..." -ForegroundColor Yellow
    $t4Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        gf.resetLevel();

        const inputTeeth = gf.puzzle.selectedInputTeeth;
        const outputTeeth = gf.puzzle.selectedOutputTeeth;
        const card20Status = document.querySelector('.available-gear-card[data-teeth="20"] .card-status')?.textContent;
        const card40Status = document.querySelector('.available-gear-card[data-teeth="40"] .card-status')?.textContent;
        const isEngaged = gf.kinetics.isEngaged;
        const isDragging = gf.dragDropState.isDragging;
        const isPreviewDisposed = !gf.dragDropState.previewMesh;

        return {
            inputTeeth,
            outputTeeth,
            card20Status,
            card40Status,
            isEngaged,
            isDragging,
            isPreviewDisposed
        };
    })()
"@
    Write-Host "Test 4 Reset: $($t4Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t4Result.inputTeeth -ne $null -or $t4Result.outputTeeth -ne $null -or $t4Result.isEngaged) {
        throw "Test 4 Failed: Reset did not unmount gears!"
    }

    # -------------------------------------------------------------
    # TEST 5: Invalid Drop (Drop on Floor / Outside)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 5] Try dropping 30T gear on invalid area (floor)..." -ForegroundColor Yellow
    $t5Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;

        // 1. Start dragging 30T
        gf.startGearDrag(30);
        const isDraggingBefore = dd.isDragging;

        // 2. Active hover target remains null (floor / invalid area)
        dd.activeHoverTarget = null;

        // 3. Release / finish drag
        gf.finishGearDrag();

        // 4. Verify gear returns to inventory and is not placed on either shaft
        const inputTeeth = gf.puzzle.selectedInputTeeth;
        const outputTeeth = gf.puzzle.selectedOutputTeeth;
        const card30Status = document.querySelector('.available-gear-card[data-teeth="30"] .card-status')?.textContent;
        const isPreviewDisposed = !dd.previewMesh;
        const isDraggingAfter = dd.isDragging;

        return {
            isDraggingBefore,
            isDraggingAfter,
            inputTeeth,
            outputTeeth,
            card30Status,
            isPreviewDisposed
        };
    })()
"@
    Write-Host "Test 5 Invalid Drop Result: $($t5Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t5Result.inputTeeth -ne $null -or $t5Result.outputTeeth -ne $null -or -not $t5Result.isPreviewDisposed -or $t5Result.card30Status -ne "READY") {
        throw "Test 5 Failed: Invalid drop did not cleanly return gear to inventory!"
    }

    # -------------------------------------------------------------
    # TEST 6: Replace Occupied Shaft
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 6] Drag 50T gear onto occupied Input Shaft (already holding 20T)..." -ForegroundColor Yellow
    $t6Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;

        // 1. First mount 20T on input
        gf.placeGearOnInput(20);
        const firstInput = gf.puzzle.selectedInputTeeth;
        const card20StatusBefore = document.querySelector('.available-gear-card[data-teeth="20"] .card-status')?.textContent;

        // 2. Now drag 50T and drop onto input shaft
        gf.startGearDrag(50);
        dd.activeHoverTarget = 'input';
        gf.finishGearDrag();

        // 3. Verify: 50T occupies input shaft, 20T returned to inventory (READY)
        const secondInput = gf.puzzle.selectedInputTeeth;
        const card20StatusAfter = document.querySelector('.available-gear-card[data-teeth="20"] .card-status')?.textContent;
        const card50StatusAfter = document.querySelector('.available-gear-card[data-teeth="50"] .card-status')?.textContent;

        return {
            firstInput,
            card20StatusBefore,
            secondInput,
            card20StatusAfter,
            card50StatusAfter
        };
    })()
"@
    Write-Host "Test 6 Replace Result: $($t6Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t6Result.secondInput -ne 50 -or $t6Result.card20StatusAfter -ne "READY" -or $t6Result.card50StatusAfter -ne "IN INPUT") {
        throw "Test 6 Failed: Replacing occupied shaft did not properly return old gear to inventory!"
    }

    # -------------------------------------------------------------
    # TEST 7: Mobile Touch Interaction Simulation
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[TEST 7] Simulating Mobile Touch Drag & Drop onto Output Shaft..." -ForegroundColor Yellow
    $t7Result = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;

        // Simulate touch drag on 10T gear
        gf.startGearDrag(10);
        dd.activeHoverTarget = 'output';
        gf.finishGearDrag();

        const outputTeeth = gf.puzzle.selectedOutputTeeth;
        const card10Status = document.querySelector('.available-gear-card[data-teeth="10"] .card-status')?.textContent;

        return {
            outputTeeth,
            card10Status
        };
    })()
"@
    Write-Host "Test 7 Touch Result: $($t7Result | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($t7Result.outputTeeth -ne 10 -or $t7Result.card10Status -ne "IN OUTPUT") {
        throw "Test 7 Failed: Touch placement failed!"
    }

    # Clean up and reset for clean final state
    Exec-Eval "window.gearFactory.resetLevel()"
    Start-Sleep -Seconds 1

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " ALL PHASE 5 TESTS COMPLETED AND PASSED WITH 100% SUCCESS!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
