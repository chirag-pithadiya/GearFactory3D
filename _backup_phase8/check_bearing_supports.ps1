# check_bearing_supports.ps1
# Automated Headless Chrome CDP Verification for Realistic Bearing Supports
param(
  [int]$Port = 9275,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - BEARING SUPPORTS VERIFICATION " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Find Chrome
$chromePaths = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromePath = $null
foreach ($p in $chromePaths) {
  if (Test-Path $p) { $chromePath = $p; break }
}
if (-not $chromePath) {
  Write-Error "Google Chrome executable not found."
}

$userDir = Join-Path $env:TEMP "gear_bearings_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
$chromeProcess = Start-Process -FilePath $chromePath -ArgumentList @(
  "--headless=new",
  "--remote-debugging-port=$Port",
  "--remote-debugging-address=127.0.0.1",
  "--user-data-dir=$userDir",
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1400,900",
  $Url
) -PassThru

Write-Host "Launched headless Chrome (PID $($chromeProcess.Id)) on port $Port"

try {
  Start-Sleep -Seconds 2

  # Query /json
  $tab = $null
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $json = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -Method Get -TimeoutSec 2
      $tab = $json | Where-Object { $_.type -eq "page" -and $_.url -like "*8088*" } | Select-Object -First 1
      if ($tab) { break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $tab) {
    Write-Error "Could not connect to Chrome page tab."
  }

  $wsUrl = $tab.webSocketDebuggerUrl
  Write-Host "Connecting to WebSocket: $wsUrl"

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $cts = New-Object System.Threading.CancellationTokenSource
  $cts.CancelAfter(15000)
  $ws.ConnectAsync([System.Uri]$wsUrl, $cts.Token).Wait()

  $msgId = 1
  function Send-CDP([string]$method, [hashtable]$params = @{}) {
    $script:msgId++
    $id = $script:msgId
    $req = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($req)
    $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

    $buf = New-Object byte[] 65536
    $ms = New-Object System.IO.MemoryStream
    do {
      $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
      $res = $ws.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).Result
      $ms.Write($buf, 0, $res.Count)
    } while (-not $res.EndOfMessage)

    $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
    return ($raw | ConvertFrom-Json)
  }

  function Exec-Eval([string]$expression) {
    $r = Send-CDP "Runtime.evaluate" @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
    if ($r.result.exceptionDetails) {
      Write-Error "JS Error: $($r.result.exceptionDetails.exception.description)"
    }
    return $r.result.result.value
  }

  # Wait for gearFactory
  Start-Sleep -Seconds 2

  Write-Host "`n[CHECK 1] Testing Reusable Bearing & Support Functions..." -ForegroundColor Yellow
  $fnCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const b = gf.createBearing({ innerRadius: 0.33, outerRadius: 0.70 });
    const h = gf.createBearingHousing({ bearingOuterRadius: 0.70 });
    const s = gf.createShaftSupport({ shaftRadius: 0.32 });
    return {
      hasCreateBearing: typeof gf.createBearing === 'function',
      hasCreateBearingHousing: typeof gf.createBearingHousing === 'function',
      hasCreateShaftSupport: typeof gf.createShaftSupport === 'function',
      bearingType: b.userData?.type,
      housingType: h.userData?.type,
      supportType: s.userData?.type,
      hasInnerRing: !!b.userData?.innerRingGroup,
      hasOuterRing: !!b.userData?.outerRingGroup,
      hasBalls: !!b.userData?.ballsGroup,
    };
  })()
"@
  Write-Host "  createBearing(): $($fnCheck.hasCreateBearing) (type: $($fnCheck.bearingType))"
  Write-Host "  createBearingHousing(): $($fnCheck.hasCreateBearingHousing) (type: $($fnCheck.housingType))"
  Write-Host "  createShaftSupport(): $($fnCheck.hasCreateShaftSupport) (type: $($fnCheck.supportType))"
  Write-Host "  Bearing Components: InnerRing=$($fnCheck.hasInnerRing), OuterRing=$($fnCheck.hasOuterRing), Balls=$($fnCheck.hasBalls)"
  if (-not ($fnCheck.hasCreateBearing -and $fnCheck.hasCreateBearingHousing -and $fnCheck.hasCreateShaftSupport -and $fnCheck.hasInnerRing -and $fnCheck.hasOuterRing)) {
    Write-Error "Check 1 Failed: Functions or components missing."
  }
  Write-Host "  => Reusable bearing functions verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 2] Verifying Bearing Support Arrangement & Axes Alignment..." -ForegroundColor Yellow
  $arrCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const supports = gf.bearingSupports || [];
    const inL = gf.inputSupportLeft;
    const inR = gf.inputSupportRight;
    const outL = gf.outputSupportLeft;
    const outR = gf.outputSupportRight;

    return {
      count: supports.length,
      inLeftPos: { x: inL?.position.x, y: inL?.position.y, z: inL?.position.z },
      inRightPos: { x: inR?.position.x, y: inR?.position.y, z: inR?.position.z },
      outLeftPos: { x: outL?.position.x, y: outL?.position.y, z: outL?.position.z },
      outRightPos: { x: outR?.position.x, y: outR?.position.y, z: outR?.position.z },
      inputShaftY: gf.inputShaft?.position.y,
      inputShaftZ: gf.inputShaft?.position.z,
      outputShaftY: gf.outputShaft?.position.y,
      outputShaftZ: gf.outputShaft?.position.z,
    };
  })()
