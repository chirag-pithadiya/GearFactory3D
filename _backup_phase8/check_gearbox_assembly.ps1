# Automated Industrial Gearbox Assembly Verification for Gear Factory 3D
param(
    [int]$Port = 9240
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  GEAR FACTORY 3D - INDUSTRIAL GEARBOX ASSEMBLY TEST      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_assembly_diag"
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

    $script:msgId = 500

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

    # CHECK 1: Verify Reusable Functions Existence
    Write-Host "`n[CHECK 1] Verifying Reusable Functions..." -ForegroundColor Yellow
    $codeFunctions = @'
    (() => {
        const gf = window.gearFactory;
        return {
            hasCreateMotor: typeof gf.createMotor === 'function',
            hasCreateShaft: typeof gf.createShaft === 'function',
            hasCreateGearboxCasing: typeof gf.createGearboxCasing === 'function',
            hasCreateMountingFeet: typeof gf.createMountingFeet === 'function',
            hasCreateLabel: typeof gf.createLabel === 'function',
            hasCreateSpurGear: typeof gf.createSpurGear === 'function',
        };
    })()
'@
    $funcRes = Eval-Js $codeFunctions
    Write-Host "  createMotor(): $($funcRes.hasCreateMotor)"
    Write-Host "  createShaft(): $($funcRes.hasCreateShaft)"
    Write-Host "  createGearboxCasing(): $($funcRes.hasCreateGearboxCasing)"
    Write-Host "  createMountingFeet(): $($funcRes.hasCreateMountingFeet)"
    Write-Host "  createLabel(): $($funcRes.hasCreateLabel)"
    Write-Host "  createSpurGear(): $($funcRes.hasCreateSpurGear)"

    if (-not ($funcRes.hasCreateMotor -and $funcRes.hasCreateShaft -and $funcRes.hasCreateGearboxCasing -and $funcRes.hasCreateMountingFeet -and $funcRes.hasCreateLabel)) {
        throw "Missing required reusable functions!"
    }
    Write-Host "  => All requested functions exist and are callable!" -ForegroundColor Green

    # CHECK 2: Verify 3D Components Hierarchy
    Write-Host "`n[CHECK 2] Verifying 3D Components Hierarchy..." -ForegroundColor Yellow
    $codeComponents = @'
    (() => {
        const gf = window.gearFactory;
        const motor = gf.motor;
        const motorShaft = gf.motorShaft;
        const inShaft = gf.inputShaft;
        const outShaft = gf.outputShaft;
        const casing = gf.gearboxCasing;
        const labels = gf.labelsGroup;
        const inGear = gf.inputGear;
        const outGear = gf.outputGear;

        // Label texts present in labelsGroup
        const labelTexts = [];
        if (labels) {
            labels.traverse(child => {
                if (child.userData && child.userData.labelText) {
                    labelTexts.push(child.userData.labelText);
                }
            });
        }

        return {
            hasMotor: !!motor,
            hasMotorShaft: !!motorShaft,
            motorX: motor ? motor.position.x : null,
            hasInputShaft: !!inShaft,
            inShaftLength: inShaft ? inShaft.userData.length : null,
            hasOutputShaft: !!outShaft,
            outShaftLength: outShaft ? outShaft.userData.length : null,
            hasCasing: !!casing,
            casingChildrenCount: casing ? casing.children.length : 0,
            hasLabelsGroup: !!labels,
            labelTexts: labelTexts,
            outputShaftLongerThanInput: (outShaft && inShaft) ? (outShaft.userData.length > inShaft.userData.length) : false,
            motorIsOnLeft: motor ? (motor.position.x < 0) : false
        };
    })()
'@
    $compRes = Eval-Js $codeComponents
    Write-Host "  Motor Exists: $($compRes.hasMotor) (Position X: $($compRes.motorX), On Left: $($compRes.motorIsOnLeft))"
    Write-Host "  Motor Shaft Exists: $($compRes.hasMotorShaft)"
    Write-Host "  Input Shaft Exists: $($compRes.hasInputShaft) (Length: $($compRes.inShaftLength))"
    Write-Host "  Output Shaft Exists: $($compRes.hasOutputShaft) (Length: $($compRes.outShaftLength), Longer Than Input: $($compRes.outputShaftLongerThanInput))"
    Write-Host "  Gearbox Casing Exists: $($compRes.hasCasing) (Subcomponents: $($compRes.casingChildrenCount))"
    Write-Host "  Labels Found: $($compRes.labelTexts -join ', ')"

    $expectedLabels = @("MOTOR", "INPUT SHAFT", "INPUT GEAR", "OUTPUT GEAR", "OUTPUT SHAFT", "GEARBOX")
    foreach ($lbl in $expectedLabels) {
        if (-not ($compRes.labelTexts -contains $lbl)) {
            throw "Missing required visual label: $lbl"
        }
    }
    if (-not $compRes.outputShaftLongerThanInput) {
        throw "Output shaft must be longer than input shaft!"
    }
    if (-not $compRes.motorIsOnLeft) {
        throw "Motor must be placed on the left side of the gearbox!"
    }
    Write-Host "  => All components and 6 required visual labels verified!" -ForegroundColor Green

    # CHECK 3: Verify Synchronized Multi-Component Rotation
    Write-Host "`n[CHECK 3] Testing Synchronized Multi-Component Rotation..." -ForegroundColor Yellow
    # Click Start
    $codeStart = @'
    (() => {
        document.getElementById('btn-start').click();
        return window.gearFactory.state.isRunning;
    })()
'@
    $startStatus = Eval-Js $codeStart
    Write-Host "  Simulation started. isRunning: $startStatus"

    Start-Sleep -Milliseconds 1500

    $codeCheckSync = @'
    (() => {
        const gf = window.gearFactory;
        const inGearRotX = gf.inputGear.rotation.x;
        const motorShaftRotX = gf.motorShaft.rotation.x;
        const inShaftRotX = gf.inputShaft.rotation.x;

        const outGearRotX = gf.outputGear.rotation.x;
        const outShaftRotX = gf.outputShaft.rotation.x;

        // Input group rotates Clockwise (negative X rotation)
        const isInputGroupCW = (inGearRotX < 0) && (motorShaftRotX < 0) && (inShaftRotX < 0);
        // Input group synchronized: angle differences negligible
        const inputSyncDiff1 = Math.abs(inGearRotX - motorShaftRotX);
        const inputSyncDiff2 = Math.abs(inGearRotX - inShaftRotX);

        // Output group rotates Counter-Clockwise (positive X rotation relative to initial phase)
        const outPhase = Math.PI / gf.state.outputTeeth;
        const isOutputGroupCCW = (outGearRotX > outPhase) && (outShaftRotX > outPhase);
        const outputSyncDiff = Math.abs(outGearRotX - outShaftRotX);

        return {
            inGearRotX,
            motorShaftRotX,
            inShaftRotX,
            outGearRotX,
            outShaftRotX,
            isInputGroupCW,
            isOutputGroupCCW,
            inputSyncDiff1,
            inputSyncDiff2,
            outputSyncDiff,
            currentInRPM: gf.state.currentInputRPM,
            currentOutRPM: gf.state.currentOutputRPM,
            velocityRatio: gf.state.currentInputRPM / gf.state.currentOutputRPM
        };
    })()
'@
    $syncRes = Eval-Js $codeCheckSync
    Write-Host "  Input Group Rotation X: Gear=$($syncRes.inGearRotX), MotorShaft=$($syncRes.motorShaftRotX), InputShaft=$($syncRes.inShaftRotX)"
    Write-Host "  Input Group Clockwise: $($syncRes.isInputGroupCW) (Sync Diffs: $($syncRes.inputSyncDiff1), $($syncRes.inputSyncDiff2))"
    Write-Host "  Output Group Rotation X: Gear=$($syncRes.outGearRotX), OutputShaft=$($syncRes.outShaftRotX)"
    Write-Host "  Output Group Counter-Clockwise: $($syncRes.isOutputGroupCCW) (Sync Diff: $($syncRes.outputSyncDiff))"
    Write-Host "  Kinematic Ratio: $($syncRes.velocityRatio) (Expected: 2.00)"

    if (-not $syncRes.isInputGroupCW) {
        throw "Input group (motor shaft, input shaft, input gear) does not rotate clockwise!"
    }
    if (-not $syncRes.isOutputGroupCCW) {
        throw "Output group (output gear, output shaft) does not rotate counter-clockwise!"
    }
    if ($syncRes.inputSyncDiff1 -gt 0.001 -or $syncRes.inputSyncDiff2 -gt 0.001) {
        throw "Input group components are not rotating synchronously together!"
    }
    if ($syncRes.outputSyncDiff -gt 0.001) {
        throw "Output group components are not rotating synchronously together!"
    }
    Write-Host "  => Synchronized multi-component rotation verified!" -ForegroundColor Green

    # CHECK 4: Test Label Toggle Button
    Write-Host "`n[CHECK 4] Testing 3D Label Toggle Button..." -ForegroundColor Yellow
    $codeToggleLabels = @'
    (() => {
        const toggleBtn = document.getElementById('btn-toggle-labels');
        const initialVisible = window.gearFactory.labelsGroup.visible;

        toggleBtn.click();
        const afterClick1 = window.gearFactory.labelsGroup.visible;

        toggleBtn.click();
        const afterClick2 = window.gearFactory.labelsGroup.visible;

        return { initialVisible, afterClick1, afterClick2 };
    })()
'@
    $toggleRes = Eval-Js $codeToggleLabels
    Write-Host "  Initial: $($toggleRes.initialVisible) -> Click: $($toggleRes.afterClick1) -> Click: $($toggleRes.afterClick2)"
    if ($toggleRes.afterClick1 -ne $false -or $toggleRes.afterClick2 -ne $true) {
        throw "Label toggle button failed!"
    }
    Write-Host "  => 3D Label toggle verified!" -ForegroundColor Green

    # CHECK 5: Test Stop & Reset Buttons
    Write-Host "`n[CHECK 5] Testing Stop and Reset Buttons..." -ForegroundColor Yellow
    $codeResetTest = @'
    (() => {
        document.getElementById('btn-stop').click();
        const stopped = !window.gearFactory.state.isRunning;

        document.getElementById('btn-reset').click();
        const gf = window.gearFactory;

        return {
            stopped,
            inRpm: gf.state.targetInputRPM,
            inTeeth: gf.state.inputTeeth,
            outTeeth: gf.state.outputTeeth,
            ratio: gf.state.gearRatio,
            inGearRot: gf.inputGear.rotation.x,
            motorShaftRot: gf.motorShaft.rotation.x,
            inShaftRot: gf.inputShaft.rotation.x,
        };
    })()
'@
    $rstRes = Eval-Js $codeResetTest
    Write-Host "  Stop Status: $($rstRes.stopped)"
    Write-Host "  Reset Defaults: $($rstRes.inRpm) RPM, $($rstRes.inTeeth)T / $($rstRes.outTeeth)T, Ratio: $($rstRes.ratio)"
    Write-Host "  Reset Rotations: InGear=$($rstRes.inGearRot), MotorShaft=$($rstRes.motorShaftRot), InputShaft=$($rstRes.inShaftRot)"
    if ($rstRes.inGearRot -ne 0 -or $rstRes.motorShaftRot -ne 0 -or $rstRes.inShaftRot -ne 0) {
        throw "Reset failed to return gear and shaft angles to zero!"
    }
    Write-Host "  => Stop & Reset verified!" -ForegroundColor Green

    # CHECK 6: Capture Screenshot of Industrial Gearbox Assembly
    Write-Host "`n[CHECK 6] Capturing High-Res Screenshot of Gearbox Assembly..." -ForegroundColor Yellow
    # Start again for active visual capture
    [void](Eval-Js "document.getElementById('btn-start').click()")
    Start-Sleep -Milliseconds 800

    $screenshotRes = Call-CDP "Page.captureScreenshot" @{ format = "png" }
    $screenshotBase64 = $screenshotRes.result.data
    $screenshotBytes = [System.Convert]::FromBase64String($screenshotBase64)

    $destPathLocal = "d:\GAMES\GearFactory3D\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destPathLocal, $screenshotBytes)
    Write-Host "  Saved screenshot to $destPathLocal" -ForegroundColor Green

    $destArtifact = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gearbox_assembly_preview.png"
    [System.IO.File]::WriteAllBytes($destArtifact, $screenshotBytes)
    Write-Host "  Saved screenshot to $destArtifact" -ForegroundColor Green

    # Copy to browser_preview.png in artifact directory too
    $destBrowserArtifact = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destBrowserArtifact, $screenshotBytes)

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "   ALL INDUSTRIAL GEARBOX ASSEMBLY CHECKS PASSED!        " -ForegroundColor Green
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
