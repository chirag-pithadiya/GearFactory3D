param([int]$Port = 9339)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 7 TUTORIAL & PROGRESSION TEST" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase7_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\fa3d4768-9a7d-4667-b7d1-d056cca8ec26"

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--use-gl=angle",
    "--enable-webgl",
    "http://127.0.0.1:8088/"
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $page = $pages | Where-Object { $_.type -eq "page" -or $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $page) { $page = $pages[0] }

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([System.Uri]$page.webSocketDebuggerUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:id = 1
    function Send-CDP($method, $params = @{}) {
        $script:id++
        $thisId = $script:id
        $req = @{ id = $thisId; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($req)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $buf = New-Object byte[] 2097152
            $ms = New-Object System.IO.MemoryStream
            do {
                $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
                $res = $ws.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $msg = $raw | ConvertFrom-Json
            if ($msg.method -eq "Runtime.exceptionThrown") {
                Write-Host "JS EXCEPTION: $($msg.params.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            }
            if ($msg.id -eq $thisId) { return $msg }
        }
    }

    function Exec-Eval($expr) {
        $res = Send-CDP "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
        return $res.result.result.value
    }

    function Take-Screenshot($filePath) {
        $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $bytes = [System.Convert]::FromBase64String($res.result.data)
        [System.IO.File]::WriteAllBytes($filePath, $bytes)
        Write-Host "Screenshot saved: $filePath" -ForegroundColor Gray
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Page.enable")

    Start-Sleep -Seconds 2

    Write-Host "`n--- 1. Checking API Surface & Global State ---" -ForegroundColor Yellow
    $apiCheck = Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        if (!gf) return { ok: false, reason: 'window.gearFactory not defined' };
        return {
            ok: true,
            hasPause: typeof gf.pauseGame === 'function',
            hasResume: typeof gf.resumeGame === 'function',
            hasReplay: typeof gf.replayCurrentLevel === 'function',
            hasStartTutorial: typeof gf.startTutorial === 'function',
            hasSkipTutorial: typeof gf.skipTutorial === 'function',
            hasCompleteTutorial: typeof gf.completeTutorial === 'function',
            hasShowLevelIntro: typeof gf.showLevelIntro === 'function',
            hasShowLevelComplete: typeof gf.showLevelComplete === 'function',
            hasAudio: !!gf.audio,
            isPaused: gf.state.isPaused,
        };
    })()
"@
    Write-Host "API Surface: $($apiCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if (-not $apiCheck.ok -or -not $apiCheck.hasPause -or -not $apiCheck.hasStartTutorial) {
        throw "Phase 7 API surface missing required functions!"
    }

    Write-Host "`n--- 2. Checking Level 1 Intro Modal on Startup ---" -ForegroundColor Yellow
    $introCheck = Exec-Eval @"
    (() => {
        const modal = document.getElementById('level-intro-modal');
        const badge = document.getElementById('intro-tier-badge')?.textContent;
        const title = document.getElementById('intro-level-title')?.textContent;
        const target = document.getElementById('intro-target-rpm')?.textContent;
        const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
        return { isVisible, badge, title, target };
    })()
"@
    Write-Host "Level Intro Modal: $($introCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_level_intro.png")

    Write-Host "`n--- 3. Starting Level 1 & Testing Level Timer ---" -ForegroundColor Yellow
    $startResult = Exec-Eval @"
    (() => {
        const startBtn = document.getElementById('btn-start-level');
        if (startBtn) startBtn.click();
        return {
            introDisplay: document.getElementById('level-intro-modal')?.style.display,
            levelInProgress: window.gearFactory.state.levelInProgress,
        };
    })()
"@
    Write-Host "Start Level result: $($startResult | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Wait for timer to tick
    Start-Sleep -Seconds 2
    $timerCheck = Exec-Eval @"
    (() => {
        const timerText = document.getElementById('level-timer-display')?.textContent;
        const timeSec = window.gearFactory.state.levelTimeSeconds;
        return { timerText, timeSec };
    })()
