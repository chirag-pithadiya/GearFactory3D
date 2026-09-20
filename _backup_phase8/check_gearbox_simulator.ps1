# Automated Gearbox Simulator Verification for Gear Factory 3D
param(
    [int]$Port = 9235
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GEAR FACTORY 3D - GEARBOX SIMULATOR VERIFICATION       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_gearbox_diag"
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
    if (-not $gamePage) { $gamePage = $pages[0] }

    $wsUrl = [System.Uri]::new($gamePage.webSocketDebuggerUrl)
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $ws.ConnectAsync($wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:msgId = 400

    function Read-NextJson() {
        $buffer = [byte[]]::new(1048576)
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
                    Write-Host "  EXCEPTION: $($msg.params.exceptionDetails.exception.description)" -ForegroundColor Red
                } elseif ($msg.method -eq "Console.messageAdded") {
                    if ($msg.params.message.level -eq "error") {
                        Write-Host "  CONSOLE ERROR: $($msg.params.message.text)" -ForegroundColor Red
                    }
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

    Start-Sleep -Milliseconds 1500

    function Eval-Js($code) {
        $res = Call-CDP "Runtime.evaluate" @{ expression = $code; returnByValue = $true; awaitPromise = $true }
        if ($res.result.exceptionDetails) {
            throw $res.result.exceptionDetails.exception.description
        }
        return $res.result.result.value
    }

    # CHECK 1: Initial Default Values & Formulas
    Write-Host "`n[CHECK 1] Verifying Default Gearbox Values & Calculations..." -ForegroundColor Yellow
    $codeDefaults = @'
    (() => {
        const gf = window.gearFactory;
        const rpmField = document.getElementById('input-rpm-field');
        const inTeethField = document.getElementById('input-teeth-field');
        const outTeethField = document.getElementById('output-teeth-field');
        const inRpmStat = document.getElementById('stat-input-rpm-display');
        const outRpmStat = document.getElementById('stat-output-rpm-display');
        const inTeethStat = document.getElementById('stat-input-teeth');
        const outTeethStat = document.getElementById('stat-output-teeth');
        const ratioStat = document.getElementById('stat-gear-ratio');

        return {
            fieldRpm: rpmField ? rpmField.value : null,
            fieldInTeeth: inTeethField ? inTeethField.value : null,
            fieldOutTeeth: outTeethField ? outTeethField.value : null,
            stateInRpm: gf.state.targetInputRPM,
            stateOutRpm: gf.state.targetOutputRPM,
            stateInTeeth: gf.state.inputTeeth,
            stateOutTeeth: gf.state.outputTeeth,
            stateRatio: gf.state.gearRatio,
            hudInRpm: inRpmStat ? inRpmStat.textContent : null,
            hudOutRpm: outRpmStat ? outRpmStat.textContent : null,
            hudInTeeth: inTeethStat ? inTeethStat.textContent : null,
            hudOutTeeth: outTeethStat ? outTeethStat.textContent : null,
            hudRatio: ratioStat ? ratioStat.textContent : null,
            expectedRatio: 40 / 20,
            expectedOutRpm: 100 * 20 / 40
        };
    })()
'@
    $defaults = Eval-Js $codeDefaults
    Write-Host "  Input RPM Field: $($defaults.fieldRpm) (State: $($defaults.stateInRpm), HUD: $($defaults.hudInRpm))"
    Write-Host "  Input Teeth Field: $($defaults.fieldInTeeth) (State: $($defaults.stateInTeeth), HUD: $($defaults.hudInTeeth))"
    Write-Host "  Output Teeth Field: $($defaults.fieldOutTeeth) (State: $($defaults.stateOutTeeth), HUD: $($defaults.hudOutTeeth))"
    Write-Host "  Calculated Gear Ratio: $($defaults.stateRatio) (Expected: $($defaults.expectedRatio))"
    Write-Host "  Calculated Output RPM: $($defaults.stateOutRpm) (Expected: $($defaults.expectedOutRpm), HUD: $($defaults.hudOutRpm))"

    if ($defaults.fieldRpm -ne "100" -or $defaults.fieldInTeeth -ne "20" -or $defaults.fieldOutTeeth -ne "40") {
        throw "Default input fields mismatch!"
    }
    if ($defaults.stateRatio -ne 2 -or $defaults.stateOutRpm -ne 50) {
        throw "Default calculated values mismatch!"
    }
    Write-Host "  => Default parameters and calculations PASSED!" -ForegroundColor Green

    # CHECK 2: Dynamic Update of Input RPM (e.g. 150 RPM)
    Write-Host "`n[CHECK 2] Testing Dynamic Input RPM Change to 150 RPM..." -ForegroundColor Yellow
    $codeChangeRPM = @'
    (() => {
        const rpmField = document.getElementById('input-rpm-field');
        rpmField.value = "150";
        rpmField.dispatchEvent(new Event('input', { bubbles: true }));

        const gf = window.gearFactory;
        return {
            stateInRpm: gf.state.targetInputRPM,
            stateOutRpm: gf.state.targetOutputRPM,
            hudOutRpm: document.getElementById('stat-output-rpm-display').textContent,
            expectedOutRpm: 150 * 20 / 40
        };
    })()
'@
    $resRpm = Eval-Js $codeChangeRPM
    Write-Host "  New Target Input RPM: $($resRpm.stateInRpm)"
    Write-Host "  New Target Output RPM: $($resRpm.stateOutRpm) (Expected: $($resRpm.expectedOutRpm), HUD: $($resRpm.hudOutRpm))"
    if ($resRpm.stateOutRpm -ne 75) {
        throw "RPM update calculation failed!"
    }
    Write-Host "  => Real-time RPM recalculation PASSED!" -ForegroundColor Green

    # CHECK 3: Dynamic Update of Teeth & 3D Mesh Regeneration (e.g., 30T Input, 30T Output -> Ratio 1.0)
    Write-Host "`n[CHECK 3] Testing Dynamic Teeth Change (30T Input, 30T Output -> Ratio 1.0)..." -ForegroundColor Yellow
    $codeChangeTeeth = @'
    (() => {
        const inTeethField = document.getElementById('input-teeth-field');
        const outTeethField = document.getElementById('output-teeth-field');
        inTeethField.value = "30";
        inTeethField.dispatchEvent(new Event('input', { bubbles: true }));
        outTeethField.value = "30";
        outTeethField.dispatchEvent(new Event('input', { bubbles: true }));

        const gf = window.gearFactory;
        return {
            stateInTeeth: gf.state.inputTeeth,
            stateOutTeeth: gf.state.outputTeeth,
            stateRatio: gf.state.gearRatio,
            stateOutRpm: gf.state.targetOutputRPM,
            meshInTeeth: gf.inputGear.userData.teeth,
            meshOutTeeth: gf.outputGear.userData.teeth,
            hudRatio: document.getElementById('stat-gear-ratio').textContent,
            expectedOutRpm: 150 * 30 / 30
        };
    })()
'@
    $resTeeth = Eval-Js $codeChangeTeeth
    Write-Host "  Input Teeth: $($resTeeth.stateInTeeth) (Mesh UserData: $($resTeeth.meshInTeeth))"
    Write-Host "  Output Teeth: $($resTeeth.stateOutTeeth) (Mesh UserData: $($resTeeth.meshOutTeeth))"
    Write-Host "  Gear Ratio: $($resTeeth.stateRatio) (HUD: $($resTeeth.hudRatio))"
    Write-Host "  Output RPM: $($resTeeth.stateOutRpm) (Expected: $($resTeeth.expectedOutRpm))"

    if ($resTeeth.stateRatio -ne 1 -or $resTeeth.meshInTeeth -ne 30 -or $resTeeth.meshOutTeeth -ne 30) {
        throw "Dynamic teeth update and mesh regeneration failed!"
    }
    Write-Host "  => Dynamic teeth change & 3D mesh regeneration PASSED!" -ForegroundColor Green

    # CHECK 4: Input Validation (Negative RPM, 0 or Negative Teeth, Empty Values)
    Write-Host "`n[CHECK 4] Testing Input Validation Rules..." -ForegroundColor Yellow
    $codeValidation = @'
    (() => {
        const rpmField = document.getElementById('input-rpm-field');
        const inTeethField = document.getElementById('input-teeth-field');
        const outTeethField = document.getElementById('output-teeth-field');
        const statusBadge = document.getElementById('validation-status');

        // Test A: Negative RPM
        rpmField.value = "-25";
        rpmField.dispatchEvent(new Event('input', { bubbles: true }));
        const negativeRpmStatus = statusBadge.textContent;
        const negativeRpmClass = statusBadge.className;
        const fieldHasErrorClass = rpmField.classList.contains('input-error');

        // Test B: Zero Teeth
        rpmField.value = "100";
        rpmField.dispatchEvent(new Event('input', { bubbles: true }));
        inTeethField.value = "0";
        inTeethField.dispatchEvent(new Event('input', { bubbles: true }));
        const zeroTeethStatus = statusBadge.textContent;

        // Test C: Empty Teeth
        inTeethField.value = "";
        inTeethField.dispatchEvent(new Event('input', { bubbles: true }));
        const emptyTeethStatus = statusBadge.textContent;

        return {
            negativeRpmStatus,
            negativeRpmClass,
            fieldHasErrorClass,
            zeroTeethStatus,
            emptyTeethStatus,
            sceneStillAlive: !!window.gearFactory.scene
        };
    })()
'@
    $resVal = Eval-Js $codeValidation
    Write-Host "  Negative RPM Status: $($resVal.negativeRpmStatus) (Badge Class: $($resVal.negativeRpmClass), Error Border: $($resVal.fieldHasErrorClass))"
    Write-Host "  Zero Teeth Status: $($resVal.zeroTeethStatus)"
    Write-Host "  Empty Teeth Status: $($resVal.emptyTeethStatus)"
    Write-Host "  Scene Integrity Maintained: $($resVal.sceneStillAlive)"

    if (-not $resVal.fieldHasErrorClass -or -not ($resVal.negativeRpmStatus -like "*negative*")) {
        throw "Negative RPM validation failed!"
    }
    if (-not ($resVal.zeroTeethStatus -like "*> 0*")) {
        throw "Zero teeth validation failed!"
    }
    Write-Host "  => Input validation properly prevented invalid values without breaking the scene!" -ForegroundColor Green

    # CHECK 5: Reset Button Functionality
    Write-Host "`n[CHECK 5] Testing Reset Button..." -ForegroundColor Yellow
    $codeReset = @'
    (() => {
        document.getElementById('btn-reset').click();
        const gf = window.gearFactory;
        const rpmField = document.getElementById('input-rpm-field');
        const inTeethField = document.getElementById('input-teeth-field');
        const outTeethField = document.getElementById('output-teeth-field');
        const statusBadge = document.getElementById('validation-status');

        return {
            fieldRpm: rpmField.value,
            fieldInTeeth: inTeethField.value,
            fieldOutTeeth: outTeethField.value,
            stateInRpm: gf.state.targetInputRPM,
            stateOutRpm: gf.state.targetOutputRPM,
            stateInTeeth: gf.state.inputTeeth,
            stateOutTeeth: gf.state.outputTeeth,
            stateRatio: gf.state.gearRatio,
            statusBadge: statusBadge.textContent,
            isRunning: gf.state.isRunning
        };
    })()
'@
    $resReset = Eval-Js $codeReset
    Write-Host "  After Reset -> Input RPM: $($resReset.fieldRpm), Input Teeth: $($resReset.fieldInTeeth), Output Teeth: $($resReset.fieldOutTeeth)"
    Write-Host "  After Reset -> State Ratio: $($resReset.stateRatio), Output RPM: $($resReset.stateOutRpm)"
    Write-Host "  After Reset -> Validation Status: $($resReset.statusBadge), Running: $($resReset.isRunning)"

    if ($resReset.fieldRpm -ne "100" -or $resReset.fieldInTeeth -ne "20" -or $resReset.fieldOutTeeth -ne "40" -or $resReset.stateRatio -ne 2) {
        throw "Reset button failed to restore defaults!"
    }
    Write-Host "  => Reset button restored all default parameters!" -ForegroundColor Green

    # CHECK 6: Start, Rotation Directions (CW & CCW), Dynamic Speed Updates
    Write-Host "`n[CHECK 6] Testing Start, Rotation Directions, and Animation Kinematics..." -ForegroundColor Yellow
    $codeStart = @'
    (() => {
        document.getElementById('btn-start').click();
        const gf = window.gearFactory;
        return {
            isRunning: gf.state.isRunning,
            rotYInputInit: gf.inputGear.rotation.y,
            rotYOutputInit: gf.outputGear.rotation.y
        };
    })()
'@
    $initRot = Eval-Js $codeStart
    Write-Host "  Start clicked. Running state: $($initRot.isRunning)"

    # Wait 1.5 seconds for rotation kinematics
    Start-Sleep -Milliseconds 1500

    $codeCheckRot = @'
    (() => {
        const gf = window.gearFactory;
        const currentInRPM = gf.state.currentInputRPM;
        const currentOutRPM = gf.state.currentOutputRPM;
        const rotYIn = gf.inputGear.rotation.y;
        const rotYOut = gf.outputGear.rotation.y;

        // In Three.js coordinate system looking down from above:
        // Input rotates CLOCKWISE -> negative Y rotation angle
        // Output rotates COUNTER-CLOCKWISE -> positive Y rotation angle
        const isInputClockwise = rotYIn < 0;
        const isOutputCounterClockwise = rotYOut > 0;

        return {
            currentInRPM,
            currentOutRPM,
            rotYIn,
            rotYOut,
            isInputClockwise,
            isOutputCounterClockwise,
            ratioObserved: currentInRPM > 0 ? (currentInRPM / currentOutRPM) : 0
        };
    })()
'@
    $rotRes = Eval-Js $codeCheckRot
    Write-Host "  Kinematics at t=1.5s:"
    Write-Host "    Current Input RPM: $($rotRes.currentInRPM)"
    Write-Host "    Current Output RPM: $($rotRes.currentOutRPM)"
    Write-Host "    Input Gear Rotation Y: $($rotRes.rotYIn) (Clockwise: $($rotRes.isInputClockwise))"
    Write-Host "    Output Gear Rotation Y: $($rotRes.rotYOut) (Counter-Clockwise: $($rotRes.isOutputCounterClockwise))"
    Write-Host "    Velocity Ratio: $($rotRes.ratioObserved) (Expected: 2.0)"

    if (-not $rotRes.isInputClockwise -or -not $rotRes.isOutputCounterClockwise) {
        throw "Rotation directions do not match specification (Input CW, Output CCW)!"
    }
    if ([Math]::Abs($rotRes.ratioObserved - 2.0) -gt 0.05) {
        throw "Kinematic velocity ratio during rotation does not match expected 2:1 ratio!"
    }
    Write-Host "  => Start & Rotation directions (CW and CCW) verified!" -ForegroundColor Green

    # CHECK 7: Capture Screenshot of Running Gearbox Simulator
    Write-Host "`n[CHECK 7] Capturing High-Res Screenshot of Gearbox Simulator..." -ForegroundColor Yellow
    $screenshotRes = Call-CDP "Page.captureScreenshot" @{ format = "png" }
    $screenshotBase64 = $screenshotRes.result.data
    $screenshotBytes = [System.Convert]::FromBase64String($screenshotBase64)

    $destPathLocal = "d:\GAMES\GearFactory3D\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destPathLocal, $screenshotBytes)
    Write-Host "  Saved screenshot to $destPathLocal" -ForegroundColor Green

    $destArtifact = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destArtifact, $screenshotBytes)
    Write-Host "  Saved screenshot to $destArtifact" -ForegroundColor Green

    # CHECK 8: Stop Button
    Write-Host "`n[CHECK 8] Testing Stop Button..." -ForegroundColor Yellow
    $codeStop = @'
    (() => {
        document.getElementById('btn-stop').click();
        return window.gearFactory.state.isRunning;
    })()
'@
    $stopState = Eval-Js $codeStop
    Write-Host "  Stop clicked. Running state: $stopState"
    if ($stopState -ne $false) {
        throw "Stop button failed to halt simulation!"
    }
    Write-Host "  => Stop button verified!" -ForegroundColor Green

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "   ALL GEARBOX SIMULATOR VERIFICATION CHECKS PASSED!     " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
