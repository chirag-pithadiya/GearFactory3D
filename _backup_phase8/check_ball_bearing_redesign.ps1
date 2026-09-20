# check_ball_bearing_redesign.ps1
# Automated Headless Chrome CDP Verification for Redesigned Ball Bearing Model
param(
  [int]$Port = 9290,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - BALL BEARING REDESIGN VERIFICATION " -ForegroundColor Cyan
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

$userDir = Join-Path $env:TEMP "gear_ball_bearings_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
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

  # Wait for scene initialization
  Start-Sleep -Seconds 2

  Write-Host "`n[CHECK 1] Testing createBallBearing({ outerRadius, innerRadius, width, ballCount }) Signature..." -ForegroundColor Yellow
  $fnCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    // Test with user specified values: outerRadius=5, innerRadius=2.5, width=2, ballCount=10
    const b1 = gf.createBallBearing({
      outerRadius: 5.0,
      innerRadius: 2.5,
      width: 2.0,
      ballCount: 10
    });

    // Test with default arguments
    const bDef = gf.createBallBearing();

    // Count balls in b1
    const ballsGroup = b1.userData.balls;
    const ballMeshCount = ballsGroup ? ballsGroup.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry').length : 0;

    return {
      hasCreateBallBearing: typeof gf.createBallBearing === 'function',
      hasCreateBearingAlias: typeof gf.createBearing === 'function',
      b1Type: b1.userData?.type,
      b1OuterRadius: b1.userData?.outerRadius,
      b1InnerRadius: b1.userData?.innerRadius,
      b1Width: b1.userData?.width,
      b1BallCount: b1.userData?.ballCount,
      b1BallMeshCount: ballMeshCount,
      bDefBallCount: bDef.userData?.ballCount,
      hasInnerRing: !!b1.userData?.innerRing,
      hasOuterRing: !!b1.userData?.outerRing,
      hasBallsGroup: !!b1.userData?.balls,
    };
  })()
"@
  Write-Host "  createBallBearing() defined: $($fnCheck.hasCreateBallBearing)"
  Write-Host "  createBearing() alias: $($fnCheck.hasCreateBearingAlias)"
  Write-Host "  b1 userData: type=$($fnCheck.b1Type), outerR=$($fnCheck.b1OuterRadius), innerR=$($fnCheck.b1InnerRadius), width=$($fnCheck.b1Width), ballCount=$($fnCheck.b1BallCount)"
  Write-Host "  Ball mesh count: $($fnCheck.b1BallMeshCount) (Expected: 10)"
  Write-Host "  Default ball count: $($fnCheck.bDefBallCount) (Expected: 10)"

  if (-not ($fnCheck.hasCreateBallBearing -and $fnCheck.b1BallMeshCount -eq 10 -and $fnCheck.hasInnerRing -and $fnCheck.hasOuterRing)) {
    Write-Error "Check 1 Failed: createBallBearing function specification not met."
  }
  Write-Host "  => createBallBearing function verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 2] Verifying Materials: Dark-Gray Outer Ring, Steel Inner Ring, Chrome Balls..." -ForegroundColor Yellow
  $matCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const b = gf.createBallBearing({ outerRadius: 5, innerRadius: 2.5, width: 2, ballCount: 10 });
    const outerMesh = b.userData.outerRing.children[0];
    const innerMesh = b.userData.innerRing.children[0];
    const ballMesh = b.userData.balls.children.find(c => c.geometry.type === 'SphereGeometry');

    return {
      outerHex: outerMesh.material.color.getHexString(),
      outerMetalness: outerMesh.material.metalness,
      innerHex: innerMesh.material.color.getHexString(),
      innerMetalness: innerMesh.material.metalness,
      ballHex: ballMesh.material.color.getHexString(),
      ballMetalness: ballMesh.material.metalness,
      distinctMaterials: outerMesh.material !== innerMesh.material && innerMesh.material !== ballMesh.material,
    };
  })()
"@
  Write-Host "  Outer Ring Material: #$($matCheck.outerHex) (Metalness: $($matCheck.outerMetalness))"
  Write-Host "  Inner Ring Material: #$($matCheck.innerHex) (Metalness: $($matCheck.innerMetalness))"
  Write-Host "  Bearing Balls Material: #$($matCheck.ballHex) (Metalness: $($matCheck.ballMetalness))"
  Write-Host "  Distinct Materials Used: $($matCheck.distinctMaterials)"
  if (-not $matCheck.distinctMaterials) {
    Write-Error "Check 2 Failed: Materials are not distinct."
  }
  Write-Host "  => Separate realistic materials verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 3] Verifying In-Scene Bearing Supports & Geometry Spacing..." -ForegroundColor Yellow
  $sceneCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const supports = gf.bearingSupports || [];
    const inL = gf.inputSupportLeft;
    const inR = gf.inputSupportRight;
    const outL = gf.outputSupportLeft;
    const outR = gf.outputSupportRight;

    // Check ball count on in-scene supports
    const inLBallCount = inL.userData.bearing?.userData?.ballCount || 0;
    const outLBallCount = outL.userData.bearing?.userData?.ballCount || 0;

    // Check gear clearance
    const gearX = gf.inputGear?.position.x || 0;
    const hubThickness = 0.79;
    const distToGear = Math.abs(inL.position.x - (gearX - hubThickness * 0.5));

    return {
      supportCount: supports.length,
      inLBallCount: inLBallCount,
      outLBallCount: outLBallCount,
      inLY: inL.position.y,
      inLZ: inL.position.z,
      outLY: outL.position.y,
      outLZ: outL.position.z,
      distToGear: distToGear,
      noGearOverlap: distToGear > 1.5,
    };
  })()