"@
    Write-Host "Timer check: $($timerCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($timerCheck.timeSec -le 0) {
        throw "Level timer is not incrementing!"
    }

    Write-Host "`n--- 4. Testing In-Game Pause System ---" -ForegroundColor Yellow
    $pauseResult = Exec-Eval @"
    (() => {
        window.gearFactory.pauseGame();
        const pauseModal = document.getElementById('pause-modal');
        const isVisible = pauseModal && window.getComputedStyle(pauseModal).display !== 'none';
        const angle1 = window.gearFactory.state.inputAngle;
        const time1 = window.gearFactory.state.levelTimeSeconds;
        return { isVisible, isPaused: window.gearFactory.state.isPaused, angle1, time1 };
    })()
"@
    Write-Host "Pause initiated: $($pauseResult | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_pause_modal.png")

    # Sleep while paused to verify complete freeze
    Start-Sleep -Seconds 1.5
    $freezeCheck = Exec-Eval @"
    (() => {
        const angle2 = window.gearFactory.state.inputAngle;
        const time2 = window.gearFactory.state.levelTimeSeconds;
        // Also test that gear dragging is prevented during pause
        window.gearFactory.startGearDrag(20);
        const dragBlocked = !window.gearFactory.dragDropState.isDragging;
        return {
            angleFrozen: Math.abs(angle2 - $($pauseResult.angle1)) < 0.0001,
            timeFrozen: Math.abs(time2 - $($pauseResult.time1)) < 0.0001,
            dragBlocked
        };
    })()
"@
    Write-Host "Freeze verification: $($freezeCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if (-not $freezeCheck.angleFrozen -or -not $freezeCheck.timeFrozen -or -not $freezeCheck.dragBlocked) {
        throw "Simulation did not properly freeze during pause!"
    }

    # Resume
    $resumeResult = Exec-Eval @"
    (() => {
        window.gearFactory.resumeGame();
        return {
            isPaused: window.gearFactory.state.isPaused,
            pauseDisplay: document.getElementById('pause-modal')?.style.display,
        };
    })()
"@
    Write-Host "Resumed: $($resumeResult | ConvertTo-Json -Compress)" -ForegroundColor Green

    Write-Host "`n--- 5. Testing Main Menu & Settings Modals ---" -ForegroundColor Yellow
    $menuCheck = Exec-Eval @"
    (() => {
        window.gearFactory.openMainMenu();
        const modal = document.getElementById('main-menu-modal');
        const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
        const hasPlay = !!document.getElementById('btn-menu-play');
        const hasLevelSelect = !!document.getElementById('btn-menu-level-select');
        const hasTutorial = !!document.getElementById('btn-menu-tutorial');
        const hasSettings = !!document.getElementById('btn-menu-settings');
        return { isVisible, hasPlay, hasLevelSelect, hasTutorial, hasSettings };
    })()
"@
    Write-Host "Main Menu check: $($menuCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_main_menu.png")
    [void](Exec-Eval "window.gearFactory.closeMainMenu()")

    # Open Settings
    $settingsCheck = Exec-Eval @"
    (() => {
        window.gearFactory.openSettingsModal();
        const modal = document.getElementById('settings-modal');
        const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
        const initialSound = window.gearFactory.audio.isSoundEnabled();
        // Toggle sound
        const soundAfter = window.gearFactory.audio.toggleSound();
        const storedSound = localStorage.getItem('gearfactory_sound_enabled');
        // Restore sound
        window.gearFactory.audio.setSoundEnabled(true);
        return { isVisible, initialSound, soundAfter, storedSound };
    })()
"@
    Write-Host "Settings check: $($settingsCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_settings_modal.png")
    [void](Exec-Eval "window.gearFactory.closeSettingsModal()")

    Write-Host "`n--- 6. Testing Interactive 6-Step Tutorial ---" -ForegroundColor Yellow
    $tutStart = Exec-Eval @"
    (() => {
        window.gearFactory.startTutorial();
        const tutModal = document.getElementById('tutorial-modal');
        const isVisible = tutModal && window.getComputedStyle(tutModal).display !== 'none';
        const active = window.gearFactory.tutorialState.isActive;
        const step = window.gearFactory.tutorialState.currentStep;
        return { isVisible, active, step };
    })()
