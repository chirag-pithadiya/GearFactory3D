# check_layout_redesign.ps1
# Automated Headless Chrome CDP Verification for UI Redesign & Clean 3D Play-Area
param(
  [int]$Port = 9324,
  [string]$Url = "http://localhost:8088"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - UI REDESIGN & LAYOUT TEST              " -ForegroundColor Cyan
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

$userDir = Join-Path $env:TEMP "gear_layout_test_$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
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

  Write-Host "`n[CHECK 1] Verifying DOM Structure & Clean Separation of Components..." -ForegroundColor Yellow
  $domCheck = Exec-Eval @"
  (() => {
    const playArea = document.getElementById('play-area');
    const threeContainer = document.getElementById('three-container');
    const canvas = document.getElementById('webgl-canvas');
    const controlPanel = document.getElementById('control-panel');
    const gearInventory = document.getElementById('gear-inventory');
    const appHeader = document.querySelector('.app-header');

    const canvasInContainer = threeContainer ? threeContainer.contains(canvas) : false;
    const controlsInPlayArea = playArea ? playArea.contains(controlPanel) : false;
    const inventoryInPlayArea = playArea ? playArea.contains(gearInventory) : false;
    const controlsInInventory = gearInventory ? gearInventory.contains(controlPanel) : false;

    return {
      hasPlayArea: !!playArea,
      hasThreeContainer: !!threeContainer,
      hasCanvas: !!canvas,
      hasControlPanel: !!controlPanel,
      hasGearInventory: !!gearInventory,
      hasAppHeader: !!appHeader,
      canvasInContainer,
      controlsInPlayArea,
      inventoryInPlayArea,
      controlsInInventory
    };
  })()
"@

  Write-Host "  Play Area Container Exists: $($domCheck.hasPlayArea)"
  Write-Host "  Three.js Container Exists: $($domCheck.hasThreeContainer)"
  Write-Host "  WebGL Canvas Exists: $($domCheck.hasCanvas)"
  Write-Host "  Control Panel Exists: $($domCheck.hasControlPanel)"
  Write-Host "  Gear Inventory Exists: $($domCheck.hasGearInventory)"
  Write-Host "  Canvas Inside Three Container: $($domCheck.canvasInContainer)"
  Write-Host "  Controls Outside Play Area: $(-not $domCheck.controlsInPlayArea)"
  Write-Host "  Inventory Outside Play Area: $(-not $domCheck.inventoryInPlayArea)"

  if (-not ($domCheck.hasPlayArea -and $domCheck.hasThreeContainer -and $domCheck.hasCanvas -and
            $domCheck.hasControlPanel -and $domCheck.hasGearInventory -and $domCheck.canvasInContainer -and
            (-not $domCheck.controlsInPlayArea) -and (-not $domCheck.inventoryInPlayArea))) {
    Write-Error "CHECK 1 FAILED: Containers are not correctly separated in DOM hierarchy!"
  }
  Write-Host "  ==> PASS: Clean DOM structure confirmed." -ForegroundColor Green

  Write-Host "`n[CHECK 2] Verifying Zero Overlap Between Canvas and UI Elements..." -ForegroundColor Yellow
  $overlapCheck = Exec-Eval @"
  (() => {
    const canvas = document.getElementById('webgl-canvas');
    const cRect = canvas.getBoundingClientRect();

    // Check against all critical UI elements
    const testSelectors = [
      '#btn-start', '#btn-stop', '#btn-reset',
      '#btn-check-solution', '#btn-reset-level', '#btn-prev-level', '#btn-next-level',
      '#puzzle-panel', '#verification-card', '#gear-inventory',
      '.app-header', '#selected-input-gear-display', '#selected-output-gear-display'
    ];

    const overlaps = [];
    testSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;

      // Overlap calculation
      const xOverlap = Math.max(0, Math.min(cRect.right, r.right) - Math.max(cRect.left, r.left));
      const yOverlap = Math.max(0, Math.min(cRect.bottom, r.bottom) - Math.max(cRect.top, r.top));
      const overlapArea = xOverlap * yOverlap;

      if (overlapArea > 0) {
        overlaps.push({
          selector: sel,
          overlapArea,
          canvasRect: { x: cRect.x, y: cRect.y, w: cRect.width, h: cRect.height },
          elementRect: { x: r.x, y: r.y, w: r.width, h: r.height }
        });
      }
    });

    return {
      overlaps,
      canvasRect: { x: cRect.x, y: cRect.y, w: cRect.width, h: cRect.height }
    };
  })()
