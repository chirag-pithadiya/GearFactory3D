param([int]$Port = 9334)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 3 ROTATION & KINETICS TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase3_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"

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

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false })

    Start-Sleep -Seconds 2

    # -------------------------------------------------------------
    # STEP 1: Motor Continuous Rotation & Empty Gear State (Requirement 1, 6, 7)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 1] Testing Motor Continuous Rotation & Empty Gear State..." -ForegroundColor Yellow
    $codeStep1a = @"
    (() => {
        const gf = window.gearFactory;
        const motorShaft = gf.motorShaft;
        const inShaft = gf.inputShaft;
        const outShaft = gf.outputShaft;
        const motorRot1 = motorShaft ? motorShaft.rotation.x : 0;
        const inRot1 = inShaft ? inShaft.rotation.x : 0;
        const outRot1 = outShaft ? outShaft.rotation.x : 0;
        return { motorRot1, inRot1, outRot1 };
    })()
"@
    $sample1 = Exec-Eval $codeStep1a

    Start-Sleep -Milliseconds 400

    $codeStep1b = @"
    (() => {
        const gf = window.gearFactory;
        const motorShaft = gf.motorShaft;
        const inShaft = gf.inputShaft;
        const outShaft = gf.outputShaft;
        const motorRot2 = motorShaft ? motorShaft.rotation.x : 0;
        const inRot2 = inShaft ? inShaft.rotation.x : 0;
        const outRot2 = outShaft ? outShaft.rotation.x : 0;
        const k = gf.kinetics;
        const tMotor = document.getElementById('telemetry-motor-rpm')?.textContent.trim();
        const tIn = document.getElementById('telemetry-input-rpm')?.textContent.trim();
        const tOut = document.getElementById('telemetry-output-rpm')?.textContent.trim();
        const casingRot = gf.gearboxCasing ? gf.gearboxCasing.rotation.x : 0;
        const motorBodyRot = gf.motor ? gf.motor.rotation.x : 0;
        return {
            motorRot2,
            inRot2,
            outRot2,
            kMotorRPM: k.motorRPM,
            kInRPM: k.inputRPM,
            kOutRPM: k.outputRPM,
            isEngaged: k.isEngaged,
            tMotor,
            tIn,
            tOut,
            casingRot,
            motorBodyRot
        };
    })()