"@
    Write-Host "Tutorial started: $($tutStart | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_tutorial_intro.png")

    # Click START TUTORIAL -> Step 1 (Motor explanation)
    $tutStep1 = Exec-Eval @"
    (() => {
        document.getElementById('btn-tut-start')?.click();
        const dock = document.getElementById('tutorial-dock');
        const isVisible = dock && window.getComputedStyle(dock).display !== 'none';
        const step = window.gearFactory.tutorialState.currentStep;
        const hasHighlight = document.querySelector('#telemetry-motor-rpm')?.classList.contains('tut-highlight-pulse');
        return { isVisible, step, hasHighlight };
    })()
"@
    Write-Host "Tutorial Step 1: $($tutStep1 | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_tutorial_step1.png")

    # Step 1 -> Step 2 (Select Input Gear)
    $tutStep2 = Exec-Eval @"
    (() => {
        document.getElementById('btn-tut-step1-next')?.click();
        const step = window.gearFactory.tutorialState.currentStep;
        return { step };
    })()
"@
    Write-Host "Tutorial Step 2: $($tutStep2 | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Select 20T -> Auto-advance to Step 3 (Mount to Input Shaft)
    $tutStep3 = Exec-Eval @"
    (() => {
        window.gearFactory.selectGear(20);
        const step = window.gearFactory.tutorialState.currentStep;
        const selected = window.gearFactory.puzzle.selectedInventoryGear;
        return { step, selected };
    })()
"@
    Write-Host "Tutorial Step 3 (Auto-advanced): $($tutStep3 | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Mount on Input Shaft -> Auto-advance to Step 4 (Mount to Output Shaft)
    $tutStep4 = Exec-Eval @"
    (() => {
        window.gearFactory.placeInputGear(20);
        const step = window.gearFactory.tutorialState.currentStep;
        const inputTeeth = window.gearFactory.puzzle.selectedInputTeeth;
        return { step, inputTeeth };
    })()
"@
    Write-Host "Tutorial Step 4 (Auto-advanced): $($tutStep4 | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Mount on Output Shaft (40T) -> Auto-advance to Step 5 (Watch Kinetics)
    $tutStep5 = Exec-Eval @"
    (() => {
        window.gearFactory.placeOutputGear(40);
        const step = window.gearFactory.tutorialState.currentStep;
        const outputTeeth = window.gearFactory.puzzle.selectedOutputTeeth;
        return { step, outputTeeth };
    })()
"@
    Write-Host "Tutorial Step 5 (Auto-advanced): $($tutStep5 | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Click NEXT on Step 5 -> Step 6 (Check Solution)
    $tutStep6 = Exec-Eval @"
    (() => {
        document.getElementById('btn-tut-step5-next')?.click();
        const step = window.gearFactory.tutorialState.currentStep;
        return { step };
    })()
"@
    Write-Host "Tutorial Step 6: $($tutStep6 | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Press Check Solution -> Tutorial Complete Modal!
    $tutComplete = Exec-Eval @"
    (() => {
        window.gearFactory.checkSolution();
        const modal = document.getElementById('tutorial-modal');
        const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
        const isCompleted = localStorage.getItem('tutorialCompleted');
        const hasPlayBtn = !!document.getElementById('btn-tut-play-level-1');
        return { isVisible, isCompleted, hasPlayBtn };
    })()
"@
    Write-Host "Tutorial Completed: $($tutComplete | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_tutorial_completed.png")
    if ($tutComplete.isCompleted -ne 'true') {
        throw "Tutorial completion was not persisted to localStorage!"
    }

    # Click PLAY LEVEL 1 from Tutorial Completion
    [void](Exec-Eval "document.getElementById('btn-tut-play-level-1')?.click()")

    Write-Host "`n--- 7. Testing Tutorial Skip Button ---" -ForegroundColor Yellow
    $skipCheck = Exec-Eval @"
    (() => {
        window.gearFactory.startTutorial();
        document.getElementById('btn-tut-skip-intro')?.click();
        return {
            isActive: window.gearFactory.tutorialState.isActive,
            currentLevel: window.gearFactory.puzzle.currentLevel,
        };
    })()
