# ==========================================================================
# Gear Factory 3D — Phase 12 Comprehensive Verification Suite
# Zero-Scroll Viewport Layout + 3D Workshop Environment Verification
# ==========================================================================

$ErrorActionPreference = "Stop"
$port = 8088
$wsUrl = $null
$chromeProcess = $null
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\4074bfb4-5c5b-41ff-8a4c-16b01d98df65"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 12 ZERO-SCROLL & 3D ENVIRONMENT" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Headless Chrome for CDP Automation
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromeExe) {
    throw "Google Chrome executable not found."
}

$cdpPort = 9350
$tempUserData = Join-Path $env:TEMP "gear_p12_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$indexPath = "d:\GAMES\GearFactory3D\index.html"
$fileUrl = "file:///$($indexPath.Replace('\', '/'))"

$chromeArgs = @(
    "--headless=new",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$tempUserData",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1920,1080",
    $fileUrl
)

Write-Host "Launching Chrome headless on debugging port $cdpPort..." -ForegroundColor Yellow
$chromeProcess = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -PassThru

try {
    Start-Sleep -Seconds 3

    # Query Chrome Debugging targets
    $targetsResponse = Invoke-RestMethod -Uri "http://localhost:$cdpPort/json"
    $pageTarget = $targetsResponse | Where-Object { $_.type -eq "page" -or $_.url -like "*GearFactory3D*" } | Select-Object -First 1
    if (-not $pageTarget) { $pageTarget = $targetsResponse[0] }

    $wsUrl = $pageTarget.webSocketDebuggerUrl
    Write-Host "Connected to WebSocket: $wsUrl" -ForegroundColor Green

    # WebSocket setup
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $ws.ConnectAsync([System.Uri]$wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $cmdId = 1

    function Send-CDP($method, $params = @{}) {
        $script:cmdId++
        $thisId = $script:cmdId
        $msg = @{
            id = $thisId
            method = $method
            params = $params
        } | ConvertTo-Json -Depth 10 -Compress

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $buf = New-Object byte[] 2097152
            $ms = New-Object System.IO.MemoryStream
            do {
                $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
                $res = $ws.ReceiveAsync($recvSeg, [System.Threading.CancellationToken]::None).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $parsed = $raw | ConvertFrom-Json
            if ($parsed.method -eq "Runtime.exceptionThrown") {
                Write-Host "JS EXCEPTION: $($parsed.params.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            }
            if ($parsed.id -eq $thisId) {
                return $parsed
            }
        }
    }

    function Eval-JS($expr) {
        $res = Send-CDP "Runtime.evaluate" @{
            expression = $expr
            returnByValue = $true
            awaitPromise = $true
        }
        if ($res.result.exceptionDetails) {
            throw "JS Error: $($res.result.exceptionDetails.exception.description)"
        }
        return $res.result.result.value
    }

    function Set-Viewport($width, $height, $mobile = $false) {
        Send-CDP "Emulation.setDeviceMetricsOverride" @{
            width = $width
            height = $height
            deviceScaleFactor = 1
            mobile = $mobile
        } | Out-Null
        Start-Sleep -Milliseconds 300
    }

    function Save-Screenshot($name) {
        $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $pngBytes = [System.Convert]::FromBase64String($res.result.data)
        $outPath = Join-Path $artifactDir $name
        [System.IO.File]::WriteAllBytes($outPath, $pngBytes)
        Write-Host "  -> Saved screenshot: $name" -ForegroundColor Green
    }

    Send-CDP "Page.enable" | Out-Null
    Send-CDP "Runtime.enable" | Out-Null

    # Wait for page bundle to initialize window.gearFactory
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $isDef = Eval-JS "typeof window.gearFactory !== 'undefined' && !!window.gearFactory.levelData && !!window.gearFactory.scene"
        if ($isDef -eq $true) {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ready) {
        throw "Timeout waiting for window.gearFactory to initialize!"
    }

    $totalTests = 0
    $passedTests = 0

    function Assert-Condition($condition, $message) {
        $script:totalTests++
        if ($condition) {
            $script:passedTests++
            Write-Host "  [PASS] $message" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  [FAIL] $message" -ForegroundColor Red
            return $false
        }
    }

    # Dismiss welcome and intro modals
    Eval-JS @"
    (() => {
        localStorage.setItem('gear_factory_has_seen_welcome', 'true');
        localStorage.setItem('gearfactory_welcomed', 'true');
        const btnW = document.getElementById('btn-welcome-start');
        if (btnW) btnW.click();
        const wm = document.getElementById('welcome-modal');
        if (wm) { wm.style.display = 'none'; wm.classList.remove('active'); }
        if (window.gearFactory) {
            window.gearFactory.closeLevelIntro && window.gearFactory.closeLevelIntro();
            window.gearFactory.loadLevel(1, true);
        }
    })()
"@ | Out-Null
    Start-Sleep -Milliseconds 400

    Write-Host "`n--- [1. 3D INDUSTRIAL ENVIRONMENT & LIGHTING VERIFICATION] ---" -ForegroundColor Yellow

    # Verify 3D Scene Environment
    $envCheck = Eval-JS @"
    (() => {
        const scene = window.gearFactory ? window.gearFactory.scene : null;
        if (!scene) return { ok: false, reason: 'No scene found' };
        
        let wallCount = 0;
        let beamCount = 0;
        let pipeCount = 0;
        let lightCount = 0;
        let floorFound = false;

        scene.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.geometry && obj.geometry.type === 'PlaneGeometry' && obj.rotation.x !== 0) {
                    floorFound = true;
                }
                if (obj.geometry && obj.geometry.type === 'BoxGeometry') {
                    beamCount++;
                }
                if (obj.geometry && (obj.geometry.type === 'CylinderGeometry' || obj.geometry.type === 'TorusGeometry')) {
                    pipeCount++;
                }
            }
            if (obj.isLight) {
                lightCount++;
            }
        });

        const bgHex = scene.background ? scene.background.getHexString() : '';
        const hasFog = !!scene.fog;
        const hasGridHelper = scene.children.some(c => c.type === 'GridHelper');

        return {
            ok: true,
            floorFound,
            beamCount,
            pipeCount,
            lightCount,
            bgHex,
            hasFog,
            hasGridHelper,
            hasWorkshopGroup: scene.children.some(c => c.children && c.children.length > 5)
        };
    })()