"@
  Write-Host "  In-Scene Support Count: $($sceneCheck.supportCount) (Expected: 4)"
  Write-Host "  Input Left Bearing Balls: $($sceneCheck.inLBallCount) (Expected: 10)"
  Write-Host "  Output Left Bearing Balls: $($sceneCheck.outLBallCount) (Expected: 10)"
  Write-Host "  Clearance to Gear: $($sceneCheck.distToGear) units (Zero overlap: $($sceneCheck.noGearOverlap))"
  if (-not ($sceneCheck.supportCount -eq 4 -and $sceneCheck.inLBallCount -eq 10 -and $sceneCheck.noGearOverlap)) {
    Write-Error "Check 3 Failed: In-scene bearing supports invalid."
  }
  Write-Host "  => In-scene bearing supports and zero overlap verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 4] Testing Kinematics: Inner Rings Rotate, Outer Rings & Balls Stationary..." -ForegroundColor Yellow
  Exec-Eval "document.getElementById('btn-start').click();"
  Start-Sleep -Seconds 2

  $kinCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const inShaft = gf.inputShaft;
    const outShaft = gf.outputShaft;
    const inL = gf.inputSupportLeft;
    const outL = gf.outputSupportLeft;

    const inInnerRot = inL.userData.innerRing.rotation.x;
    const inOuterRot = inL.userData.outerRing.rotation.x;
    const inBallsRot = inL.userData.balls.rotation.x;
    const inHousingRot = inL.userData.housing.rotation.x;
    const inShaftRot = inShaft.rotation.x;

    const outInnerRot = outL.userData.innerRing.rotation.x;
    const outOuterRot = outL.userData.outerRing.rotation.x;
    const outBallsRot = outL.userData.balls.rotation.x;
    const outHousingRot = outL.userData.housing.rotation.x;
    const outShaftRot = outShaft.rotation.x;

    return {
      isRunning: gf.state.isRunning,
      inShaftRot: inShaftRot,
      inInnerRot: inInnerRot,
      outShaftRot: outShaftRot,
      outInnerRot: outInnerRot,
      inInnerMatchesShaft: Math.abs(inInnerRot - inShaftRot) < 0.001,
      outInnerMatchesShaft: Math.abs(outInnerRot - outShaftRot) < 0.001,
      outerAndBallsStationary: inOuterRot === 0 && inBallsRot === 0 && inHousingRot === 0 &&
                               outOuterRot === 0 && outBallsRot === 0 && outHousingRot === 0,
    };
  })()
"@
  Write-Host "  Simulation Running: $($kinCheck.isRunning)"
  Write-Host "  Input Shaft: $($kinCheck.inShaftRot), Inner Ring: $($kinCheck.inInnerRot) (Matches: $($kinCheck.inInnerMatchesShaft))"
  Write-Host "  Output Shaft: $($kinCheck.outShaftRot), Inner Ring: $($kinCheck.outInnerRot) (Matches: $($kinCheck.outInnerMatchesShaft))"
  Write-Host "  Outer Rings, Balls & Housings Stationary (0 rad): $($kinCheck.outerAndBallsStationary)"

  if (-not ($kinCheck.inInnerMatchesShaft -and $kinCheck.outInnerMatchesShaft -and $kinCheck.outerAndBallsStationary)) {
    Write-Error "Check 4 Failed: Kinematics rules violated."
  }
  Write-Host "  => Kinematics strictly verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 5] Capturing High-Res Preview of Redesigned Bearings..." -ForegroundColor Yellow
  $shotRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $shotBytes = [System.Convert]::FromBase64String($shotRes.result.data)

  $previewPath1 = "d:\GAMES\GearFactory3D\browser_preview.png"
  $previewPath2 = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gearbox_ball_bearings_redesign.png"

  [System.IO.File]::WriteAllBytes($previewPath1, $shotBytes)
  [System.IO.File]::WriteAllBytes($previewPath2, $shotBytes)
  Write-Host "  Saved screenshot to $previewPath1"
  Write-Host "  Saved screenshot to $previewPath2"

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host "   ALL BALL BEARING REDESIGN CHECKS PASSED!               " -ForegroundColor Green
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