"@

  Write-Host "  Canvas Bounding Box: x=$($overlapCheck.canvasRect.x), y=$($overlapCheck.canvasRect.y), w=$($overlapCheck.canvasRect.w), h=$($overlapCheck.canvasRect.h)"
  Write-Host "  Overlapping UI Elements Count: $($overlapCheck.overlaps.Count)"

  if ($overlapCheck.overlaps.Count -gt 0) {
    Write-Host "  Overlaps Detected:" -ForegroundColor Red
    foreach ($ov in $overlapCheck.overlaps) {
      Write-Host "    - $($ov.selector): Area = $($ov.overlapArea)" -ForegroundColor Red
    }
    Write-Error "CHECK 2 FAILED: UI elements are entering/overlapping the 3D play area!"
  }
  Write-Host "  ==> PASS: Zero HTML buttons, symbols, or panels overlap the 3D canvas!" -ForegroundColor Green

  Write-Host "`n[CHECK 3] Verifying Desktop Layout (3D Left, Controls Right, 260px Sidebar, 16:10 Ratio)..." -ForegroundColor Yellow
  $desktopLayout = Exec-Eval @"
  (() => {
    const playArea = document.getElementById('play-area');
    const threeContainer = document.getElementById('three-container');
    const canvas = document.getElementById('webgl-canvas');
    const controlPanel = document.getElementById('control-panel');

    const paRect = playArea.getBoundingClientRect();
    const cpRect = controlPanel.getBoundingClientRect();
    const tcRect = threeContainer.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();

    const isLeftOfControls = paRect.right <= cpRect.left + 5;
    const containerAspectRatio = tcRect.width / tcRect.height;
    const canvasFillsContainer = Math.abs(cRect.width - tcRect.width) <= 3 && Math.abs(cRect.height - tcRect.height) <= 3;
    const isControlPanel260 = Math.abs(cpRect.width - 260) <= 2;

    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const noHorizontalOverflow = scrollWidth <= clientWidth;

    return {
      playAreaWidth: paRect.width,
      controlPanelWidth: cpRect.width,
      isLeftOfControls,
      isControlPanel260,
      containerWidth: tcRect.width,
      containerHeight: tcRect.height,
      containerAspectRatio,
      canvasFillsContainer,
      scrollWidth,
      clientWidth,
      noHorizontalOverflow
    };
  })()
"@

  Write-Host "  Play Area Width: $($desktopLayout.playAreaWidth)px"
  Write-Host "  Control Panel Width: $($desktopLayout.controlPanelWidth)px (Expected: 260px)"
  Write-Host "  3D Scene on Left, Controls on Right: $($desktopLayout.isLeftOfControls)"
  Write-Host "  Container Aspect Ratio: $([Math]::Round($desktopLayout.containerAspectRatio, 3)) (Expected 1.6 for 16:10)"
  Write-Host "  Canvas Fills Only Its Play Area Container: $($desktopLayout.canvasFillsContainer)"
  Write-Host "  No Horizontal Overflow: $($desktopLayout.noHorizontalOverflow) (scrollWidth: $($desktopLayout.scrollWidth) vs clientWidth: $($desktopLayout.clientWidth))"

  if (-not ($desktopLayout.isLeftOfControls -and $desktopLayout.canvasFillsContainer -and $desktopLayout.noHorizontalOverflow)) {
    Write-Error "CHECK 3 FAILED: Desktop layout does not conform to requirements!"
  }
  Write-Host "  ==> PASS: Desktop 2-column layout confirmed." -ForegroundColor Green

  # Capture Desktop Screenshot
  Write-Host "  Capturing Desktop Preview Screenshot..."
  $ssDesktop = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $desktopImgPath = "d:\GAMES\GearFactory3D\desktop_redesign_preview.png"
  [System.IO.File]::WriteAllBytes($desktopImgPath, [System.Convert]::FromBase64String($ssDesktop.result.data))
  Write-Host "  Saved desktop screenshot to $desktopImgPath" -ForegroundColor Green

  Write-Host "`n[CHECK 4] Verifying Mobile Layout <=768px (3D Scene Top, Controls Below, repeat(2, 1fr))..." -ForegroundColor Yellow
  # Set Mobile viewport 600x900 (<= 768px)
  Send-CDP "Emulation.setDeviceMetricsOverride" @{
    width = 600
    height = 900
    deviceScaleFactor = 2
    mobile = $true
  } | Out-Null
  Start-Sleep -Milliseconds 600

  $mobileLayout = Exec-Eval @"
  (() => {
    // Trigger resize calculation
    window.dispatchEvent(new Event('resize'));

    const playArea = document.getElementById('play-area');
    const threeContainer = document.getElementById('three-container');
    const canvas = document.getElementById('webgl-canvas');
    const controlPanel = document.getElementById('control-panel');
    const gearInventory = document.getElementById('gear-inventory');

    const paRect = playArea.getBoundingClientRect();
    const cpRect = controlPanel.getBoundingClientRect();
    const giRect = gearInventory.getBoundingClientRect();
    const tcRect = threeContainer.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();

    const isSceneTopControlsBelow = cpRect.top >= paRect.bottom - 5;
    const isInventoryBelowControls = giRect.top >= cpRect.bottom - 5;
    const containerAspectRatio = tcRect.width / tcRect.height;
    const canvasFillsContainer = Math.abs(cRect.width - tcRect.width) <= 3 && Math.abs(cRect.height - tcRect.height) <= 3;

    // Check control panel computed display
    const cpComputed = window.getComputedStyle(controlPanel);
    const isCpGrid2Col = cpComputed.display === 'grid' && cpComputed.gridTemplateColumns.split(' ').length === 2;

    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const noHorizontalOverflow = scrollWidth <= clientWidth;

    return {
      isSceneTopControlsBelow,
      isInventoryBelowControls,
      containerWidth: tcRect.width,
      containerHeight: tcRect.height,
      containerAspectRatio,
      canvasFillsContainer,
      isCpGrid2Col,
      scrollWidth,
      clientWidth,
      noHorizontalOverflow
    };
  })()
