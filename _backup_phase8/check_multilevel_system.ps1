# check_multilevel_system.ps1
# Comprehensive Headless Chrome CDP Verification for Multi-Level System (Levels 1-5)
param(
  [int]$Port = 9310,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - MULTI-LEVEL SYSTEM VERIFICATION " -ForegroundColor Cyan
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

$userDir = Join-Path $env:TEMP "gear_multilevel_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
$chromeProcess = Start-Process -FilePath $chromePath -ArgumentList @(
  "--headless=new",
  "--remote-debugging-port=$Port",
  "--remote-debugging-address=127.0.0.1",
  "--user-data-dir=$userDir",
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1440,900",
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

  Write-Host "`n[CHECK 1] Verifying Multi-Level DOM Elements & Level Indicator..." -ForegroundColor Yellow
  $domCheck = Exec-Eval @"
  (() => {
    const indicator = document.getElementById('puzzle-level-indicator');
    const prevBtn = document.getElementById('btn-prev-level');
    const nextBtn = document.getElementById('btn-next-level');
    const resetBtn = document.getElementById('btn-reset-level');
    const checkBtn = document.getElementById('btn-check-solution');
    const inTeeth = document.getElementById('puzzle-input-teeth');
    const outTeeth = document.getElementById('puzzle-output-teeth');
    const inRpm = document.getElementById('puzzle-input-rpm');
    const outRpm = document.getElementById('puzzle-current-output-rpm');
    const targetRpm = document.getElementById('puzzle-target-output-rpm');
    const ratio = document.getElementById('puzzle-current-ratio');
    const status = document.getElementById('puzzle-status-text');

    return {
      hasIndicator: !!indicator,
      indicatorText: indicator ? indicator.textContent.trim() : null,
      hasPrevBtn: !!prevBtn,
      prevDisabled: prevBtn ? prevBtn.disabled : null,
      hasNextBtn: !!nextBtn,
      nextDisabled: nextBtn ? nextBtn.disabled : null,
      hasResetBtn: !!resetBtn,
      hasCheckBtn: !!checkBtn,
      inTeethText: inTeeth ? inTeeth.textContent.trim() : null,
      outTeethText: outTeeth ? outTeeth.textContent.trim() : null,
      inRpmText: inRpm ? inRpm.textContent.trim() : null,
      outRpmText: outRpm ? outRpm.textContent.trim() : null,
      targetRpmText: targetRpm ? targetRpm.textContent.trim() : null,
      ratioText: ratio ? ratio.textContent.trim() : null,
      statusText: status ? status.textContent.trim() : null,
    };
  })()
"@

  Write-Host "Indicator Text: $($domCheck.indicatorText)"
  Write-Host "Previous Level Button Disabled: $($domCheck.prevDisabled)"
  Write-Host "Next Level Button Disabled: $($domCheck.nextDisabled)"
  Write-Host "Input Teeth: $($domCheck.inTeethText), Output Teeth: $($domCheck.outTeethText)"
  Write-Host "Target RPM: $($domCheck.targetRpmText), Current Output RPM: $($domCheck.outRpmText)"
  Write-Host "Status: $($domCheck.statusText)"

  if (-not ($domCheck.indicatorText -match "Level 1 of 5")) {
    Write-Error "Level indicator does not match 'Level 1 of 5'!"
  }
  if ($domCheck.prevDisabled -ne $true) {
    Write-Error "Previous Level button MUST be disabled on Level 1!"
  }
  Write-Host "PASS: Check 1 (DOM and Level 1 baseline OK)" -ForegroundColor Green


  Write-Host "`n[CHECK 2] Verifying levelData array specifications..." -ForegroundColor Yellow
  $levelsCheck = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    if (!gf || !gf.levelData) return { ok: false, error: 'window.gearFactory.levelData not found' };
    return {
      ok: true,
      length: gf.levelData.length,
      levels: gf.levelData,
      currentLevel: gf.currentLevel
    };
  })()
