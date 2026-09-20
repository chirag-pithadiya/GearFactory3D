param([int]$Port = 9335)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 4 LEVEL SYSTEM TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase4_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"

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
            if ($msg.id -eq $thisId) {
                return $msg
            }
        }
    }

    function Exec-Eval($expr) {
        $res = Send-CDP "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
        return $res.result.result.value
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false })

    Start-Sleep -Seconds 2

    # -------------------------------------------------------------
    # STEP 1: Level Validation Suite (Requirement 16)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 1] Validating all 20 levels mathematically..." -ForegroundColor Yellow
    $codeVal = @"
    (() => {
        const gf = window.gearFactory;
        const res = gf.validateLevels();
        return {
            totalLevels: gf.levelData.length,
            allPass: res.allPass,
            results: res.results
        };
    })()
"@
    $valRes = Exec-Eval $codeVal
    Write-Host "Total Levels: $($valRes.totalLevels), All Passed: $($valRes.allPass)"

    if ($valRes.totalLevels -eq 20 -and $valRes.allPass) {
        Write-Host "PASS: All 20 levels have at least one mathematically valid solution!" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Level validation failed!" -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 2: Clear Progress & Verify Clean State (Requirement 9, 10, 14)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 2] Verifying initial progression state (Level 1 unlocked, Levels 2-20 locked)..." -ForegroundColor Yellow
    $codeInitState = @"
    (() => {
        localStorage.clear();
        const gf = window.gearFactory;
        gf.loadLevel(1);
        return {
            highest: gf.getHighestUnlockedLevel(),
            completed: gf.getCompletedLevels(),
            curLevel: gf.puzzle.currentLevel,
            motorRPM: gf.state.targetInputRPM,
            targetRPM: gf.state.targetOutputRPM,
            isL1Unlocked: gf.isLevelUnlocked(1),
            isL2Unlocked: gf.isLevelUnlocked(2),
            isL20Unlocked: gf.isLevelUnlocked(20)
        };
    })()
"@
    $initState = Exec-Eval $codeInitState
    Write-Host "Current Level: $($initState.curLevel) (Motor: $($initState.motorRPM) RPM, Target: $($initState.targetRPM) RPM)"
    Write-Host "Level 1 Unlocked: $($initState.isL1Unlocked) | Level 2 Unlocked: $($initState.isL2Unlocked) | Level 20 Unlocked: $($initState.isL20Unlocked)"

    if ($initState.curLevel -eq 1 -and $initState.isL1Unlocked -and -not $initState.isL2Unlocked -and -not $initState.isL20Unlocked) {
        Write-Host "PASS: Initial progress clean. Level 1 unlocked, Levels 2-20 locked." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Initial lock states incorrect." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 3: Complete Level 1 & Unlock Level 2 (Requirement 8, 9)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 3] Solving Level 1 (20T In, 40T Out -> 500 RPM)..." -ForegroundColor Yellow
    $codeSolveL1 = @"
    (() => {
        const gf = window.gearFactory;
        gf.placeInputGear(20);
        gf.placeOutputGear(40);
        const isPass = gf.checkSolution();
        return {
            isPass,
            highestAfter: gf.getHighestUnlockedLevel(),
            completedAfter: gf.getCompletedLevels(),
            nextBtnEnabled: !document.getElementById('btn-next-level')?.disabled,
            outputTileVal: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $solveL1 = Exec-Eval $codeSolveL1
    Write-Host "Solution Check: isPass=$($solveL1.isPass), Output Telemetry=$($solveL1.outputTileVal)"
    Write-Host "Highest Unlocked: $($solveL1.highestAfter), Completed: $(ConvertTo-Json -Compress $solveL1.completedAfter)"

    if ($solveL1.isPass -and $solveL1.highestAfter -ge 2 -and ($solveL1.completedAfter -contains 1) -and $solveL1.nextBtnEnabled) {
        Write-Host "PASS: Level 1 completed, Level 2 unlocked, Next Level button enabled." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Level 1 completion failed." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 4: Advance to Level 2 (Requirement 12)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 4] Advancing to Level 2 (Motor: 600 RPM, Target: 1200 RPM)..." -ForegroundColor Yellow
    $codeLvl2 = @"
    (() => {
        const gf = window.gearFactory;
        document.getElementById('btn-next-level')?.click();
        return {
            curLevel: gf.puzzle.currentLevel,
            motorRPM: gf.state.targetInputRPM,
            targetRPM: gf.state.targetOutputRPM,
            inGear: !!gf.inputGear,
            outGear: !!gf.outputGear,
            btnInText: document.getElementById('btn-place-input-text')?.textContent.trim(),
            btnOutText: document.getElementById('btn-place-output-text')?.textContent.trim(),
            telemetryMotor: document.getElementById('telemetry-motor-rpm')?.textContent.trim(),
            telemetryOut: document.getElementById('telemetry-output-rpm')?.textContent.trim()
        };
    })()
"@
    $lvl2Res = Exec-Eval $codeLvl2
    Write-Host "Level 2: Motor=$($lvl2Res.motorRPM) RPM, Target=$($lvl2Res.targetRPM) RPM"
    Write-Host "Slots: InGear=$($lvl2Res.inGear) ($($lvl2Res.btnInText)), OutGear=$($lvl2Res.outGear) ($($lvl2Res.btnOutText))"
    Write-Host "Telemetry -> Motor: $($lvl2Res.telemetryMotor), Output: $($lvl2Res.telemetryOut)"

    if ($lvl2Res.curLevel -eq 2 -and $lvl2Res.motorRPM -eq 600 -and $lvl2Res.targetRPM -eq 1200 -and -not $lvl2Res.inGear -and -not $lvl2Res.outGear) {
        Write-Host "PASS: Level 2 loaded with correct RPM parameters and empty placement slots." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Level 2 failed to load properly." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 5: Test Progress Persistence across Reload (Requirement 14)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 5] Testing page refresh persistence via localStorage..." -ForegroundColor Yellow
    [void](Send-CDP "Page.reload")
    Start-Sleep -Seconds 3

    $codeReloadCheck = @"
    (() => {
        const gf = window.gearFactory;
        return {
            curLevel: gf.puzzle.currentLevel,
            highestUnlocked: gf.getHighestUnlockedLevel(),
            completedList: gf.getCompletedLevels(),
            isL1Completed: gf.getCompletedLevels().includes(1),
            isL2Unlocked: gf.isLevelUnlocked(2)
        };
    })()
"@
    $reloadCheck = Exec-Eval $codeReloadCheck
    Write-Host "After Refresh: Active Level=$($reloadCheck.curLevel), Highest Unlocked=$($reloadCheck.highestUnlocked)"
    Write-Host "Level 1 Completed: $($reloadCheck.isL1Completed), Level 2 Unlocked: $($reloadCheck.isL2Unlocked)"

    if ($reloadCheck.isL1Completed -and $reloadCheck.isL2Unlocked -and $reloadCheck.curLevel -eq 2) {
        Write-Host "PASS: Progress successfully survived page reload! Resumed at Level 2." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Progress lost after page reload!" -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 6: Level Select Modal Verification (Requirement 10, 15)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 6] Opening Level Select Screen Modal..." -ForegroundColor Yellow
    $codeModalOpen = @"
    (() => {
        document.getElementById('btn-header-level-select')?.click();
        const modal = document.getElementById('level-select-modal');
        const tiles = modal.querySelectorAll('.level-tile');
        const l1Tile = tiles[0];
        const l2Tile = tiles[1];
        const l3Tile = tiles[2];
        const tiers = modal.querySelectorAll('.tier-section');
        return {
            modalVisible: modal && modal.style.display !== 'none',
            tileCount: tiles.length,
            tierCount: tiers.length,
            l1Completed: l1Tile?.classList.contains('completed'),
            l2Active: l2Tile?.classList.contains('active'),
            l2Locked: l2Tile?.classList.contains('locked'),
            l3Locked: l3Tile?.classList.contains('locked')
        };
    })()
"@
    $modalRes = Exec-Eval $codeModalOpen
    Write-Host "Modal Visible: $($modalRes.modalVisible), Tile Count: $($modalRes.tileCount), Tiers: $($modalRes.tierCount)"
    Write-Host "Level 1 Completed: $($modalRes.l1Completed) | Level 2 Active: $($modalRes.l2Active) | Level 3 Locked: $($modalRes.l3Locked)"

    if ($modalRes.modalVisible -and $modalRes.tileCount -eq 20 -and $modalRes.tierCount -eq 4 -and $modalRes.l1Completed -and -not $modalRes.l2Locked -and $modalRes.l3Locked) {
        Write-Host "PASS: Level Select modal rendered all 20 tiles across 4 tiers with correct lock/complete states." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Level Select modal validation failed." -ForegroundColor Red
        exit 1
    }

    # Capture screenshot of the Level Select Screen
    Write-Host "Capturing Level Select Screen screenshot artifact..."
    $shotModal = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    $artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\fa3d4768-9a7d-4667-b7d1-d056cca8ec26"
    [System.IO.File]::WriteAllBytes((Join-Path $artifactDir "level_select_screen_verified.png"), [System.Convert]::FromBase64String($shotModal.result.data))

    # Click Level 1 tile to test navigation from modal
    $codeModalNav = @"
    (() => {
        const tiles = document.querySelectorAll('.level-tile');
        tiles[0]?.click();
        return {
            curLevel: window.gearFactory.puzzle.currentLevel,
            modalDisplay: document.getElementById('level-select-modal')?.style.display
        };
    })()
"@
    $modalNav = Exec-Eval $codeModalNav
    Write-Host "Modal Click Nav -> Active Level: $($modalNav.curLevel), Modal Display: $($modalNav.modalDisplay)"
    if ($modalNav.curLevel -eq 1 -and $modalNav.modalDisplay -eq 'none') {
        Write-Host "PASS: Clicking Level 1 from modal closed the modal and loaded Level 1." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Modal navigation failed." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 7: Play / Continue Button Navigation (Requirement 11)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 7] Testing [ PLAY ] button navigation to next incomplete level..." -ForegroundColor Yellow
    $codePlayNav = @"
    (() => {
        document.getElementById('btn-header-play')?.click();
        return {
            curLevel: window.gearFactory.puzzle.currentLevel
        };
    })()
"@
    $playNav = Exec-Eval $codePlayNav
    Write-Host "Play Button -> Navigated to Level: $($playNav.curLevel) (Expected: 2)"
    if ($playNav.curLevel -eq 2) {
        Write-Host "PASS: [ PLAY ] button automatically jumped to first incomplete level (Level 2)." -ForegroundColor Green
    } else {
        Write-Host "FAIL: [ PLAY ] button did not jump to first incomplete level." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 8: Reset Level Independence (Requirement 13)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 8] Testing Level Reset Independence (preserving completed levels)..." -ForegroundColor Yellow
    $codeResetIndep = @"
    (() => {
        const gf = window.gearFactory;
        gf.placeInputGear(40);
        gf.resetLevel();
        return {
            hasInGear: !!gf.inputGear,
            highest: gf.getHighestUnlockedLevel(),
            completed: gf.getCompletedLevels()
        };
    })()
"@
    $resetIndep = Exec-Eval $codeResetIndep
    Write-Host "Reset Level 2: InGear=$($resetIndep.hasInGear), Highest Unlocked=$($resetIndep.highest), Completed=$(ConvertTo-Json -Compress $resetIndep.completed)"
    if (-not $resetIndep.hasInGear -and $resetIndep.highest -eq 2 -and ($resetIndep.completed -contains 1)) {
        Write-Host "PASS: Level Reset cleared Level 2 slots without affecting Level 1 completion status." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Reset corrupted progression state." -ForegroundColor Red
        exit 1
    }

    # -------------------------------------------------------------
    # STEP 9: Solution Concealment Verification (Requirement 6, 17)
    # -------------------------------------------------------------
    Write-Host ""
    Write-Host "[STEP 9] Checking Solution Concealment in DOM and attributes..." -ForegroundColor Yellow
    $codeLeakCheck = @"
    (() => {
        const html = document.body.innerHTML;
        // Check for common leaked solver strings
        const leaks = [];
        if (html.includes('correctInputTeeth')) leaks.push('correctInputTeeth in HTML');
        if (html.includes('solutionRatio')) leaks.push('solutionRatio in HTML');
        if (html.includes('answerCombo')) leaks.push('answerCombo in HTML');
        const calcRpmText = document.getElementById('puzzle-calculated-output-rpm')?.textContent.trim();
        return {
            leaksCount: leaks.length,
            leaks,
            calcRpmText
        };
    })()
"@
    $leakCheck = Exec-Eval $codeLeakCheck
    Write-Host "DOM Leaks: $($leakCheck.leaksCount), Current Calculated Display: $($leakCheck.calcRpmText)"
    if ($leakCheck.leaksCount -eq 0 -and $leakCheck.calcRpmText -eq '---') {
        Write-Host "PASS: No solutions exposed in DOM, calculated RPM masked as '---'." -ForegroundColor Green
    } else {
        Write-Host "FAIL: Potential answer leak detected." -ForegroundColor Red
        exit 1
    }

    # Capture gameplay screenshot of Level 2 with gears
    Exec-Eval "window.gearFactory.placeInputGear(40); window.gearFactory.placeOutputGear(20); window.gearFactory.checkSolution();"
    Start-Sleep -Seconds 1
    $shotGame = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    [System.IO.File]::WriteAllBytes((Join-Path $artifactDir "phase4_level2_verified.png"), [System.Convert]::FromBase64String($shotGame.result.data))
    [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "phase4_level2_verified.png"), [System.Convert]::FromBase64String($shotGame.result.data))

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " ALL PHASE 4 LEVEL SYSTEM TESTS PASSED!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