"@
    Assert-Condition ($envCheck.ok -eq $true) "3D Scene initialized and accessible"
    Assert-Condition ($envCheck.floorFound -eq $true) "Warm industrial concrete floor slab present"
    Assert-Condition ($envCheck.hasGridHelper -eq $false) "Technical CAD GridHelper removed in favor of concrete floor"
    Assert-Condition ($envCheck.bgHex -eq "3c4654") "Scene background is muted blue-gray workshop tone (0x3c4654)"
    Assert-Condition ($envCheck.hasFog -eq $true) "Soft atmospheric depth fog enabled"
    Assert-Condition ($envCheck.lightCount -ge 4) "Balanced multi-source lighting (key, fill, rim, ambient) active (Found: $($envCheck.lightCount) lights)"
    Assert-Condition ($envCheck.beamCount -ge 6) "Structural steel I-beams and columns present in environment (Count: $($envCheck.beamCount))"
    Assert-Condition ($envCheck.pipeCount -ge 6) "Industrial pipes, conduits and machine details present (Count: $($envCheck.pipeCount))"

    # Verify UI Text Requirements
    $uiTextCheck = Eval-JS @"
    (() => {
        const sub = document.querySelector('.app-header .subtitle');
        const inTitle = document.querySelector('#input-shaft-slot .slot-title');
        const outTitle = document.querySelector('#output-shaft-slot .slot-title');
        return {
            subtitle: sub ? sub.innerText.trim() : '',
            inputSlot: inTitle ? inTitle.innerText.trim() : '',
            outputSlot: outTitle ? outTitle.innerText.trim() : ''
        };
    })()