"@

  Write-Host "Total Levels Defined: $($levelsCheck.length)"
  if ($levelsCheck.length -ne 5) {
    Write-Error "Expected exactly 5 levels in levelData array!"
  }

  $expected = @(
    @{ level=1; inRPM=100; inTeeth=20; outTeeth=40; targetRPM=50 },
    @{ level=2; inRPM=120; inTeeth=20; outTeeth=30; targetRPM=80 },
    @{ level=3; inRPM=150; inTeeth=30; outTeeth=20; targetRPM=225 },
    @{ level=4; inRPM=100; inTeeth=10; outTeeth=40; targetRPM=25 },
    @{ level=5; inRPM=200; inTeeth=40; outTeeth=20; targetRPM=400 }
  )

  for ($i = 0; $i -lt 5; $i++) {
    $lvl = $levelsCheck.levels[$i]
    $exp = $expected[$i]
    Write-Host "  Level $($lvl.level): Input=$($lvl.inputRPM) RPM, Teeth=$($lvl.inputTeeth)T/$($lvl.outputTeeth)T, Target=$($lvl.targetRPM) RPM"
    if ($lvl.inputRPM -ne $exp.inRPM -or $lvl.inputTeeth -ne $exp.inTeeth -or $lvl.outputTeeth -ne $exp.outTeeth -or $lvl.targetRPM -ne $exp.targetRPM) {
      Write-Error "Level $($lvl.level) parameters mismatch! Got: $(ConvertTo-Json $lvl)"
    }
  }
  Write-Host "PASS: Check 2 (All 5 levels match exact specifications)" -ForegroundColor Green


  Write-Host "`n[CHECK 3] Testing Level Transitions (loadLevel 1 to 5)..." -ForegroundColor Yellow
  for ($lvlNum = 2; $lvlNum -le 5; $lvlNum++) {
    $res = Exec-Eval @"
    (() => {
      window.gearFactory.loadLevel($lvlNum);
      const ind = document.getElementById('puzzle-level-indicator').textContent.trim();
      const prevDis = document.getElementById('btn-prev-level').disabled;
      const nextDis = document.getElementById('btn-next-level').disabled;
      const inRpm = parseFloat(document.getElementById('input-rpm-field').value);
      const inTeeth = parseInt(document.getElementById('input-teeth-field').value, 10);
      const outTeeth = parseInt(document.getElementById('output-teeth-field').value, 10);
      const outRpm = parseFloat(document.getElementById('puzzle-current-output-rpm').textContent);
      const targetRpm = parseFloat(document.getElementById('puzzle-target-output-rpm').textContent);
      const status = document.getElementById('puzzle-status-text').textContent.trim();

      return {
        currentLevel: window.gearFactory.currentLevel,
        indicator: ind,
        prevDisabled: prevDis,
        nextDisabled: nextDis,
        inRpm: inRpm,
        inTeeth: inTeeth,
        outTeeth: outTeeth,
        outRpm: outRpm,
        targetRpm: targetRpm,
        status: status,
        isComplete: window.gearFactory.puzzle.isComplete
      };
    })()
"@

    Write-Host "Loaded Level $lvlNum -> Indicator: $($res.indicator), OutRPM: $($res.outRpm), TargetRPM: $($res.targetRpm), PrevDisabled: $($res.prevDisabled), Status: $($res.status)"
    if ($res.indicator -ne "Level $lvlNum of 5") {
      Write-Error "Level $lvlNum indicator mismatch: $($res.indicator)"
    }
    if ($res.prevDisabled -eq $true) {
      Write-Error "Previous button should be enabled on Level $lvlNum!"
    }
    if ($res.status -ne "LEVEL COMPLETE") {
      Write-Error "Level $lvlNum baseline solution should be LEVEL COMPLETE!"
    }
    if ([Math]::Abs($res.outRpm - $res.targetRpm) -gt 0.5) {
      Write-Error "Level $lvlNum output RPM ($($res.outRpm)) did not match target RPM ($($res.targetRpm)) within 0.5 RPM!"
    }
  }
  Write-Host "PASS: Check 3 (Transitions to all levels functional)" -ForegroundColor Green


  Write-Host "`n[CHECK 4] Testing Tolerance Rule (plus or minus 0.5 RPM)..." -ForegroundColor Yellow
  # Back to Level 1
  $tolCheck = Exec-Eval @"
  (() => {
    window.gearFactory.loadLevel(1); // Target is 50.0 RPM (100 RPM, 20T, 40T)

    // Test A: Perturb within tolerance (+0.4 RPM)
    // inputRPM = 100.8 -> outputRPM = 100.8 * 20 / 40 = 50.4 (diff = 0.4 <= 0.5)
    document.getElementById('input-rpm-field').value = '100.8';
    window.gearFactory.updateGearboxParameters();
    const matchWithin = window.gearFactory.puzzle.isComplete;
    const nextDisabledWithin = document.getElementById('btn-next-level').disabled;
    const statusWithin = document.getElementById('puzzle-status-text').textContent.trim();

    // Test B: Perturb outside tolerance (+1.5 RPM)
    // inputRPM = 103.0 -> outputRPM = 103.0 * 20 / 40 = 51.5 (diff = 1.5 > 0.5)
    document.getElementById('input-rpm-field').value = '103.0';
    window.gearFactory.updateGearboxParameters();
    const matchOutside = window.gearFactory.puzzle.isComplete;
    const nextDisabledOutside = document.getElementById('btn-next-level').disabled;
    const statusOutside = document.getElementById('puzzle-status-text').textContent.trim();

    // Reset back to clean Level 1
    window.gearFactory.resetLevel();

    return {
      matchWithin: matchWithin,
      nextDisabledWithin: nextDisabledWithin,
      statusWithin: statusWithin,
      matchOutside: matchOutside,
      nextDisabledOutside: nextDisabledOutside,
      statusOutside: statusOutside
    };
  })()
