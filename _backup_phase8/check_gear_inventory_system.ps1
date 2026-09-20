# check_gear_inventory_system.ps1
# Automated Headless Chrome CDP Verification for Gear Inventory & Selection System
param(
  [int]$Port = 9322,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - GEAR INVENTORY & SELECTION SYSTEM TEST " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Locate Chrome
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

$userDir = Join-Path $env:TEMP "gear_inventory_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
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
    Write-Error "Could not connect to Chrome page tab on port $Port."
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

  Write-Host "`n[CHECK 1] Verifying Inventory Panels, Cards & Modular Functions..." -ForegroundColor Yellow
  $check1 = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    const hasCreate = typeof gf.createGearInventory === 'function';
    const hasSelectIn = typeof gf.selectInputGear === 'function';
    const hasSelectOut = typeof gf.selectOutputGear === 'function';
    const hasUpdate = typeof gf.updateSelectedGears === 'function';
    const hasClear = typeof gf.clearSelection === 'function';

    const inPanel = document.getElementById('input-gear-panel');
    const outPanel = document.getElementById('output-gear-panel');
    const clearBtn = document.getElementById('btn-clear-selection');

    const inCards = Array.from(document.querySelectorAll('#input-gear-chips .gear-card'));
    const outCards = Array.from(document.querySelectorAll('#output-gear-chips .gear-card'));

    const inTeeth = inCards.map(c => parseInt(c.dataset.teeth, 10));
    const outTeeth = outCards.map(c => parseInt(c.dataset.teeth, 10));

    return {
      hasCreate,
      hasSelectIn,
      hasSelectOut,
      hasUpdate,
      hasClear,
      hasInPanel: !!inPanel,
      hasOutPanel: !!outPanel,
      hasClearBtn: !!clearBtn,
      inCardCount: inCards.length,
      outCardCount: outCards.length,
      inTeeth,
      outTeeth,
      selectedInputTeeth: gf.selectedInputTeeth,
      selectedOutputTeeth: gf.selectedOutputTeeth,
      calcRpmMasked: document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim()
    };
  })()
"@

  Write-Host "Modular Functions present: create=$($check1.hasCreate), selectIn=$($check1.hasSelectIn), selectOut=$($check1.hasSelectOut), update=$($check1.hasUpdate), clear=$($check1.hasClear)"
  Write-Host "Input Panel: $($check1.hasInPanel), Output Panel: $($check1.hasOutPanel), Clear Button: $($check1.hasClearBtn)"
  Write-Host "Input Cards: $($check1.inTeeth -join ', ')T"
  Write-Host "Output Cards: $($check1.outTeeth -join ', ')T"
  Write-Host "Initial Gears: Input=$($check1.selectedInputTeeth)T, Output=$($check1.selectedOutputTeeth)T"
  Write-Host "Calculated RPM Masked: '$($check1.calcRpmMasked)'"

  if (-not ($check1.hasCreate -and $check1.hasSelectIn -and $check1.hasSelectOut -and $check1.hasUpdate -and $check1.hasClear)) {
    Write-Error "One or more required modular functions are missing from window.gearFactory!"
  }
  if (-not $check1.hasInPanel -or -not $check1.hasOutPanel -or -not $check1.hasClearBtn) {
    Write-Error "Missing Input Panel, Output Panel, or Clear Selection button!"
  }
  if ($check1.inCardCount -ne 5 -or $check1.outCardCount -ne 5) {
    Write-Error "Expected 5 cards in each panel, got In=$($check1.inCardCount), Out=$($check1.outCardCount)"
  }
  if ($check1.calcRpmMasked -ne '---') {
    Write-Error "Calculated RPM must be masked ('---') before check solution!"
  }
  Write-Host "PASS: Check 1 (Panels, Cards, and Modular Functions verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 2] Testing Interactive Gear Selection & 3D Regeneration..." -ForegroundColor Yellow
  $check2 = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    gf.selectInputGear(30);
    gf.selectOutputGear(50);

    const activeIn = document.querySelector('#input-gear-chips .gear-card.active')?.dataset.teeth;
    const activeOut = document.querySelector('#output-gear-chips .gear-card.active')?.dataset.teeth;

    const meshInTeeth = gf.inputGear?.userData?.teeth;
    const meshOutTeeth = gf.outputGear?.userData?.teeth;

    const inDisplay = document.getElementById('selected-input-gear-display')?.textContent.trim();
    const outDisplay = document.getElementById('selected-output-gear-display')?.textContent.trim();
    const calcRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();

    return {
      activeIn: parseInt(activeIn, 10),
      activeOut: parseInt(activeOut, 10),
      meshInTeeth,
      meshOutTeeth,
      inDisplay,
      outDisplay,
      calcRPM,
      selectedInputTeeth: gf.selectedInputTeeth,
      selectedOutputTeeth: gf.selectedOutputTeeth
    };
  })()