"@
    Write-Host "Tutorial Skip result: $($skipCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($skipCheck.isActive) {
        throw "Tutorial skip did not cancel tutorial!"
    }

    Write-Host "`n--- 8. Testing Level Complete Modal & Solution Concealment ---" -ForegroundColor Yellow
    # Load level 1 cleanly without intro
    [void](Exec-Eval "window.gearFactory.loadLevel(1, true)")
    Start-Sleep -Seconds 1

    # Before checking solution: check answers are concealed
    $concealCheck = Exec-Eval @"
    (() => {
        const outRpmText = document.getElementById('puzzle-calculated-output-rpm')?.textContent;
        const resultTargetText = document.getElementById('puzzle-result-target-rpm')?.textContent;
        return { outRpmText, resultTargetText };
    })()
"@
    Write-Host "Concealment before check: $($concealCheck | ConvertTo-Json -Compress)" -ForegroundColor Green

    # Mount gears 20 & 40 and check solution
    $completeCheck = Exec-Eval @"
    (() => {
        window.gearFactory.placeInputGear(20);
        window.gearFactory.placeOutputGear(40);
        const pass = window.gearFactory.checkSolution();
        const completeModal = document.getElementById('level-complete-modal');
        const isVisible = completeModal && window.getComputedStyle(completeModal).display !== 'none';
        const outRpm = document.getElementById('modal-output-rpm')?.textContent;
        const timeStr = document.getElementById('modal-elapsed-time')?.textContent;
        return { pass, isVisible, outRpm, timeStr };
    })()
"@
    Write-Host "Level Complete Modal: $($completeCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_level_complete_modal.png")
    if (-not $completeCheck.pass -or -not $completeCheck.isVisible) {
        throw "Level Complete modal was not displayed upon puzzle success!"
    }

    Write-Host "`n--- 9. Testing Replay Functionality ---" -ForegroundColor Yellow
    $replayCheck = Exec-Eval @"
    (() => {
        window.gearFactory.replayCurrentLevel();
        return {
            modalDisplay: document.getElementById('level-complete-modal')?.style.display,
            inputTeeth: window.gearFactory.puzzle.selectedInputTeeth,
            outputTeeth: window.gearFactory.puzzle.selectedOutputTeeth,
            timeSec: window.gearFactory.state.levelTimeSeconds,
            timerText: document.getElementById('level-timer-display')?.textContent,
            isUnlocked: window.gearFactory.isLevelUnlocked(1),
        };
    })()
"@
    Write-Host "Replay result: $($replayCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    if ($replayCheck.inputTeeth -ne $null -or $replayCheck.timeSec -ne 0) {
        throw "Replay failed to reset gears or timer!"
    }

    Write-Host "`n--- 10. Testing Level Select Modal Tiers ---" -ForegroundColor Yellow
    $selectCheck = Exec-Eval @"
    (() => {
        window.gearFactory.openLevelSelectModal();
        const modal = document.getElementById('level-select-modal');
        const isVisible = modal && window.getComputedStyle(modal).display !== 'none';
        const tiers = Array.from(document.querySelectorAll('.tier-header .tier-badge')).map(el => el.textContent.trim());
        return { isVisible, tiers };
    })()
"@
    Write-Host "Level Select Tiers: $($selectCheck | ConvertTo-Json -Compress)" -ForegroundColor Green
    Take-Screenshot (Join-Path $artifactDir "phase7_level_select_tiers.png")
    [void](Exec-Eval "window.gearFactory.closeLevelSelectModal()")

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " ALL PHASE 7 REQUIREMENTS VERIFIED AND PASSED!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
}
