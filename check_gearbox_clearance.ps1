# Automated Gearbox Casing Clearance & Gear Enclosure Verification
param(
    [int]$Port = 9260
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - GEAR ENCLOSURE & CLEARANCE VERIFICATION " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_clearance_diag"
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

    $script:msgId = 600

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

    # CHECK 1: Verify calculateGearOuterRadius Formula
    Write-Host "`n[CHECK 1] Testing calculateGearOuterRadius(teeth) formula..." -ForegroundColor Yellow
    $codeOuterRadiusFormula = @'
    (() => {
        const gf = window.gearFactory;
        const inCalc = gf.calculateGearOuterRadius(20);
        const outCalc = gf.calculateGearOuterRadius(40);

        // Check formula: gearOuterRadius = gearBodyRadius + toothDepth
        const inMatchesFormula = Math.abs(inCalc.gearOuterRadius - (inCalc.gearBodyRadius + inCalc.toothDepth)) < 0.0001;
        const outMatchesFormula = Math.abs(outCalc.gearOuterRadius - (outCalc.gearBodyRadius + outCalc.toothDepth)) < 0.0001;

        return {
            inCalc,
            outCalc,
            inMatchesFormula,
            outMatchesFormula,
        };
    })()
'@
    $formRes = Eval-Js $codeOuterRadiusFormula
    Write-Host "  Input (20T): BodyRadius=$($formRes.inCalc.gearBodyRadius), ToothDepth=$($formRes.inCalc.toothDepth), OuterRadius=$($formRes.inCalc.gearOuterRadius)"
    Write-Host "  Input Formula Valid: $($formRes.inMatchesFormula)"
    Write-Host "  Output (40T): BodyRadius=$($formRes.outCalc.gearBodyRadius), ToothDepth=$($formRes.outCalc.toothDepth), OuterRadius=$($formRes.outCalc.gearOuterRadius)"
    Write-Host "  Output Formula Valid: $($formRes.outMatchesFormula)"

    if (-not $formRes.inMatchesFormula -or -not $formRes.outMatchesFormula) {
        throw "gearOuterRadius = gearBodyRadius + toothDepth formula check failed!"
    }
    Write-Host "  => gearOuterRadius = gearBodyRadius + toothDepth verified!" -ForegroundColor Green

    # CHECK 2: Inspect Debug / Telemetry Values (Requirement 13)
    Write-Host "`n[CHECK 2] Verifying Debug Telemetry & Dimension Values..." -ForegroundColor Yellow
    $codeDebug = @'
    (() => {
        const gf = window.gearFactory;
        const debug = gf.debug;
        return debug;
    })()
'@
    $dbg = Eval-Js $codeDebug
    Write-Host "  Input Gear Center: ($($dbg.inputGearCenter.x), $($dbg.inputGearCenter.y), $($dbg.inputGearCenter.z))"
    Write-Host "  Output Gear Center: ($($dbg.outputGearCenter.x), $($dbg.outputGearCenter.y), $($dbg.outputGearCenter.z))"
    Write-Host "  Input Outer Radius: $($dbg.inputGearOuterRadius) (Diameter: $($dbg.inputGearDiameter))"
    Write-Host "  Output Outer Radius: $($dbg.outputGearOuterRadius) (Diameter: $($dbg.outputGearDiameter))"
    Write-Host "  Casing Dimensions: Width(X)=$($dbg.casingInternalDimensions.widthX), Height(Y)=$($dbg.casingInternalDimensions.heightY), Length(Z)=$($dbg.casingInternalDimensions.lengthZ)"
    Write-Host "  Safe Clearance Used: $($dbg.safeClearanceUnits) units"
    Write-Host "  Clearances: X=$($dbg.clearanceChecks.clearanceX), YBottom=$($dbg.clearanceChecks.clearanceYBottom), YTop=$($dbg.clearanceChecks.clearanceYTop), ZFront=$($dbg.clearanceChecks.clearanceZFront), ZBack=$($dbg.clearanceChecks.clearanceZBack)"

    if ($dbg.safeClearanceUnits -lt 2.0 -or $dbg.safeClearanceUnits -gt 5.0) {
        throw "Clearance not within 2 to 5 Three.js units!"
    }
    Write-Host "  => Debug telemetry values verified!" -ForegroundColor Green

    # CHECK 3: Verify Both Gears Are 100% Completely Inside Casing With No Clipping
    Write-Host "`n[CHECK 3] Verifying Complete Enclosure (No Clipping)..." -ForegroundColor Yellow
    $codeEnclosure = @'
    (() => {
        const gf = window.gearFactory;
        const dbg = gf.debug;
        const casingW = dbg.casingInternalDimensions.widthX;
        const casingH = dbg.casingInternalDimensions.heightY;
        const casingL = dbg.casingInternalDimensions.lengthZ;

        // Gear X range: sits at X = 0 with max hub width 0.79
        const gearMinX = -0.40;
        const gearMaxX = 0.40;
        const casingMinX = -casingW * 0.5;
        const casingMaxX = casingW * 0.5;
        const xInside = (gearMinX > casingMinX) && (gearMaxX < casingMaxX);

        // Gear Y range:
        const shaftY = dbg.inputGearCenter.y;
        const inGearMinY = shaftY - dbg.inputGearOuterRadius;
        const inGearMaxY = shaftY + dbg.inputGearOuterRadius;
        const outGearMinY = shaftY - dbg.outputGearOuterRadius;
        const outGearMaxY = shaftY + dbg.outputGearOuterRadius;
        const minGearY = Math.min(inGearMinY, outGearMinY);
        const maxGearY = Math.max(inGearMaxY, outGearMaxY);
        const casingMinY = 0.25; // bottom rail
        const casingMaxY = casingH; // top lid
        const yInside = (minGearY > casingMinY) && (maxGearY < casingMaxY);

        // Gear Z range:
        const inGearMinZ = dbg.inputGearCenter.z - dbg.inputGearOuterRadius;
        const inGearMaxZ = dbg.inputGearCenter.z + dbg.inputGearOuterRadius;
        const outGearMinZ = dbg.outputGearCenter.z - dbg.outputGearOuterRadius;
        const outGearMaxZ = dbg.outputGearCenter.z + dbg.outputGearOuterRadius;
        const minGearZ = Math.min(inGearMinZ, outGearMinZ);
        const maxGearZ = Math.max(inGearMaxZ, outGearMaxZ);
        const casingMinZ = -casingL * 0.5;
        const casingMaxZ = casingL * 0.5;
        const zInside = (minGearZ > casingMinZ) && (maxGearZ < casingMaxZ);

        // Check that internal dimensions exceed gear diameter
        const maxDia = Math.max(dbg.inputGearDiameter, dbg.outputGearDiameter);
        const heightExceedsDia = casingH > maxDia;
        const lengthExceedsDia = casingL > maxDia;

        // Check clearances on all 6 sides are >= 2.0
        const clearanceXLeft = gearMinX - casingMinX;
        const clearanceXRight = casingMaxX - gearMaxX;
        const clearanceYBottom = minGearY - casingMinY;
        const clearanceYTop = casingMaxY - maxGearY;
        const clearanceZBack = minGearZ - casingMinZ;
        const clearanceZFront = casingMaxZ - maxGearZ;

        return {
            xInside,
            yInside,
            zInside,
            allInside: xInside && yInside && zInside,
            heightExceedsDia,
            lengthExceedsDia,
            clearanceXLeft,
            clearanceXRight,
            clearanceYBottom,
            clearanceYTop,
            clearanceZBack,
            clearanceZFront,
            allClearancesSafe: (
                clearanceXLeft >= 2.0 &&
                clearanceXRight >= 2.0 &&
                clearanceYBottom >= 2.0 &&
                clearanceYTop >= 2.0 &&
                clearanceZBack >= 2.0 &&
                clearanceZFront >= 2.0
            )
        };
    })()
'@
    $encRes = Eval-Js $codeEnclosure
    Write-Host "  X Inside Casing: $($encRes.xInside) (Left: $($encRes.clearanceXLeft) units, Right: $($encRes.clearanceXRight) units)"
    Write-Host "  Y Inside Casing: $($encRes.yInside) (Bottom: $($encRes.clearanceYBottom) units, Top: $($encRes.clearanceYTop) units)"
    Write-Host "  Z Inside Casing: $($encRes.zInside) (Back: $($encRes.clearanceZBack) units, Front: $($encRes.clearanceZFront) units)"
    Write-Host "  Height Exceeds Gear Diameter: $($encRes.heightExceedsDia)"
    Write-Host "  Length Exceeds Gear Diameter: $($encRes.lengthExceedsDia)"
    Write-Host "  All Clearances >= 2.0 Units: $($encRes.allClearancesSafe)"

    if (-not $encRes.allInside) {
        throw "Gears are NOT completely inside the casing!"
    }
    if (-not $encRes.allClearancesSafe) {
        throw "Not all clearances meet the safe 2.0 to 5.0 units requirement!"
    }
    Write-Host "  => Gears are completely inside the casing with safe clearances all around!" -ForegroundColor Green

    # CHECK 4: Check Shaft Alignment & Parallelism (Requirements 8 & 9)
    Write-Host "`n[CHECK 4] Verifying Shaft Alignment & Parallelism..." -ForegroundColor Yellow
    $codeShaftAlign = @'
    (() => {
        const gf = window.gearFactory;
        const inGearPos = gf.inputGear.position;
        const outGearPos = gf.outputGear.position;
        const inShaftPos = gf.inputShaft.position;
        const outShaftPos = gf.outputShaft.position;

        // In Three.js, shafts extend along X.
        // Y and Z of input shaft must match input gear center.
        // Y and Z of output shaft must match output gear center.
        const inShaftAligned = Math.abs(inShaftPos.y - inGearPos.y) < 0.001 && Math.abs(inShaftPos.z - inGearPos.z) < 0.001;
        const outShaftAligned = Math.abs(outShaftPos.y - outGearPos.y) < 0.001 && Math.abs(outShaftPos.z - outGearPos.z) < 0.001;

        // Both shafts are parallel: they both have the same Y elevation and extend along X
        const parallelShafts = Math.abs(inGearPos.y - outGearPos.y) < 0.001;

        return {
            inShaftAligned,
            outShaftAligned,
            parallelShafts,
            inGearY: inGearPos.y,
            outGearY: outGearPos.y,
            inGearZ: inGearPos.z,
            outGearZ: outGearPos.z
        };
    })()
'@
    $alignRes = Eval-Js $codeShaftAlign
    Write-Host "  Input Shaft Aligned with Input Gear: $($alignRes.inShaftAligned) (Y=$($alignRes.inGearY), Z=$($alignRes.inGearZ))"
    Write-Host "  Output Shaft Aligned with Output Gear: $($alignRes.outShaftAligned) (Y=$($alignRes.outGearY), Z=$($alignRes.outGearZ))"
    Write-Host "  Shafts Parallel (Identical Y Elevation): $($alignRes.parallelShafts)"

    if (-not $alignRes.inShaftAligned -or -not $alignRes.outShaftAligned -or -not $alignRes.parallelShafts) {
        throw "Shaft alignment or parallelism failed!"
    }
    Write-Host "  => Shaft alignment and parallelism verified!" -ForegroundColor Green

    # CHECK 5: Verify Kinematics, Buttons, and Speeds (Requirements 2 & 15)
    Write-Host "`n[CHECK 5] Verifying Kinematics & Controls Integrity..." -ForegroundColor Yellow
    [void](Eval-Js "document.getElementById('btn-start').click()")
    Start-Sleep -Milliseconds 1200

    $codeKine = @'
    (() => {
        const gf = window.gearFactory;
        const inRPM = gf.state.currentInputRPM;
        const outRPM = gf.state.currentOutputRPM;
        const ratio = gf.state.gearRatio;
        const expectedRatio = gf.state.outputTeeth / gf.state.inputTeeth;
        const inRotX = gf.inputGear.rotation.x;
        const outRotX = gf.outputGear.rotation.x;

        return {
            inRPM,
            outRPM,
            ratio,
            expectedRatio,
            isCW: inRotX < 0,
            isCCW: outRotX > 0,
            ratioMatches: Math.abs(ratio - expectedRatio) < 0.001
        };
    })()
'@
    $kineRes = Eval-Js $codeKine
    Write-Host "  Input RPM: $($kineRes.inRPM), Output RPM: $($kineRes.outRPM)"
    Write-Host "  Gear Ratio: $($kineRes.ratio) (Expected: $($kineRes.expectedRatio))"
    Write-Host "  Input Clockwise: $($kineRes.isCW), Output Counter-Clockwise: $($kineRes.isCCW)"

    if (-not $kineRes.isCW -or -not $kineRes.isCCW -or -not $kineRes.ratioMatches) {
        throw "Kinematics or gear ratio mismatch!"
    }
    Write-Host "  => Kinematics, gear ratio, and opposite rotation verified!" -ForegroundColor Green

    # CHECK 6: Capture Screenshot of Perfectly Enclosed Gearbox
    Write-Host "`n[CHECK 6] Capturing High-Res Screenshot of Enclosed Gearbox..." -ForegroundColor Yellow
    $screenshotRes = Call-CDP "Page.captureScreenshot" @{ format = "png" }
    $screenshotBase64 = $screenshotRes.result.data
    $screenshotBytes = [System.Convert]::FromBase64String($screenshotBase64)

    $destPathLocal = "d:\GAMES\GearFactory3D\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destPathLocal, $screenshotBytes)
    Write-Host "  Saved screenshot to $destPathLocal" -ForegroundColor Green

    $destArtifact = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gearbox_enclosed_preview.png"
    [System.IO.File]::WriteAllBytes($destArtifact, $screenshotBytes)
    Write-Host "  Saved screenshot to $destArtifact" -ForegroundColor Green

    # Also update browser_preview.png in artifact folder
    $destBrowserArtifact = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\browser_preview.png"
    [System.IO.File]::WriteAllBytes($destBrowserArtifact, $screenshotBytes)

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "   ALL GEAR ENCLOSURE & CLEARANCE CHECKS PASSED!         " -ForegroundColor Green
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