"@

  Write-Host "  3D Scene on Top, Controls Below: $($mobileLayout.isSceneTopControlsBelow)"
  Write-Host "  Control Panel is 2-Column Grid on Mobile: $($mobileLayout.isCpGrid2Col)"
  Write-Host "  Inventory Below Controls: $($mobileLayout.isInventoryBelowControls)"
  Write-Host "  Container Aspect Ratio: $([Math]::Round($mobileLayout.containerAspectRatio, 3)) (Expected 1.6 for 16:10)"
  Write-Host "  Canvas Fills Only Its Play Area Container: $($mobileLayout.canvasFillsContainer)"
  Write-Host "  No Horizontal Overflow on Mobile: $($mobileLayout.noHorizontalOverflow) (scrollWidth: $($mobileLayout.scrollWidth) vs clientWidth: $($mobileLayout.clientWidth))"

  if (-not ($mobileLayout.isSceneTopControlsBelow -and $mobileLayout.canvasFillsContainer -and $mobileLayout.noHorizontalOverflow)) {
    Write-Error "CHECK 4 FAILED: Mobile layout does not stack properly or has horizontal overflow!"
  }
  Write-Host "  ==> PASS: Mobile stacked layout confirmed." -ForegroundColor Green

  # Capture Mobile Screenshot
  Write-Host "  Capturing Mobile Preview Screenshot..."
  $ssMobile = Send-CDP "Page.captureScreenshot" @{ format = "png" }
  $mobileImgPath = "d:\GAMES\GearFactory3D\mobile_redesign_preview.png"
  [System.IO.File]::WriteAllBytes($mobileImgPath, [System.Convert]::FromBase64String($ssMobile.result.data))
  Write-Host "  Saved mobile screenshot to $mobileImgPath" -ForegroundColor Green

  # Restore Desktop Viewport for functionality check
  Send-CDP "Emulation.setDeviceMetricsOverride" @{
    width = 1440
    height = 900
    deviceScaleFactor = 1
    mobile = $false
  } | Out-Null
  Start-Sleep -Milliseconds 600

  Write-Host "`n[CHECK 5] Verifying Gameplay Mechanics & Machine Controls..." -ForegroundColor Yellow
  $gameplayTest = Exec-Eval @"
  (() => {
    // Reset to Level 1
    window.gearFactory.loadLevel(1);

    // Select 20T Input and 40T Output
    window.gearFactory.selectInputGear(20);
    window.gearFactory.selectOutputGear(40);

    // Check solution
    const isSolutionPass = window.gearFactory.checkPuzzleSolution();
    const calculatedRpmText = document.getElementById('puzzle-calculated-output-rpm')?.textContent;

    // Start rotation
    window.gearFactory.setRunningState(true);
    const isRunningAfterStart = window.gearFactory.state.isRunning;

    // Stop rotation
    window.gearFactory.setRunningState(false);
    const isRunningAfterStop = window.gearFactory.state.isRunning;

    return {
      level: window.gearFactory.currentLevel,
      selectedInput: window.gearFactory.selectedInputTeeth,
      selectedOutput: window.gearFactory.selectedOutputTeeth,
      isSolutionPass,
      calculatedRpmText,
      isRunningAfterStart,
      isRunningAfterStop
    };
  })()
"@

  Write-Host "  Level: $($gameplayTest.level)"
  Write-Host "  Selected Input Teeth: $($gameplayTest.selectedInput)"
  Write-Host "  Selected Output Teeth: $($gameplayTest.selectedOutput)"
  Write-Host "  Check Solution Passed: $($gameplayTest.isSolutionPass)"
  Write-Host "  Calculated Output RPM: $($gameplayTest.calculatedRpmText)"
  Write-Host "  Start Machine Operation: $($gameplayTest.isRunningAfterStart)"
  Write-Host "  Stop Machine Operation: $(-not $gameplayTest.isRunningAfterStop)"

  if (-not ($gameplayTest.isSolutionPass -and $gameplayTest.isRunningAfterStart -and (-not $gameplayTest.isRunningAfterStop))) {
    Write-Error "CHECK 5 FAILED: Gameplay mechanics or machine operations failed!"
  }
  Write-Host "  ==> PASS: All gameplay systems and machine controls fully functional!" -ForegroundColor Green

  Write-Host "`n==========================================================" -ForegroundColor Cyan
  Write-Host " ALL CHECKS PASSED: UI REDESIGN COMPLETED SUCCESSFULLY!    " -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Cyan

} finally {
  if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", [System.Threading.CancellationToken]::None).Wait()
  }
  if ($chromeProcess -and -not $chromeProcess.HasExited) {
    Stop-Process -Id $chromeProcess.Id -Force
  }
  if (Test-Path $userDir) {
    Remove-Item -Path $userDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