"@

  Write-Host "Within Tolerance Test (+0.4 RPM diff): Match=$($tolCheck.matchWithin), Status=$($tolCheck.statusWithin), NextDisabled=$($tolCheck.nextDisabledWithin)"
  Write-Host "Outside Tolerance Test (+1.5 RPM diff): Match=$($tolCheck.matchOutside), Status=$($tolCheck.statusOutside), NextDisabled=$($tolCheck.nextDisabledOutside)"

  if (-not $tolCheck.matchWithin -or $tolCheck.nextDisabledWithin -ne $false -or $tolCheck.statusWithin -ne "LEVEL COMPLETE") {
    Write-Error "Failed within-tolerance verification!"
  }
  if ($tolCheck.matchOutside -ne $false -or $tolCheck.nextDisabledOutside -ne $true -or $tolCheck.statusOutside -ne "Adjust the gears") {
    Write-Error "Failed outside-tolerance verification! Next Level should be disabled when outside tolerance."
  }
  Write-Host "PASS: Check 4 (Tolerance +-0.5 RPM verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 5] Testing UI Button Navigation (Next, Previous, Reset, Start, Stop)..." -ForegroundColor Yellow
  $btnNavCheck = Exec-Eval @"
  (() => {
    // 1. On Level 1, click Next Level button
    window.gearFactory.loadLevel(1);
    const nextBtn = document.getElementById('btn-next-level');
    nextBtn.click();
    const afterNextLevel = window.gearFactory.currentLevel;

    // 2. Click Previous Level button
    const prevBtn = document.getElementById('btn-prev-level');
    prevBtn.click();
    const afterPrevLevel = window.gearFactory.currentLevel;

    // 3. Test Reset Level button
    document.getElementById('input-rpm-field').value = '999';
    window.gearFactory.updateGearboxParameters();
    const changedRPM = window.gearFactory.state.targetInputRPM;
    const resetBtn = document.getElementById('btn-reset-level');
    resetBtn.click();
    const restoredRPM = window.gearFactory.state.targetInputRPM;

    // 4. Test Start & Stop buttons
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    startBtn.click();
    const isRunningAfterStart = window.gearFactory.state.isRunning;
    stopBtn.click();
    const isRunningAfterStop = window.gearFactory.state.isRunning;

    return {
      afterNextLevel: afterNextLevel,
      afterPrevLevel: afterPrevLevel,
      changedRPM: changedRPM,
      restoredRPM: restoredRPM,
      isRunningAfterStart: isRunningAfterStart,
      isRunningAfterStop: isRunningAfterStop
    };
  })()
"@

  Write-Host "Next Button clicked: Level $($btnNavCheck.afterNextLevel) (expected 2)"
  Write-Host "Prev Button clicked: Level $($btnNavCheck.afterPrevLevel) (expected 1)"
  Write-Host "Reset Level restored RPM: $($btnNavCheck.restoredRPM) (from $($btnNavCheck.changedRPM))"
  Write-Host "Start button sets isRunning: $($btnNavCheck.isRunningAfterStart)"
  Write-Host "Stop button sets isRunning: $($btnNavCheck.isRunningAfterStop)"

  if ($btnNavCheck.afterNextLevel -ne 2 -or $btnNavCheck.afterPrevLevel -ne 1) {
    Write-Error "Button navigation failed!"
  }
  if ($btnNavCheck.restoredRPM -ne 100) {
    Write-Error "Reset Level button did not restore baseline RPM!"
  }
  if (-not $btnNavCheck.isRunningAfterStart -or $btnNavCheck.isRunningAfterStop) {
    Write-Error "Start/Stop buttons failed!"
  }
  Write-Host "PASS: Check 5 (Interactive Buttons verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 6] Capturing Preview Screenshot of Multi-Level System..." -ForegroundColor Yellow
  # Load Level 2 for a dynamic screenshot
  Exec-Eval "window.gearFactory.loadLevel(2);"
  Start-Sleep -Seconds 1

  $shotRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $shotBytes = [System.Convert]::FromBase64String($shotRes.result.data)
  $shotPath = "C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\multilevel_system_preview.png"
  [System.IO.File]::WriteAllBytes($shotPath, $shotBytes)
  Write-Host "Saved screenshot to: $shotPath"
  Write-Host "PASS: Check 6 (Screenshot captured)" -ForegroundColor Green

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host " ALL MULTI-LEVEL VERIFICATION CHECKS PASSED PERFECTLY! " -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green

} finally {
  if ($ws) {
    try { $ws.Dispose() } catch {}
  }
  if ($chromeProcess -and -not $chromeProcess.HasExited) {
    $chromeProcess.Kill()
  }
  if (Test-Path $userDir) {
    try { Remove-Item -Path $userDir -Recurse -Force -ErrorAction SilentlyContinue } catch {}
  }
}