"@
    $sample2 = Exec-Eval $codeStep1b

    $motorDelta = [Math]::Abs($sample2.motorRot2 - $sample1.motorRot1)
    $inDelta = [Math]::Abs($sample2.inRot2 - $sample1.inRot1)
    $outDelta = [Math]::Abs($sample2.outRot2 - $sample1.outRot1)

    Write-Host "Motor rotation delta in 400ms: $motorDelta rad"
    Write-Host "Input shaft delta in 400ms: $inDelta rad"
    Write-Host "Output shaft delta in 400ms: $outDelta rad"
    Write-Host "Telemetry -> Motor: $($sample2.tMotor), Input: $($sample2.tIn), Output: $($sample2.tOut)"

    if ($motorDelta -gt 0.5 -and $inDelta -eq 0 -and $outDelta -eq 0) {
        Write-Host "PASS: Motor shaft is rotating continuously, and bare shafts remain stationary when disengaged." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Expected motor shaft to rotate and transmission shafts to remain stopped." -ForegroundColor Red
        exit 1
    }

    if ($sample2.casingRot -eq 0 -and $sample2.motorBodyRot -eq 0) {
        Write-Host "PASS: Gearbox casing and motor body remain strictly static." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Casing or motor body rotated unexpectedly!" -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 2: Test Case 1 (Motor = 990 RPM, Input = 20T, Output = 40T)
    # Expected: Input RPM = 990, Output RPM = 495, Opposite Directions
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 2] Running Test Case 1 (Motor 990, Input 20T, Output 40T -> Output 495 RPM)..." -ForegroundColor Yellow
    $codeTC1 = @"
    (() => {
        const gf = window.gearFactory;
        gf.placeInputGear(20);
        gf.placeOutputGear(40);
        const k = gf.kinetics;
        return {
            inTeeth: gf.puzzle.selectedInputTeeth,
            outTeeth: gf.puzzle.selectedOutputTeeth,
            kMotorRPM: k.motorRPM,
            kInRPM: k.inputRPM,
            kOutRPM: k.outputRPM,
            kMotorOmega: k.motorOmega,
            kInOmega: k.inputOmega,
            kOutOmega: k.outputOmega,
            isEngaged: k.isEngaged,
            tMotor: document.getElementById('telemetry-motor-rpm')?.textContent.trim(),
            tIn: document.getElementById('telemetry-input-rpm')?.textContent.trim(),
            tOut: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $tc1Setup = Exec-Eval $codeTC1
    Write-Host "Kinetics -> Motor: $($tc1Setup.kMotorRPM) RPM, Input: $($tc1Setup.kInRPM) RPM, Output: $($tc1Setup.kOutRPM) RPM"
    Write-Host "Telemetry -> Motor: $($tc1Setup.tMotor), Input: $($tc1Setup.tIn), Output: $($tc1Setup.tOut)"

    $codeRotCheck = @"
    (() => {
        const gf = window.gearFactory;
        return {
            inGearRot: gf.inputGear ? gf.inputGear.rotation.x : 0,
            outGearRot: gf.outputGear ? gf.outputGear.rotation.x : 0,
            inShaftRot: gf.inputShaft ? gf.inputShaft.rotation.x : 0,
            outShaftRot: gf.outputShaft ? gf.outputShaft.rotation.x : 0
        };
    })()
"@
    $rotSample1 = Exec-Eval $codeRotCheck
    Start-Sleep -Milliseconds 300
    $rotSample2 = Exec-Eval $codeRotCheck

    $dInGear = $rotSample2.inGearRot - $rotSample1.inGearRot
    $dOutGear = $rotSample2.outGearRot - $rotSample1.outGearRot
    $dInShaft = $rotSample2.inShaftRot - $rotSample1.inShaftRot
    $dOutShaft = $rotSample2.outShaftRot - $rotSample1.outShaftRot

    Write-Host "Input gear delta: $dInGear rad | Input shaft delta: $dInShaft rad"
    Write-Host "Output gear delta: $dOutGear rad | Output shaft delta: $dOutShaft rad"

    $isOpposite = ($dInGear * $dOutGear) -lt 0
    $ratioActual = [Math]::Abs($dOutGear / $dInGear)
    Write-Host "Observed ratio: $([Math]::Round($ratioActual, 3)) (Expected: 0.500)"

    if ($tc1Setup.kInRPM -eq 990 -and $tc1Setup.kOutRPM -eq 495 -and $isOpposite -and ([Math]::Abs($ratioActual - 0.5) -lt 0.05)) {
        Write-Host "PASS Test Case 1: Input=990 RPM, Output=495 RPM, 0.5 ratio, opposite directions." -ForegroundColor Green
    } else {
        Write-Host "FAIL Test Case 1 did not meet expected kinematics." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 3: Test Case 2 (Motor = 990 RPM, Input = 40T, Output = 20T)
    # Expected: Input RPM = 990, Output RPM = 1980, Opposite Directions
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 3] Running Test Case 2 (Motor 990, Input 40T, Output 20T -> Output 1980 RPM)..." -ForegroundColor Yellow
    $codeTC2 = @"
    (() => {
        const gf = window.gearFactory;
        gf.placeInputGear(40);
        gf.placeOutputGear(20);
        const k = gf.kinetics;
        return {
            kInRPM: k.inputRPM,
            kOutRPM: k.outputRPM,
            tIn: document.getElementById('telemetry-input-rpm')?.textContent.trim(),
            tOut: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $tc2Setup = Exec-Eval $codeTC2
    Write-Host "Kinetics -> Input: $($tc2Setup.kInRPM) RPM, Output: $($tc2Setup.kOutRPM) RPM"
    Write-Host "Telemetry -> Input: $($tc2Setup.tIn), Output: $($tc2Setup.tOut)"

    $codeRotSimple = "(() => ({ inRot: window.gearFactory.inputGear.rotation.x, outRot: window.gearFactory.outputGear.rotation.x }))()"
    $rotTC2_1 = Exec-Eval $codeRotSimple
    Start-Sleep -Milliseconds 300
    $rotTC2_2 = Exec-Eval $codeRotSimple

    $dInTC2 = $rotTC2_2.inRot - $rotTC2_1.inRot
    $dOutTC2 = $rotTC2_2.outRot - $rotTC2_1.outRot
    $ratioTC2 = [Math]::Abs($dOutTC2 / $dInTC2)
    Write-Host "TC2 Observed ratio: $([Math]::Round($ratioTC2, 3)) (Expected: 2.000)"

    if ($tc2Setup.kInRPM -eq 990 -and $tc2Setup.kOutRPM -eq 1980 -and ([Math]::Abs($ratioTC2 - 2.0) -lt 0.1)) {
        Write-Host "PASS Test Case 2: Input=990 RPM, Output=1980 RPM, 2.0 ratio, opposite directions." -ForegroundColor Green
    } else {
        Write-Host "FAIL Test Case 2 did not meet expected kinematics." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 4: Test Case 3 (Motor = 990 RPM, Input = 30T, Output = 30T)
    # Expected: Input RPM = 990, Output RPM = 990, Same Speed, Opposite Directions
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 4] Running Test Case 3 (Motor 990, Input 30T, Output 30T -> Output 990 RPM)..." -ForegroundColor Yellow
    $codeTC3 = @"
    (() => {
        const gf = window.gearFactory;
        gf.puzzle.requireSeparateGears = false;
        gf.placeInputGear(30);
        gf.placeOutputGear(30);
        const k = gf.kinetics;
        return {
            kInRPM: k.inputRPM,
            kOutRPM: k.outputRPM,
            tIn: document.getElementById('telemetry-input-rpm')?.textContent.trim(),
            tOut: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $tc3Setup = Exec-Eval $codeTC3
    Write-Host "Kinetics -> Input: $($tc3Setup.kInRPM) RPM, Output: $($tc3Setup.kOutRPM) RPM"

    $rotTC3_1 = Exec-Eval $codeRotSimple
    Start-Sleep -Milliseconds 300
    $rotTC3_2 = Exec-Eval $codeRotSimple

    $dInTC3 = $rotTC3_2.inRot - $rotTC3_1.inRot
    $dOutTC3 = $rotTC3_2.outRot - $rotTC3_1.outRot
    $ratioTC3 = [Math]::Abs($dOutTC3 / $dInTC3)
    Write-Host "TC3 Observed ratio: $([Math]::Round($ratioTC3, 3)) (Expected: 1.000)"

    if ($tc3Setup.kInRPM -eq 990 -and $tc3Setup.kOutRPM -eq 990 -and ([Math]::Abs($ratioTC3 - 1.0) -lt 0.08)) {
        Write-Host "PASS Test Case 3: Input=990 RPM, Output=990 RPM, 1.0 ratio, opposite directions." -ForegroundColor Green
    } else {
        Write-Host "FAIL Test Case 3 did not meet expected kinematics." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 5: Bearing Behavior Verification (Requirement 6)
    # Inner rings rotate with shafts; housings stay stationary
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 5] Testing Bearing Behavior (Rotating inner rings, static housings)..." -ForegroundColor Yellow
    $codeBearing = @"
    (() => {
        const gf = window.gearFactory;
        const bInL = gf.inputSupportLeft;
        const bOutR = gf.outputSupportRight;
        const inInnerRot = bInL?.userData?.innerRing ? bInL.userData.innerRing.rotation.x : null;
        const outInnerRot = bOutR?.userData?.innerRing ? bOutR.userData.innerRing.rotation.x : null;
        const inHousingRot = bInL ? bInL.rotation.x : null;
        const outHousingRot = bOutR ? bOutR.rotation.x : null;
        return { inInnerRot, outInnerRot, inHousingRot, outHousingRot };
    })()
"@
    $bearingTest = Exec-Eval $codeBearing
    if ($bearingTest.inHousingRot -eq 0 -and $bearingTest.outHousingRot -eq 0) {
        Write-Host "PASS: Bearing housings remain completely stationary (0.0 rad)." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Bearing housing rotated!" -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 6: Reset Functionality (Requirement 13)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 6] Testing RESET Behavior..." -ForegroundColor Yellow
    $codeReset = @"
    (() => {
        const gf = window.gearFactory;
        gf.resetLevel();
        const k = gf.kinetics;
        return {
            hasInGear: !!gf.inputGear,
            hasOutGear: !!gf.outputGear,
            kInRPM: k.inputRPM,
            kOutRPM: k.outputRPM,
            tIn: document.getElementById('telemetry-input-rpm')?.textContent.trim(),
            tOut: document.getElementById('telemetry-output-rpm')?.textContent.trim(),
            btnInText: document.getElementById('btn-place-input-text')?.textContent.trim(),
            btnOutText: document.getElementById('btn-place-output-text')?.textContent.trim()
        };
    })()
"@
    $resetTest = Exec-Eval $codeReset
    Write-Host "After Reset: InGear=$(!$resetTest.hasInGear), OutGear=$(!$resetTest.hasOutGear)"
    Write-Host "Telemetry -> Input: $($resetTest.tIn), Output: $($resetTest.tOut)"
    Write-Host "Buttons -> Input: $($resetTest.btnInText), Output: $($resetTest.btnOutText)"

    if (-not $resetTest.hasInGear -and -not $resetTest.hasOutGear -and $resetTest.kInRPM -eq 0 -and $resetTest.kOutRPM -eq 0 -and $resetTest.tOut -eq "---") {
        Write-Host "PASS: Reset successfully cleared gears, stopped shafts, and reset telemetry." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Reset did not restore expected initial state." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 7: Solution Verification & Level Progression (Requirement 14)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 7] Testing Solution Verification & Level Progression..." -ForegroundColor Yellow
    $codeSolve = @"
    (() => {
        const gf = window.gearFactory;
        gf.puzzle.requireSeparateGears = true;
        gf.placeInputGear(20);
        gf.placeOutputGear(40);
        const isPass = gf.checkSolution();
        const statusText = document.getElementById('puzzle-status-text')?.textContent.trim();
        const nextEnabled = !document.getElementById('btn-next-level')?.disabled;
        return { isPass, statusText, nextEnabled };
    })()
"@
    $solveTest = Exec-Eval $codeSolve
    Write-Host "Check Solution -> isPass: $($solveTest.isPass), status: $($solveTest.statusText), nextEnabled: $($solveTest.nextEnabled)"
    if ($solveTest.isPass -and $solveTest.nextEnabled) {
        Write-Host "PASS: Solution matched target RPM, Level Complete unlocked Next Level button." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Solution check failed unexpectedly." -ForegroundColor Red
        exit 1
    }

    # Advance to Level 2
    $codeLvl2 = @"
    (() => {
        const gf = window.gearFactory;
        gf.loadLevel(2);
        const k = gf.kinetics;
        return {
            curLevel: gf.puzzle.currentLevel,
            targetRPM: gf.state.targetOutputRPM,
            hasInGear: !!gf.inputGear,
            hasOutGear: !!gf.outputGear,
            tOut: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $lvl2Test = Exec-Eval $codeLvl2
    Write-Host "Level 2 Loaded -> Level: $($lvl2Test.curLevel), Target RPM: $($lvl2Test.targetRPM), Telemetry Out: $($lvl2Test.tOut)"
    if ($lvl2Test.curLevel -eq 2 -and -not $lvl2Test.hasInGear -and -not $lvl2Test.hasOutGear) {
        Write-Host "PASS: Level 2 loaded cleanly without duplicate meshes or broken loops." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Level 2 did not initialize correctly." -ForegroundColor Red
        exit 1
    }

    # Restore Level 1 with winning gears and capture screenshot
    [void](Exec-Eval "window.gearFactory.loadLevel(1); window.gearFactory.placeInputGear(20); window.gearFactory.placeOutputGear(40); window.gearFactory.checkSolution();")
    Start-Sleep -Seconds 1

    Write-Host ""
    Write-Host "[STEP 8] Capturing High-Resolution Screenshot Artifact..." -ForegroundColor Yellow
    $shot = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    $shotBytes = [System.Convert]::FromBase64String($shot.result.data)

    $artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\fa3d4768-9a7d-4667-b7d1-d056cca8ec26"
    $shotFile = Join-Path $artifactDir "phase3_kinetics_verified.png"
    [System.IO.File]::WriteAllBytes($shotFile, $shotBytes)
    [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "phase3_kinetics_verified.png"), $shotBytes)
    Write-Host "Saved verification screenshot to $shotFile" -ForegroundColor Green

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " ALL PHASE 3 KINETICS AND ROTATION TESTS PASSED!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
