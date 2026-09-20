# check_hidden_answers_puzzle.ps1
# Headless Chrome CDP Verification for Hidden-Answers Puzzle & Gear Inventory System
param(
  [int]$Port = 9320,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - HIDDEN-ANSWERS PUZZLE VERIFICATION " -ForegroundColor Cyan
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

$userDir = Join-Path $env:TEMP "gear_hidden_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
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

  Write-Host "`n[CHECK 1] Verifying Hidden Answers on Level Load (Pre-Check State)..." -ForegroundColor Yellow
  $preCheck = Exec-Eval @"
  (() => {
    window.gearFactory.loadLevel(1);

    const indicator = document.getElementById('puzzle-level-indicator')?.textContent.trim();
    const inputRpm = document.getElementById('puzzle-input-rpm')?.textContent.trim();
    const targetRpm = document.getElementById('puzzle-target-output-rpm')?.textContent.trim();
    const calcOutputRpm = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
    const selInDisplay = document.getElementById('selected-input-gear-display')?.textContent.trim();
    const selOutDisplay = document.getElementById('selected-output-gear-display')?.textContent.trim();
    const statusText = document.getElementById('puzzle-status-text')?.textContent.trim();
    const statusVal = document.getElementById('puzzle-status-val')?.textContent.trim();
    const nextBtnDisabled = document.getElementById('btn-next-level')?.disabled;
    const prevBtnDisabled = document.getElementById('btn-prev-level')?.disabled;

    // Check visible text across entire control panel for forbidden giveaways (ratios like 2:1, 40T solution text)
    const panelText = document.getElementById('puzzle-panel')?.innerText || '';
    const hasRatioGiveaway = panelText.includes('2:1') || panelText.includes('2.00 : 1') || panelText.includes('40 Teeth • Target: 50 RPM');

    return {
      indicator,
      inputRpm,
      targetRpm,
      calcOutputRpm,
      selInDisplay,
      selOutDisplay,
      statusText,
      statusVal,
      nextBtnDisabled,
      prevBtnDisabled,
      hasRatioGiveaway,
      selectedInputTeeth: window.gearFactory.selectedInputTeeth,
      selectedOutputTeeth: window.gearFactory.selectedOutputTeeth,
    };
  })()
"@

  Write-Host "Level Indicator: $($preCheck.indicator)"
  Write-Host "Motor Input RPM: $($preCheck.inputRpm) RPM"
  Write-Host "Target Output RPM: $($preCheck.targetRpm) RPM"
  Write-Host "Calculated Output RPM (Should be masked '---'): $($preCheck.calcOutputRpm)"
  Write-Host "Selected Gears: In=$($preCheck.selInDisplay), Out=$($preCheck.selOutDisplay)"
  Write-Host "Status: $($preCheck.statusText) / $($preCheck.statusVal)"
  Write-Host "Next Button Disabled: $($preCheck.nextBtnDisabled) (Must be True before check)"
  Write-Host "Forbidden Ratio Giveaway Found: $($preCheck.hasRatioGiveaway)"

  if ($preCheck.calcOutputRpm -ne '---') {
    Write-Error "Calculated Output RPM MUST be hidden ('---') before Check Solution is pressed!"
  }
  if ($preCheck.hasRatioGiveaway -eq $true) {
    Write-Error "Found forbidden ratio or answer giveaway in the puzzle panel UI!"
  }
  if ($preCheck.nextBtnDisabled -ne $true) {
    Write-Error "Next Level button must be disabled before the level is solved!"
  }
  if ($preCheck.prevBtnDisabled -ne $true) {
    Write-Error "Previous Level button must be disabled on Level 1!"
  }
  Write-Host "PASS: Check 1 (Answers and Output RPM strictly hidden pre-check)" -ForegroundColor Green


  Write-Host "`n[CHECK 2] Verifying 5-Gear Inventory Options (10T, 20T, 30T, 40T, 50T)..." -ForegroundColor Yellow
  $inventoryCheck = Exec-Eval @"
  (() => {
    const inChips = Array.from(document.querySelectorAll('#input-gear-chips .gear-chip')).map(b => parseInt(b.dataset.teeth, 10));
    const outChips = Array.from(document.querySelectorAll('#output-gear-chips .gear-chip')).map(b => parseInt(b.dataset.teeth, 10));
    const jsInventory = window.gearFactory.GEAR_INVENTORY;

    return {
      inChips,
      outChips,
      jsInventory
    };
  })()
"@

  Write-Host "Input Chips: $($inventoryCheck.inChips -join ', ')T"
  Write-Host "Output Chips: $($inventoryCheck.outChips -join ', ')T"
  Write-Host "JS Inventory: $($inventoryCheck.jsInventory -join ', ')T"

  $expectedTeeth = @(10, 20, 30, 40, 50)
  foreach ($t in $expectedTeeth) {
    if (-not ($inventoryCheck.inChips -contains $t)) { Write-Error "Missing $t teeth in Input Chips!" }
    if (-not ($inventoryCheck.outChips -contains $t)) { Write-Error "Missing $t teeth in Output Chips!" }
    if (-not ($inventoryCheck.jsInventory -contains $t)) { Write-Error "Missing $t in GEAR_INVENTORY array!" }
  }
  Write-Host "PASS: Check 2 (All 5 inventory gears present)" -ForegroundColor Green


  Write-Host "`n[CHECK 3] Testing Interactive Gear Selection & Dynamic 3D Updates..." -ForegroundColor Yellow
  $selectionCheck = Exec-Eval @"
  (() => {
    // Select 30T input and 50T output via UI chips
    const inChip30 = document.querySelector('#input-gear-chips [data-teeth=\"30\"]');
    const outChip50 = document.querySelector('#output-gear-chips [data-teeth=\"50\"]');

    inChip30.click();
    outChip50.click();

    const activeInChipTeeth = parseInt(document.querySelector('#input-gear-chips .gear-chip.active')?.dataset.teeth, 10);
    const activeOutChipTeeth = parseInt(document.querySelector('#output-gear-chips .gear-chip.active')?.dataset.teeth, 10);
    const selInText = document.getElementById('selected-input-gear-display')?.textContent.trim();
    const selOutText = document.getElementById('selected-output-gear-display')?.textContent.trim();

    // Check 3D gear tooth counts and Three.js mesh instances
    const stateInTeeth = window.gearFactory.state.inputTeeth;
    const stateOutTeeth = window.gearFactory.state.outputTeeth;
    const meshInTeeth = window.gearFactory.inputGear?.userData?.teeth;
    const meshOutTeeth = window.gearFactory.outputGear?.userData?.teeth;

    return {
      activeInChipTeeth,
      activeOutChipTeeth,
      selInText,
      selOutText,
      stateInTeeth,
      stateOutTeeth,
      meshInTeeth,
      meshOutTeeth
    };
  })()
"@

  Write-Host "Active Input Chip: $($selectionCheck.activeInChipTeeth)T (Display: $($selectionCheck.selInText))"
  Write-Host "Active Output Chip: $($selectionCheck.activeOutChipTeeth)T (Display: $($selectionCheck.selOutText))"
  Write-Host "3D Mesh Teeth: In=$($selectionCheck.meshInTeeth)T, Out=$($selectionCheck.meshOutTeeth)T"

  if ($selectionCheck.activeInChipTeeth -ne 30 -or $selectionCheck.activeOutChipTeeth -ne 50) {
    Write-Error "UI chips did not update active state to 30T/50T!"
  }
  if ($selectionCheck.meshInTeeth -ne 30 -or $selectionCheck.meshOutTeeth -ne 50) {
    Write-Error "3D gear models did not update to 30T/50T!"
  }
  Write-Host "PASS: Check 3 (Selection & dynamic 3D update verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 4] Testing Incorrect Solution Check ('TRY AGAIN')..." -ForegroundColor Yellow
  $failCheck = Exec-Eval @"
  (() => {
    // Currently on Level 1 (Input 100 RPM, Target 50 RPM).
    // Selected 30T in / 50T out -> calculated output = 100 * 30 / 50 = 60.0 RPM != 50.0 RPM
    const checkBtn = document.getElementById('btn-check-solution');
    checkBtn.click();

    const statusText = document.getElementById('puzzle-status-text')?.textContent.trim();
    const statusVal = document.getElementById('puzzle-status-val')?.textContent.trim();
    const calcRpm = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
    const nextDisabled = document.getElementById('btn-next-level')?.disabled;
    const failBannerDisplay = document.getElementById('puzzle-fail-banner')?.style.display;
    const successBannerDisplay = document.getElementById('puzzle-success-banner')?.style.display;

    return {
      statusText,
      statusVal,
      calcRpm,
      nextDisabled,
      failBannerDisplay,
      successBannerDisplay,
      isComplete: window.gearFactory.puzzle.isComplete
    };
  })()
"@

  Write-Host "Status after incorrect check: $($failCheck.statusText)"
  Write-Host "Revealed Calculated Output RPM: $($failCheck.calcRpm) (Expected: 60.0 RPM)"
  Write-Host "Next Level Button Disabled: $($failCheck.nextDisabled)"
  Write-Host "Fail Banner Display: $($failCheck.failBannerDisplay)"

  if ($failCheck.statusText -ne 'TRY AGAIN' -or $failCheck.statusVal -ne 'TRY AGAIN') {
    Write-Error "Status should be 'TRY AGAIN' on mismatch!"
  }
  if ($failCheck.calcRpm -ne '60.0 RPM') {
    Write-Error "Calculated RPM should be 60.0 RPM, got: $($failCheck.calcRpm)"
  }
  if ($failCheck.nextDisabled -ne $true) {
    Write-Error "Next Level button must remain disabled on TRY AGAIN!"
  }
  if ($failCheck.failBannerDisplay -ne 'flex') {
    Write-Error "Fail banner should be displayed on TRY AGAIN!"
  }
  Write-Host "PASS: Check 4 (TRY AGAIN handling verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 5] Testing Correct Solution Check ('LEVEL COMPLETE')..." -ForegroundColor Yellow
  $passCheck = Exec-Eval @"
  (() => {
    // Select 20T input and 40T output -> calculated = 100 * 20 / 40 = 50.0 RPM == 50.0 RPM
    document.querySelector('#input-gear-chips [data-teeth=\"20\"]').click();
    document.querySelector('#output-gear-chips [data-teeth=\"40\"]').click();

    const checkBtn = document.getElementById('btn-check-solution');
    checkBtn.click();

    const statusText = document.getElementById('puzzle-status-text')?.textContent.trim();
    const statusVal = document.getElementById('puzzle-status-val')?.textContent.trim();
    const calcRpm = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
    const nextDisabled = document.getElementById('btn-next-level')?.disabled;
    const successBannerDisplay = document.getElementById('puzzle-success-banner')?.style.display;
    const failBannerDisplay = document.getElementById('puzzle-fail-banner')?.style.display;

    return {
      statusText,
      statusVal,
      calcRpm,
      nextDisabled,
      successBannerDisplay,
      failBannerDisplay,
      isComplete: window.gearFactory.puzzle.isComplete
    };
  })()
"@

  Write-Host "Status after correct check: $($passCheck.statusText)"
  Write-Host "Calculated Output RPM: $($passCheck.calcRpm) (Expected: 50.0 RPM)"
  Write-Host "Next Level Button Disabled: $($passCheck.nextDisabled) (Expected: False)"
  Write-Host "Success Banner Display: $($passCheck.successBannerDisplay)"

  if ($passCheck.statusText -ne 'LEVEL COMPLETE' -or $passCheck.statusVal -ne 'LEVEL COMPLETE') {
    Write-Error "Status should be 'LEVEL COMPLETE' on match!"
  }
  if ($passCheck.calcRpm -ne '50.0 RPM') {
    Write-Error "Calculated RPM should be 50.0 RPM, got: $($passCheck.calcRpm)"
  }
  if ($passCheck.nextDisabled -ne $false) {
    Write-Error "Next Level button must be enabled on LEVEL COMPLETE!"
  }
  if ($passCheck.successBannerDisplay -ne 'flex') {
    Write-Error "Success banner should be displayed on LEVEL COMPLETE!"
  }
  Write-Host "PASS: Check 5 (LEVEL COMPLETE handling verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 6] Testing Multi-Level Progression (Levels 1 to 5 Solutions)..." -ForegroundColor Yellow
  $levelSolutions = @(
    @{ lvl=1; inT=20; outT=40; expRPM="50.0 RPM" },
    @{ lvl=2; inT=20; outT=30; expRPM="80.0 RPM" },
    @{ lvl=3; inT=30; outT=20; expRPM="225.0 RPM" },
    @{ lvl=4; inT=10; outT=40; expRPM="25.0 RPM" },
    @{ lvl=5; inT=40; outT=20; expRPM="400.0 RPM" }
  )

  foreach ($sol in $levelSolutions) {
    $lvlNum = $sol.lvl
    $inT = $sol.inT
    $outT = $sol.outT
    $expRPM = $sol.expRPM

    $res = Exec-Eval @"
    (() => {
      window.gearFactory.loadLevel($lvlNum);

      // Verify pre-check hiding on newly loaded level
      const preCheckRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();

      // Select solution gears from inventory
      document.querySelector('#input-gear-chips [data-teeth=\"$inT\"]').click();
      document.querySelector('#output-gear-chips [data-teeth=\"$outT\"]').click();

      // Check solution
      document.getElementById('btn-check-solution').click();

      const status = document.getElementById('puzzle-status-text')?.textContent.trim();
      const calcRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
      const nextDisabled = document.getElementById('btn-next-level')?.disabled;

      return {
        preCheckRPM,
        status,
        calcRPM,
        nextDisabled
      };
    })()
"@

    Write-Host "Level ${lvlNum}: PreCheck='$($res.preCheckRPM)', PostCheck='$($res.calcRPM)', Status='$($res.status)', NextDisabled=$($res.nextDisabled)"
    if ($res.preCheckRPM -ne '---') {
      Write-Error "Level $lvlNum pre-check RPM should be '---'!"
    }
    if ($res.status -ne 'LEVEL COMPLETE' -or $res.calcRPM -ne $expRPM -or $res.nextDisabled -ne $false) {
      Write-Error "Level $lvlNum solution failed! Expected $expRPM"
    }
  }
  Write-Host "PASS: Check 6 (All 5 levels successfully solved and verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 7] Testing Reset Level and Machine Controls..." -ForegroundColor Yellow
  $machineCheck = Exec-Eval @"
  (() => {
    // 1. Reset Level
    document.getElementById('btn-reset-level').click();
    const resetCalcRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
    const resetStatus = document.getElementById('puzzle-status-text')?.textContent.trim();
    const resetNextDis = document.getElementById('btn-next-level')?.disabled;

    // 2. Machine Controls (Start / Stop / Reset)
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    const resetBtn = document.getElementById('btn-reset');

    startBtn.click();
    const running = window.gearFactory.state.isRunning;
    stopBtn.click();
    const stopped = !window.gearFactory.state.isRunning;

    return {
      resetCalcRPM,
      resetStatus,
      resetNextDis,
      running,
      stopped
    };
  })()
"@

  Write-Host "After Reset Level -> RPM: $($machineCheck.resetCalcRPM), Status: $($machineCheck.resetStatus), NextDisabled: $($machineCheck.resetNextDis)"
  Write-Host "Machine Controls -> Start sets running: $($machineCheck.running), Stop halts: $($machineCheck.stopped)"

  if ($machineCheck.resetCalcRPM -ne '---' -or $machineCheck.resetNextDis -ne $true) {
    Write-Error "Reset Level did not mask calculated RPM or lock Next button!"
  }
  if (-not $machineCheck.running -or -not $machineCheck.stopped) {
    Write-Error "Start / Stop controls failed!"
  }
  Write-Host "PASS: Check 7 (Reset Level & Machine Controls verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 8] Capturing Preview Screenshots for All UI States..." -ForegroundColor Yellow
  
  # State A: Pre-Check (answers masked)
  Exec-Eval "window.gearFactory.loadLevel(1);"
  Start-Sleep -Seconds 1
  $shotA = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\hidden_answers_precheck.png", [System.Convert]::FromBase64String($shotA.result.data))
  Write-Host "Saved pre-check screenshot."

  # State B: TRY AGAIN (incorrect gear combination)
  Exec-Eval @"
  (() => {
    document.querySelector('#input-gear-chips [data-teeth=\"30\"]').click();
    document.querySelector('#output-gear-chips [data-teeth=\"50\"]').click();
    document.getElementById('btn-check-solution').click();
  })()
"@
  Start-Sleep -Seconds 1
  $shotB = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\hidden_answers_try_again.png", [System.Convert]::FromBase64String($shotB.result.data))
  Write-Host "Saved TRY AGAIN screenshot."

  # State C: LEVEL COMPLETE (correct gear combination: 20T in / 40T out -> 50 RPM)
  Exec-Eval @"
  (() => {
    document.querySelector('#input-gear-chips [data-teeth=\"20\"]').click();
    document.querySelector('#output-gear-chips [data-teeth=\"40\"]').click();
    document.getElementById('btn-check-solution').click();
  })()
"@
  Start-Sleep -Seconds 1
  $shotC = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\hidden_answers_puzzle_preview.png", [System.Convert]::FromBase64String($shotC.result.data))
  Write-Host "Saved LEVEL COMPLETE preview screenshot."
  Write-Host "PASS: Check 8 (All UI state screenshots captured)" -ForegroundColor Green

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host " ALL HIDDEN-ANSWERS PUZZLE VERIFICATION CHECKS PASSED! " -ForegroundColor Green
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