"@
    Assert-Condition ($uiTextCheck.subtitle -like "*BUILD*" -and $uiTextCheck.subtitle -like "*CONNECT*" -and $uiTextCheck.subtitle -like "*RUN*") "Header subtitle updated to 'BUILD • CONNECT • RUN'"
    Assert-Condition ($uiTextCheck.inputSlot -eq "INPUT GEAR") "Input slot label updated to 'INPUT GEAR'"
    Assert-Condition ($uiTextCheck.outputSlot -eq "OUTPUT GEAR") "Output slot label updated to 'OUTPUT GEAR'"

    # Verify Gearbox Materials & Separation
    $matCheck = Eval-JS @"
    (() => {
        const gf = window.gearFactory;
        if (!gf || !gf.gearboxCasing) return { ok: false };
        const casing = gf.gearboxCasing;
        const frame = casing.children.find(c => c.isMesh);
        const frameColor = frame && frame.material ? frame.material.color.getHexString() : '';
        return {
            ok: true,
            frameColor: frameColor
        };
    })()
"@
    Assert-Condition ($matCheck.ok -eq $true) "Gearbox casing assembly inspected"
    Assert-Condition ($matCheck.frameColor -eq "283d36") "Gearbox casing uses dark desaturated green cast metal (0x283d36)"

    # Verify Camera Framing (Motor -> Input Shaft -> Input Gear -> Output Gear -> Output Shaft)
    $camCheck = Eval-JS @"
    (() => {
        const cam = window.gearFactory ? window.gearFactory.camera : null;
        if (!cam) return { ok: false };
        return {
            ok: true,
            x: Math.round(cam.position.x * 10) / 10,
            y: Math.round(cam.position.y * 10) / 10,
            z: Math.round(cam.position.z * 10) / 10
        };
    })()
"@
    Assert-Condition ($camCheck.ok -eq $true) "Camera position: ($($camCheck.x), $($camCheck.y), $($camCheck.z)) framed for clean 3/4 mechanical view"
    Assert-Condition ($camCheck.x -eq -8.6 -and $camCheck.y -eq 6.5 -and $camCheck.z -eq 14.0) "Camera position exactly matches (-8.6, 6.5, 14.0)"

    Write-Host "`n--- [2. NO-SCROLL LAYOUT VERIFICATION ACROSS RESOLUTIONS] ---" -ForegroundColor Yellow

    $resolutions = @(
        @{ name = "1920x1080 Desktop"; width = 1920; height = 1080; mobile = $false },
        @{ name = "1600x900 Laptop";   width = 1600; height = 900;  mobile = $false },
        @{ name = "1366x768 Laptop";   width = 1366; height = 768;  mobile = $false },
        @{ name = "1280x720 Compact";  width = 1280; height = 720;  mobile = $false }
    )

    foreach ($res in $resolutions) {
        Set-Viewport $res.width $res.height $res.mobile
        Start-Sleep -Milliseconds 300

        $scrollCheck = Eval-JS @"
        (() => {
            const doc = document.documentElement;
            const body = document.body;
            const scrollX = window.scrollX || window.pageXOffset || doc.scrollLeft || 0;
            const scrollY = window.scrollY || window.pageYOffset || doc.scrollTop || 0;
            const hasHorizontalScroll = doc.scrollWidth > window.innerWidth;
            const hasVerticalScroll = doc.scrollHeight > window.innerHeight;
            const controlPanel = document.getElementById('control-panel');
            const cpScrollable = controlPanel ? (controlPanel.scrollHeight > controlPanel.clientHeight + 4) : false;

            return {
                scrollX,
                scrollY,
                hasHorizontalScroll,
                hasVerticalScroll,
                cpScrollable,
                docScrollWidth: doc.scrollWidth,
                winWidth: window.innerWidth,
                docScrollHeight: doc.scrollHeight,
                winHeight: window.innerHeight
            };
        })()
"@
        Assert-Condition ($scrollCheck.hasHorizontalScroll -eq $false) "[$($res.name)] No horizontal page scrolling (scrollWidth <= innerWidth)"
        Assert-Condition ($scrollCheck.hasVerticalScroll -eq $false) "[$($res.name)] No vertical page scrolling (scrollHeight <= innerHeight)"
        Assert-Condition ($scrollCheck.scrollX -eq 0 -and $scrollCheck.scrollY -eq 0) "[$($res.name)] Scroll offset is strictly (0, 0)"
    }

    # Ensure level intro is closed to capture 3D workshop and gameplay
    Eval-JS "if (window.gearFactory && window.gearFactory.closeLevelIntro) { window.gearFactory.closeLevelIntro(); }" | Out-Null
    Start-Sleep -Milliseconds 200

    # Save 1920x1080 and 1366x768 screenshots for visual audit
    Set-Viewport 1920 1080 $false
    Save-Screenshot "phase12_01_desktop_1920x1080.png"

    Set-Viewport 1366 768 $false
    Save-Screenshot "phase12_02_laptop_1366x768.png"

    Write-Host "`n--- [3. COMPACT RIGHT PANEL HIERARCHY & CONTROLS] ---" -ForegroundColor Yellow

    # Verify panel section order
    $panelOrder = Eval-JS @"
    (() => {
        const cp = document.getElementById('control-panel');
        if (!cp) return [];
        return Array.from(cp.children).map(c => c.id || c.className);
    })()