"@
  Write-Host "  Bearing Support Count: $($arrCheck.count) (Expected: 4)"
  Write-Host "  Input Left Support: ($($arrCheck.inLeftPos.x), $($arrCheck.inLeftPos.y), $($arrCheck.inLeftPos.z))"
  Write-Host "  Input Right Support: ($($arrCheck.inRightPos.x), $($arrCheck.inRightPos.y), $($arrCheck.inRightPos.z))"
  Write-Host "  Output Left Support: ($($arrCheck.outLeftPos.x), $($arrCheck.outLeftPos.y), $($arrCheck.outLeftPos.z))"
  Write-Host "  Output Right Support: ($($arrCheck.outRightPos.x), $($arrCheck.outRightPos.y), $($arrCheck.outRightPos.z))"

  # Verify alignment with shaft axes
  $inAligned = ([Math]::Abs($arrCheck.inLeftPos.y - $arrCheck.inputShaftY) -lt 0.01) -and ([Math]::Abs($arrCheck.inLeftPos.z - $arrCheck.inputShaftZ) -lt 0.01)
  $outAligned = ([Math]::Abs($arrCheck.outLeftPos.y - $arrCheck.outputShaftY) -lt 0.01) -and ([Math]::Abs($arrCheck.outLeftPos.z - $arrCheck.outputShaftZ) -lt 0.01)
  Write-Host "  Input Bearings Aligned with Input Shaft: $inAligned"
  Write-Host "  Output Bearings Aligned with Output Shaft: $outAligned"
  if (-not ($arrCheck.count -eq 4 -and $inAligned -and $outAligned)) {
    Write-Error "Check 2 Failed: Bearing supports not properly arranged or aligned."
  }
  Write-Host "  => Bearing support arrangement & shaft alignment verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 3] Verifying Gear Clearance (Zero Overlap with Gears)..." -ForegroundColor Yellow
  $clearCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const inL = gf.inputSupportLeft;
    const inR = gf.inputSupportRight;
    const gearX = gf.inputGear?.position.x || 0;
    const hubThickness = 0.79;
    const halfHub = hubThickness * 0.5;

    // Minimum distance from bearing to gear hub
    const distL = Math.abs(inL.position.x - (gearX - halfHub));
    const distR = Math.abs(inR.position.x - (gearX + halfHub));

    return {
      gearCenter: gearX,
      halfHub: halfHub,
      bearingLeftX: inL.position.x,
      bearingRightX: inR.position.x,
      distToLeftHub: distL,
      distToRightHub: distR,
      noOverlap: distL > 1.5 && distR > 1.5,
    };
  })()