"@

  Write-Host "Active Cards: In=$($check2.activeIn)T, Out=$($check2.activeOut)T"
  Write-Host "3D Meshes: In=$($check2.meshInTeeth)T, Out=$($check2.meshOutTeeth)T"
  Write-Host "Display Badges: In='$($check2.inDisplay)', Out='$($check2.outDisplay)'"
  Write-Host "Calculated RPM (Should remain masked '---'): '$($check2.calcRPM)'"

  if ($check2.activeIn -ne 30 -or $check2.activeOut -ne 50) {
    Write-Error "Cards did not reflect active selection 30T/50T!"
  }
  if ($check2.meshInTeeth -ne 30 -or $check2.meshOutTeeth -ne 50) {
    Write-Error "3D gear models did not update to 30T/50T!"
  }
  if ($check2.calcRPM -ne '---') {
    Write-Error "Calculated RPM must stay masked '---' on selection change!"
  }
  Write-Host "PASS: Check 2 (Interactive selection and 3D regeneration verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 3] Testing Separate Physical Gear / Duplicate Prevention Rule (Requirement 10)..." -ForegroundColor Yellow
  $check3 = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    // Mount 20T on Input
    gf.selectInputGear(20);

    // Check Output panel card for 20T
    const outCard20 = document.querySelector('#output-gear-chips [data-teeth=\"20\"]');
    const isOut20InUse = outCard20.classList.contains('in-use');
    const isOut20Disabled = outCard20.disabled;
    const out20StatusText = outCard20.querySelector('.card-status')?.textContent.trim();

    // Now try to mount 20T on Output as well:
    gf.selectOutputGear(20);

    // Since separate gears are required, mounting 20T on Output must have unmounted 20T from Input
    const inCard20 = document.querySelector('#input-gear-chips [data-teeth=\"20\"]');
    const postInTeeth = gf.selectedInputTeeth;
    const postOutTeeth = gf.selectedOutputTeeth;

    return {
      isOut20InUse,
      isOut20Disabled,
      out20StatusText,
      postInTeeth,
      postOutTeeth,
      isIn20InUse: inCard20.classList.contains('in-use'),
      isIn20Disabled: inCard20.disabled
    };
  })()
"@

  Write-Host "When 20T was on Input -> Output 20T card in-use: $($check3.isOut20InUse), disabled: $($check3.isOut20Disabled), status: '$($check3.out20StatusText)'"
  Write-Host "After selecting 20T on Output -> Input teeth: $($check3.postInTeeth) (duplicate unmounted), Output teeth: $($check3.postOutTeeth)"

  if (-not $check3.isOut20InUse -or -not $check3.isOut20Disabled) {
    Write-Error "Duplicate gear was not marked as in-use and disabled on opposing panel!"
  }
  if ($check3.postInTeeth -eq $check3.postOutTeeth) {
    Write-Error "Duplicate physical gear was allowed on both shafts simultaneously!"
  }
  Write-Host "PASS: Check 3 (Duplicate physical gear prevention verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 4] Testing Clear Selection Button (Requirement 11)..." -ForegroundColor Yellow
  $check4 = Exec-Eval @"
  (() => {
    // Click the clear selection button in DOM
    const clearBtn = document.getElementById('btn-clear-selection');
    clearBtn.click();

    const inTeeth = window.gearFactory.selectedInputTeeth;
    const outTeeth = window.gearFactory.selectedOutputTeeth;
    const inDisplay = document.getElementById('selected-input-gear-display')?.textContent.trim();
    const outDisplay = document.getElementById('selected-output-gear-display')?.textContent.trim();
    const verifIn = document.getElementById('result-input-gear')?.textContent.trim();
    const verifOut = document.getElementById('result-output-gear')?.textContent.trim();
    const hasInputGearMesh = !!window.gearFactory.inputGear;
    const hasOutputGearMesh = !!window.gearFactory.outputGear;
    const calcRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();

    return {
      inTeeth,
      outTeeth,
      inDisplay,
      outDisplay,
      verifIn,
      verifOut,
      hasInputGearMesh,
      hasOutputGearMesh,
      calcRPM
    };
  })()