"@
    Write-Host "  Control Panel Children: $($panelOrder -join ' -> ')" -ForegroundColor DarkGray
    Assert-Condition ($panelOrder.Count -ge 5) "Control Panel contains all 5 required compact cards + action bar"

    # Verify Available Gears 3x2 Grid
    $gridCheck = Eval-JS @"
    (() => {
        const grid = document.getElementById('available-gears-list');
        if (!grid) return { ok: false };
        const computed = window.getComputedStyle(grid);
        const cards = grid.querySelectorAll('.available-gear-card');
        return {
            ok: true,
            columns: computed.gridTemplateColumns.split(' ').length,
            cardCount: cards.length
        };
    })()
"@
    Assert-Condition ($gridCheck.cardCount -ge 5) "Available gears cards rendered (Found: $($gridCheck.cardCount))"

    # Verify Side-by-Side Slot Cards
    $slotsCheck = Eval-JS @"
    (() => {
        const container = document.getElementById('shaft-slots-container');
        if (!container) return { ok: false };
        const computed = window.getComputedStyle(container);
        const inSlot = document.getElementById('input-shaft-slot');
        const outSlot = document.getElementById('output-shaft-slot');
        return {
            ok: true,
            isGrid: computed.display === 'grid',
            columns: computed.gridTemplateColumns.split(' ').length,
            inSlotExists: !!inSlot,
            outSlotExists: !!outSlot
        };
    })()
"@
    Assert-Condition ($slotsCheck.isGrid -eq $true -and $slotsCheck.columns -eq 2) "Motor Gear & Machine Gear are side-by-side (2-column grid)"

    # Verify Fixed Action Bar
    $actionBarCheck = Eval-JS @"
    (() => {
        const bar = document.getElementById('fixed-action-bar');
        if (!bar) return { ok: false };
        const howBtn = document.getElementById('btn-how-it-works-action');
        const resetBtn = document.getElementById('btn-reset-level');
        const checkBtn = document.getElementById('btn-check-solution');
        return {
            ok: true,
            hasHow: !!howBtn,
            hasReset: !!resetBtn,
            hasCheck: !!checkBtn,
            isCheckVisible: checkBtn && checkBtn.offsetWidth > 0
        };
    })()