"@
  Write-Host "  Gear Hub Span along X: [-$($clearCheck.halfHub), +$($clearCheck.halfHub)]"
  Write-Host "  Left Bearing X: $($clearCheck.bearingLeftX), Clearance to Gear: $($clearCheck.distToLeftHub) units"
  Write-Host "  Right Bearing X: $($clearCheck.bearingRightX), Clearance to Gear: $($clearCheck.distToRightHub) units"
  Write-Host "  Zero Overlap Verified: $($clearCheck.noOverlap)"
  if (-not $clearCheck.noOverlap) {
    Write-Error "Check 3 Failed: Bearings overlap gears."
  }
  Write-Host "  => Zero gear overlap confirmed!" -ForegroundColor Green

  Write-Host "`n[CHECK 4] Testing Shaft & Bearing Kinematics (Inner Rings Rotate, Housings Stationary)..." -ForegroundColor Yellow
  # Start the gearbox simulation
  Exec-Eval "document.getElementById('btn-start').click();"
  Start-Sleep -Seconds 2

  $kinCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const inShaft = gf.inputShaft;
    const outShaft = gf.outputShaft;
    const inL = gf.inputSupportLeft;
    const outL = gf.outputSupportLeft;

    const inHousingRot = inL?.userData?.housing?.rotation.x || 0;
    const inOuterRot = inL?.userData?.outerRing?.rotation.x || 0;
    const inInnerRot = inL?.userData?.innerRing?.rotation.x || 0;
    const inShaftRot = inShaft?.rotation.x || 0;

    const outHousingRot = outL?.userData?.housing?.rotation.x || 0;
    const outOuterRot = outL?.userData?.outerRing?.rotation.x || 0;
    const outInnerRot = outL?.userData?.innerRing?.rotation.x || 0;
    const outShaftRot = outShaft?.rotation.x || 0;

    return {
      isRunning: gf.state.isRunning,
      inputRPM: gf.state.currentInputRPM,
      outputRPM: gf.state.currentOutputRPM,
      inShaftRot: inShaftRot,
      inInnerRot: inInnerRot,
      inOuterRot: inOuterRot,
      inHousingRot: inHousingRot,
      outShaftRot: outShaftRot,
      outInnerRot: outInnerRot,
      outOuterRot: outOuterRot,
      outHousingRot: outHousingRot,
      inInnerRotatesWithShaft: Math.abs(inInnerRot - inShaftRot) < 0.001,
      outInnerRotatesWithShaft: Math.abs(outInnerRot - outShaftRot) < 0.001,
      housingsStationary: inHousingRot === 0 && outHousingRot === 0 && inOuterRot === 0 && outOuterRot === 0,
    };
  })()
"@
  Write-Host "  Simulation Running: $($kinCheck.isRunning)"
  Write-Host "  Input RPM: $($kinCheck.inputRPM), Output RPM: $($kinCheck.outputRPM)"
  Write-Host "  Input Shaft Rot: $($kinCheck.inShaftRot), Inner Ring Rot: $($kinCheck.inInnerRot)"
  Write-Host "  Output Shaft Rot: $($kinCheck.outShaftRot), Inner Ring Rot: $($kinCheck.outInnerRot)"
  Write-Host "  Input Inner Ring Matches Shaft: $($kinCheck.inInnerRotatesWithShaft)"
  Write-Host "  Output Inner Ring Matches Shaft: $($kinCheck.outInnerRotatesWithShaft)"
  Write-Host "  Housings & Outer Rings Stationary (0 rad): $($kinCheck.housingsStationary)"

  if (-not ($kinCheck.inInnerRotatesWithShaft -and $kinCheck.outInnerRotatesWithShaft -and $kinCheck.housingsStationary)) {
    Write-Error "Check 4 Failed: Kinematic rotation rules violated."
  }
  Write-Host "  => Shaft & bearing inner ring rotation with stationary housings verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 5] Testing Reset Functionality..." -ForegroundColor Yellow
  Exec-Eval "document.getElementById('btn-reset').click();"
  Start-Sleep -Milliseconds 500

  $resetCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const inL = gf.inputSupportLeft;
    return {
      isRunning: gf.state.isRunning,
      inputRPM: gf.state.currentInputRPM,
      inInnerRot: inL?.userData?.innerRing?.rotation.x || 0,
    };
  })()
"@
  Write-Host "  After Reset: isRunning=$($resetCheck.isRunning), RPM=$($resetCheck.inputRPM), inInnerRot=$($resetCheck.inInnerRot)"
  if ($resetCheck.isRunning -or $resetCheck.inInnerRot -ne 0) {
    Write-Error "Check 5 Failed: Reset did not restore initial angles."
  }
  Write-Host "  => Reset verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 6] Capturing High-Res Screenshot of Bearing Supports Assembly..." -ForegroundColor Yellow
  # Restart rotation to capture running state
  Exec-Eval "document.getElementById('btn-start').click();"
  Start-Sleep -Seconds 1

  $shotRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $shotBytes = [System.Convert]::FromBase64String($shotRes.result.data)

  $previewPath1 = "d:\GAMES\GearFactory3D\browser_preview.png"
  $previewPath2 = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gearbox_bearings_preview.png"

  [System.IO.File]::WriteAllBytes($previewPath1, $shotBytes)
  [System.IO.File]::WriteAllBytes($previewPath2, $shotBytes)
  Write-Host "  Saved screenshot to $previewPath1"
  Write-Host "  Saved screenshot to $previewPath2"

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host "   ALL BEARING SUPPORT VERIFICATION CHECKS PASSED!        " -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green

} finally {
  if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
  }
  if ($chromeProcess -and -not $chromeProcess.HasExited) {
    Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $userDir) {
    Remove-Item -Path $userDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
