# check_puzzle_level1.ps1
# Automated Headless Chrome CDP Verification for Level 1 Puzzle System
param(
  [int]$Port = 9300,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - LEVEL 1 PUZZLE SYSTEM VERIFICATION " -ForegroundColor Cyan
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

$userDir = Join-Path $env:TEMP "gear_puzzle_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
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

  Start-Sleep -Seconds 2

  Write-Host "`n[CHECK 1] Verifying Level 1 Game Panel DOM Elements..." -ForegroundColor Yellow
  $domCheck = Exec-Eval @"
  (() => {
    const panel = document.getElementById('puzzle-panel');
    const levelPill = document.getElementById('puzzle-level-pill');
    const statusText = document.getElementById('puzzle-status-text');
    const inRpm = document.getElementById('puzzle-input-rpm');
    const curOutRpm = document.getElementById('puzzle-current-output-rpm');
    const targetOutRpm = document.getElementById('puzzle-target-output-rpm');
    const ratio = document.getElementById('puzzle-current-ratio');
    const btnCheck = document.getElementById('btn-check-solution');
    const btnReset = document.getElementById('btn-reset-level');
    const btnNext = document.getElementById('btn-next-level');

    return {
      hasPanel: !!panel,
      levelText: levelPill?.textContent.trim(),
      statusText: statusText?.textContent.trim(),
      inRpm: inRpm?.textContent.trim(),
      curOutRpm: curOutRpm?.textContent.trim(),
      targetOutRpm: targetOutRpm?.textContent.trim(),
      ratio: ratio?.textContent.trim(),
      hasBtnCheck: !!btnCheck,
      hasBtnReset: !!btnReset,
      hasBtnNext: !!btnNext,
    };
  })()
"@
  Write-Host "  Panel Exists: $($domCheck.hasPanel)"
  Write-Host "  Level Badge: $($domCheck.levelText)"
  Write-Host "  Input RPM Display: $($domCheck.inRpm)"
  Write-Host "  Current Output RPM: $($domCheck.curOutRpm)"
  Write-Host "  Target Output RPM: $($domCheck.targetOutRpm)"
  Write-Host "  Current Ratio Display: $($domCheck.ratio)"
  Write-Host "  Buttons: Check=$($domCheck.hasBtnCheck), Reset=$($domCheck.hasBtnReset), Next=$($domCheck.hasBtnNext)"

  if (-not ($domCheck.hasPanel -and $domCheck.hasBtnCheck -and $domCheck.hasBtnReset -and $domCheck.hasBtnNext)) {
    Write-Error "Check 1 Failed: DOM elements missing."
  }
  Write-Host "  => Game panel DOM verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 2] Testing Unsolved State ('Adjust the gears' & Next Level Disabled)..." -ForegroundColor Yellow
  # Intentionally change output teeth to 20 so ratio = 1:1, output RPM = 100 != 50
  $unsolvedCheck = Exec-Eval @"
  (() => {
    const outField = document.getElementById('output-teeth-field');
    outField.value = '20';
    outField.dispatchEvent(new Event('input', { bubbles: true }));

    const btnCheck = document.getElementById('btn-check-solution');
    btnCheck.click();

    const btnNext = document.getElementById('btn-next-level');
    const statusText = document.getElementById('puzzle-status-text');
    const banner = document.getElementById('puzzle-success-banner');

    return {
      statusText: statusText?.textContent.trim(),
      isNextDisabled: btnNext?.disabled,
      isBannerHidden: !banner || banner.style.display === 'none',
      outputRPM: window.gearFactory.state.targetOutputRPM,
    };
  })()
"@
  Write-Host "  Output RPM with 20T: $($unsolvedCheck.outputRPM)"
  Write-Host "  Status Text: $($unsolvedCheck.statusText) (Expected: 'Adjust the gears')"
  Write-Host "  Next Level Disabled: $($unsolvedCheck.isNextDisabled) (Expected: True)"
  Write-Host "  Success Banner Hidden: $($unsolvedCheck.isBannerHidden) (Expected: True)"

  if ($unsolvedCheck.statusText -ne "Adjust the gears" -or -not $unsolvedCheck.isNextDisabled) {
    Write-Error "Check 2 Failed: Unsolved state rules violated."
  }
  Write-Host "  => Unsolved state verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 3] Testing Solved State ('LEVEL COMPLETE', Success Banner & Next Level Enabled)..." -ForegroundColor Yellow
  # Set teeth back to Level 1 solution (20T input, 40T output at 100 RPM -> 50 RPM)
  $solvedCheck = Exec-Eval @"
  (() => {
    const inField = document.getElementById('input-teeth-field');
    const outField = document.getElementById('output-teeth-field');
    const rpmField = document.getElementById('input-rpm-field');

    rpmField.value = '100';
    inField.value = '20';
    outField.value = '40';

    rpmField.dispatchEvent(new Event('input', { bubbles: true }));
    inField.dispatchEvent(new Event('input', { bubbles: true }));
    outField.dispatchEvent(new Event('input', { bubbles: true }));

    const btnCheck = document.getElementById('btn-check-solution');
    btnCheck.click();

    const btnNext = document.getElementById('btn-next-level');
    const statusText = document.getElementById('puzzle-status-text');
    const banner = document.getElementById('puzzle-success-banner');

    return {
      outputRPM: window.gearFactory.state.targetOutputRPM,
      statusText: statusText?.textContent.trim(),
      isNextDisabled: btnNext?.disabled,
      isBannerVisible: banner && banner.style.display !== 'none',
    };
  })()
"@
  Write-Host "  Output RPM with 20T/40T: $($solvedCheck.outputRPM) (Expected: 50.0)"
  Write-Host "  Status Text: $($solvedCheck.statusText) (Expected: 'LEVEL COMPLETE')"
  Write-Host "  Next Level Disabled: $($solvedCheck.isNextDisabled) (Expected: False)"
  Write-Host "  Success Banner Visible: $($solvedCheck.isBannerVisible) (Expected: True)"

  if ($solvedCheck.statusText -ne "LEVEL COMPLETE" -or $solvedCheck.isNextDisabled -or -not $solvedCheck.isBannerVisible) {
    Write-Error "Check 3 Failed: Solved state rules violated."
  }
  Write-Host "  => Solved state & Next Level unlock verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 4] Testing Tolerance Rule (±0.5 RPM)..." -ForegroundColor Yellow
  # 99 RPM input with 20T/40T = 49.5 RPM (diff = 0.5 <= 0.5) -> Should be Complete
  # 98 RPM input with 20T/40T = 49.0 RPM (diff = 1.0 > 0.5) -> Should be Adjust
  $tolCheck = Exec-Eval @"
  (() => {
    const rpmField = document.getElementById('input-rpm-field');
    const btnCheck = document.getElementById('btn-check-solution');
    const statusText = document.getElementById('puzzle-status-text');

    // Test 49.5 RPM (within tolerance)
    rpmField.value = '99';
    rpmField.dispatchEvent(new Event('input', { bubbles: true }));
    btnCheck.click();
    const statusWithin = statusText.textContent.trim();

    // Test 49.0 RPM (outside tolerance)
    rpmField.value = '98';
    rpmField.dispatchEvent(new Event('input', { bubbles: true }));
    btnCheck.click();
    const statusOutside = statusText.textContent.trim();

    return {
      statusWithin: statusWithin,
      statusOutside: statusOutside,
      passWithin: statusWithin === 'LEVEL COMPLETE',
      passOutside: statusOutside === 'Adjust the gears',
    };
  })()
"@
  Write-Host "  At 49.5 RPM (Within ±0.5): $($tolCheck.statusWithin) (Pass: $($tolCheck.passWithin))"
  Write-Host "  At 49.0 RPM (Outside ±0.5): $($tolCheck.statusOutside) (Pass: $($tolCheck.passOutside))"

  if (-not ($tolCheck.passWithin -and $tolCheck.passOutside)) {
    Write-Error "Check 4 Failed: Tolerance check failed."
  }
  Write-Host "  => ±0.5 RPM tolerance verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 5] Testing Reset Level Button..." -ForegroundColor Yellow
  $resetLvlCheck = Exec-Eval @"
  (() => {
    const btnResetLvl = document.getElementById('btn-reset-level');
    btnResetLvl.click();

    const inField = document.getElementById('input-teeth-field');
    const outField = document.getElementById('output-teeth-field');
    const rpmField = document.getElementById('input-rpm-field');

    return {
      inputRPM: rpmField.value,
      inputTeeth: inField.value,
      outputTeeth: outField.value,
      configuredOutRPM: window.gearFactory.state.targetOutputRPM,
    };
  })()
"@
  Write-Host "  After Reset Level: RPM=$($resetLvlCheck.inputRPM), InTeeth=$($resetLvlCheck.inputTeeth), OutTeeth=$($resetLvlCheck.outputTeeth), OutRPM=$($resetLvlCheck.configuredOutRPM)"
  if ($resetLvlCheck.inputRPM -ne '100' -or $resetLvlCheck.inputTeeth -ne '20' -or $resetLvlCheck.outputTeeth -ne '40') {
    Write-Error "Check 5 Failed: Reset Level did not restore default parameters."
  }
  Write-Host "  => Reset Level verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 6] Testing Start and Stop Buttons..." -ForegroundColor Yellow
  Exec-Eval "document.getElementById('btn-start').click();"
  Start-Sleep -Seconds 1
  $runCheck = Exec-Eval "window.gearFactory.state.isRunning"
  Write-Host "  Machine running after Start: $runCheck"

  Exec-Eval "document.getElementById('btn-stop').click();"
  Start-Sleep -Milliseconds 500
  $stopCheck = Exec-Eval "window.gearFactory.state.isRunning"
  Write-Host "  Machine running after Stop: $stopCheck"

  if (-not $runCheck -or $stopCheck) {
    Write-Error "Check 6 Failed: Start and Stop controls failed."
  }
  Write-Host "  => Start & Stop buttons verified!" -ForegroundColor Green

  Write-Host "`n[CHECK 7] Capturing High-Res Screenshot of Level 1 Game Panel..." -ForegroundColor Yellow
  # Click Check Solution to ensure solved state is active
  Exec-Eval "document.getElementById('btn-check-solution').click();"
  Start-Sleep -Milliseconds 500

  $shotRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $shotBytes = [System.Convert]::FromBase64String($shotRes.result.data)

  $previewPath1 = "d:\GAMES\GearFactory3D\browser_preview.png"
  $previewPath2 = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gearbox_puzzle_level1_preview.png"

  [System.IO.File]::WriteAllBytes($previewPath1, $shotBytes)
  [System.IO.File]::WriteAllBytes($previewPath2, $shotBytes)
  Write-Host "  Saved screenshot to $previewPath1"
  Write-Host "  Saved screenshot to $previewPath2"

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host "   ALL LEVEL 1 PUZZLE SYSTEM CHECKS PASSED!               " -ForegroundColor Green
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