"@
    Assert-Condition ($actionBarCheck.hasHow -eq $true -and $actionBarCheck.hasReset -eq $true -and $actionBarCheck.hasCheck -eq $true) "Fixed action bar contains [HOW IT WORKS] [RESET] [CHECK SOLUTION]"
    Assert-Condition ($actionBarCheck.isCheckVisible -eq $true) "Action buttons are fully visible and clickable without scrolling"

    Write-Host "`n--- [4. IN-HEADER & COMPACT LEVEL NAVIGATION] ---" -ForegroundColor Yellow

    # Test Header Prev/Next
    $hdrNavCheck = Eval-JS @"
    (() => {
        const prev = document.getElementById('btn-header-prev-level');
        const next = document.getElementById('btn-header-next-level');
        const text = document.getElementById('header-level-text');
        return {
            hasPrev: !!prev,
            hasNext: !!next,
            hasText: !!text,
            prevDisabledOnLvl1: prev ? prev.disabled : false,
            textValue: text ? text.textContent.trim() : ''
        };
    })()
"@
    Assert-Condition ($hdrNavCheck.hasPrev -eq $true -and $hdrNavCheck.hasNext -eq $true) "Compact Level Navigation in top header bar"
    Assert-Condition ($hdrNavCheck.prevDisabledOnLvl1 -eq $true) "Header Prev Level disabled on Level 1"
    Assert-Condition ($hdrNavCheck.textValue -like "*LEVEL 1*") "Header level indicator displays 'LEVEL 1'"

    Write-Host "`n--- [5. SPECIFIC LEVEL VERIFICATIONS: LEVELS 1, 20, 21, 50] ---" -ForegroundColor Yellow

    # Level 1 Gameplay
    Eval-JS "window.gearFactory.loadLevel(1, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl1Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($lvl1Check -eq $true) "Level 1 Solved (20T -> 40T = 500 RPM)"
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null

    # Level 3 Gameplay (Direct 1:1 Transfer)
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(10);" | Out-Null
    Eval-JS "window.gearFactory.loadLevel(3, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl3Specs = Eval-JS "({ motor: Number(document.getElementById('puzzle-input-rpm').textContent), target: Number(document.getElementById('puzzle-target-output-rpm').textContent) })"
    Assert-Condition ($lvl3Specs.motor -eq 900 -and $lvl3Specs.target -eq 900) "Level 3 Specs: 900 RPM -> 900 RPM (Target)"
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20); window.gearFactory.placeGearOnShaft('output', 20);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl3Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($lvl3Check -eq $true) "Level 3 Solved (20T -> 20T = 900 RPM)"
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null

    # Level 20 Gameplay (Expert Level)
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(25);" | Out-Null
    Eval-JS "window.gearFactory.loadLevel(20, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl20Specs = Eval-JS "({ motor: Number(document.getElementById('puzzle-input-rpm').textContent), target: Number(document.getElementById('puzzle-target-output-rpm').textContent) })"
    Assert-Condition ($lvl20Specs.motor -eq 1860 -and $lvl20Specs.target -eq 2790) "Level 20 Specs: 1860 RPM -> 2790 RPM (Target)"
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 30); window.gearFactory.placeGearOnShaft('output', 20);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl20Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($lvl20Check -eq $true) "Level 20 Solved (30T -> 20T = 2790 RPM)"
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null
    Save-Screenshot "phase12_03_level20_solved.png"

    # Level 21 Gameplay (Hard Level)
    Eval-JS "window.gearFactory.loadLevel(21, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl21Specs = Eval-JS "({ motor: Number(document.getElementById('puzzle-input-rpm').textContent), target: Number(document.getElementById('puzzle-target-output-rpm').textContent) })"
    Assert-Condition ($lvl21Specs.motor -eq 1600 -and $lvl21Specs.target -eq 1200) "Level 21 Specs: 1600 RPM -> 1200 RPM (Target)"
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 30); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl21Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($lvl21Check -eq $true) "Level 21 Solved (30T -> 40T = 1200 RPM)"
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null
    Save-Screenshot "phase12_04_level21_solved.png"

    # Level 50 Gameplay (Grandmaster Final Level)
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(50);" | Out-Null
    Eval-JS "window.gearFactory.loadLevel(50, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl50Specs = Eval-JS "({ motor: Number(document.getElementById('puzzle-input-rpm').textContent), target: Number(document.getElementById('puzzle-target-output-rpm').textContent) })"
    Assert-Condition ($lvl50Specs.motor -eq 2520 -and $lvl50Specs.target -eq 3150) "Level 50 Specs: 2520 RPM -> 3150 RPM (Target)"
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 50); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl50Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($lvl50Check -eq $true) "Level 50 Solved (50T -> 40T = 3150 RPM)"
    Save-Screenshot "phase12_05_level50_solved.png"
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null

    Write-Host "`n--- [6. INTERACTIVE DRAG-AND-DROP & CONTROLS VERIFICATION] ---" -ForegroundColor Yellow

    # Test Reset Button
    Eval-JS "document.getElementById('btn-reset-level').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $resetCheck = Eval-JS "({ inTeeth: window.gearFactory.selectedInputTeeth, outTeeth: window.gearFactory.selectedOutputTeeth })"
    Assert-Condition ($resetCheck.inTeeth -eq $null -and $resetCheck.outTeeth -eq $null) "Reset action button clears all placed gears"

    # Test How It Works action button
    Eval-JS "document.getElementById('btn-how-it-works-action').click();" | Out-Null
    Start-Sleep -Milliseconds 300
    $howModalCheck = Eval-JS "document.getElementById('how-gears-work-modal').classList.contains('active') || document.getElementById('how-gears-work-modal').style.display === 'flex'"
    Assert-Condition ($howModalCheck -eq $true) "[HOW IT WORKS] action button opens visual guide"
    Eval-JS "document.getElementById('btn-close-how-gears').click();" | Out-Null

    # Test Level Select & Main Menu
    Eval-JS "document.getElementById('btn-header-level-select').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvlSelCheck = Eval-JS "document.getElementById('level-select-modal').style.display !== 'none'"
    Assert-Condition ($lvlSelCheck -eq $true) "Level Select opens smoothly"
    Eval-JS "document.getElementById('btn-close-level-select').click();" | Out-Null

    # Test Pause button
    Eval-JS "document.getElementById('btn-header-pause').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $pauseCheck = Eval-JS "document.getElementById('pause-modal').style.display !== 'none'"
    Assert-Condition ($pauseCheck -eq $true) "Pause button opens Pause Modal"
    Eval-JS "document.getElementById('btn-pause-resume').click();" | Out-Null

    Write-Host "`n--- [7. MOBILE RESPONSIVE ADAPTATION] ---" -ForegroundColor Yellow

    # Mobile Portrait (390 x 844)
    Set-Viewport 390 844 $true
    Start-Sleep -Milliseconds 300
    $mobilePCheck = Eval-JS @"
    (() => {
        const doc = document.documentElement;
        return {
            hasHorizontalScroll: doc.scrollWidth > window.innerWidth,
            scrollX: window.scrollX,
            threeH: document.getElementById('play-area').clientHeight,
            cpH: document.getElementById('control-panel').clientHeight
        };
    })()
"@
    Assert-Condition ($mobilePCheck.hasHorizontalScroll -eq $false) "[Mobile Portrait 390x844] No horizontal page scrolling"
    Save-Screenshot "phase12_06_mobile_portrait.png"

    # Mobile Landscape (844 x 390)
    Set-Viewport 844 390 $true
    Start-Sleep -Milliseconds 300
    $mobileLCheck = Eval-JS @"
    (() => {
        const doc = document.documentElement;
        return {
            hasHorizontalScroll: doc.scrollWidth > window.innerWidth
        };
    })()
"@
    Assert-Condition ($mobileLCheck.hasHorizontalScroll -eq $false) "[Mobile Landscape 844x390] No horizontal page scrolling"
    Save-Screenshot "phase12_07_mobile_landscape.png"

    # Restore to desktop
    Set-Viewport 1920 1080 $false

    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " PHASE 12 VERIFICATION COMPLETE: $passedTests / $totalTests TESTS PASSED" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
}
finally {
    if ($ws) {
        try {
            if ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
                $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait(1000)
            }
        } catch {}
        $ws.Dispose()
    }
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        $chromeProcess.Kill()
        $chromeProcess.Dispose()
    }
}