"@

  Write-Host "After Clear Selection -> Input: $($check4.inTeeth), Output: $($check4.outTeeth)"
  Write-Host "Badges: In='$($check4.inDisplay)', Out='$($check4.outDisplay)'"
  Write-Host "Verification Card: In='$($check4.verifIn)', Out='$($check4.verifOut)'"
  Write-Host "3D Meshes unmounted: inputGear is null: $(-not $check4.hasInputGearMesh), outputGear is null: $(-not $check4.hasOutputGearMesh)"

  if ($check4.inTeeth -ne $null -or $check4.outTeeth -ne $null) {
    Write-Error "Clear Selection did not set teeth variables to null!"
  }
  if ($check4.hasInputGearMesh -or $check4.hasOutputGearMesh) {
    Write-Error "3D gear bodies should be unmounted from shafts when cleared!"
  }
  if ($check4.calcRPM -ne '---') {
    Write-Error "Calculated RPM must remain masked '---'!"
  }
  Write-Host "PASS: Check 4 (Clear Selection button verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 5] Testing Solution Check & Multi-Level Solvability with Inventory..." -ForegroundColor Yellow
  $check5 = Exec-Eval @"
  (() => {
    const gf = window.gearFactory;
    gf.loadLevel(1);

    // Level 1: 100 RPM input, 50 RPM target -> 20T in / 40T out
    gf.selectInputGear(20);
    gf.selectOutputGear(40);

    document.getElementById('btn-check-solution').click();

    const status = document.getElementById('puzzle-status-text')?.textContent.trim();
    const calcRPM = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
    const nextDisabled = document.getElementById('btn-next-level')?.disabled;

    return {
      status,
      calcRPM,
      nextDisabled
    };
  })()
"@

  Write-Host "Level 1 Post-Check: Status='$($check5.status)', CalcRPM='$($check5.calcRPM)', NextDisabled=$($check5.nextDisabled)"
  if ($check5.status -ne 'LEVEL COMPLETE' -or $check5.calcRPM -ne '50.0 RPM' -or $check5.nextDisabled -ne $false) {
    Write-Error "Level 1 check failed with inventory selection!"
  }
  Write-Host "PASS: Check 5 (Solution check and progression verified)" -ForegroundColor Green


  Write-Host "`n[CHECK 6] Capturing Desktop & Mobile Preview Screenshots..." -ForegroundColor Yellow

  # Desktop state: Level 1 completed
  Start-Sleep -Seconds 1
  $shotDesktop = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gear_inventory_selection_preview.png", [System.Convert]::FromBase64String($shotDesktop.result.data))
  Write-Host "Saved desktop inventory preview screenshot."

  # Desktop state: Cleared selection
  Exec-Eval "window.gearFactory.clearSelection();"
  Start-Sleep -Seconds 1
  $shotClear = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gear_inventory_cleared_preview.png", [System.Convert]::FromBase64String($shotClear.result.data))
  Write-Host "Saved cleared inventory preview screenshot."

  # Mobile state: Resize viewport to 390 x 844 (iPhone 12/13/14)
  Send-CDP "Emulation.setDeviceMetricsOverride" @{
    width = 390;
    height = 844;
    deviceScaleFactor = 2;
    mobile = $true
  }
  Exec-Eval "window.gearFactory.loadLevel(1); window.gearFactory.selectInputGear(20); window.gearFactory.selectOutputGear(40);"
  Start-Sleep -Seconds 1
  $shotMobile = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\9df6cfaf-6251-4f33-99ff-db628648efbb\gear_inventory_mobile_preview.png", [System.Convert]::FromBase64String($shotMobile.result.data))
  Write-Host "Saved mobile inventory preview screenshot."

  # Reset emulation
  Send-CDP "Emulation.clearDeviceMetricsOverride"

  Write-Host "`n==========================================================" -ForegroundColor Green
  Write-Host " ALL GEAR INVENTORY & SELECTION SYSTEM TESTS PASSED! " -ForegroundColor Green
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
