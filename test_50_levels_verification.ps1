param([int]$Port = 9348)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - 50 LEVELS EXPANSION VERIFICATION SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_50levels_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\197f3657-0956-4c33-a2fa-a99dce4e7080"
if (-not (Test-Path $artifactDir)) { New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null }

$indexPath = "d:\GAMES\GearFactory3D\index.html"
$fileUrl = "file:///$($indexPath.Replace('\', '/'))"

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1440,900",
    $fileUrl
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $page = $pages | Where-Object { $_.type -eq "page" -or $_.url -like "*GearFactory3D*" } | Select-Object -First 1
    if (-not $page) { $page = $pages[0] }

    $wsUrl = $page.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([System.Uri]$wsUrl, [System.Threading.CancellationToken]::None).Wait()

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

    function Eval-JS($expr) {
        $res = Send-CDP "Runtime.evaluate" @{ expression = $expr; returnByValue = $true; awaitPromise = $true }
        if ($res.result.exceptionDetails) {
            Write-Host "EVAL ERROR: $($res.result.exceptionDetails.exception.description)" -ForegroundColor Red
            return $null
        }
        return $res.result.result.value
    }

    function Save-Screenshot($filename) {
        $shot = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $outPath = Join-Path $artifactDir $filename
        [System.IO.File]::WriteAllBytes($outPath, [System.Convert]::FromBase64String($shot.result.data))
        Write-Host "  -> Saved screenshot: $filename" -ForegroundColor Gray
    }

    Send-CDP "Runtime.enable" | Out-Null
    Send-CDP "Page.enable" | Out-Null

    # Wait for page bundle to initialize window.gearFactory
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $isDef = Eval-JS "typeof window.gearFactory !== 'undefined' && !!window.gearFactory.levelData"
        if ($isDef -eq $true) {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ready) {
        throw "Timeout waiting for window.gearFactory to initialize!"
    }

    # Dismiss level intro modal if present
    Eval-JS "window.gearFactory.closeLevelIntro && window.gearFactory.closeLevelIntro();" | Out-Null

    $totalTests = 0
    $passedTests = 0

    function Assert-Test($condition, $name, $detail = "") {
        $script:totalTests++
        if ($condition) {
            $script:passedTests++
            Write-Host "  [PASS] $name $detail" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  [FAIL] $name $detail" -ForegroundColor Red
            return $false
        }
    }

    Write-Host "`n--- [1. PROGRAMMATIC SAFETY CHECK: ALL 50 LEVELS VALIDATION] ---" -ForegroundColor Yellow

    $valCode = @"
    (function() {
        const levels = window.gearFactory.levelData;
        const out = [];
        let allValid = true;

        for (let lvl of levels) {
            const motor = lvl.motorRPM;
            const target = lvl.targetRPM;
            const gears = lvl.availableGears || [10, 20, 30, 40, 50, 60];
            const requireSeparate = lvl.requireSeparateGears !== false;
            const validSolutions = [];

            for (let inTeeth of gears) {
                for (let outTeeth of gears) {
                    if (requireSeparate && inTeeth === outTeeth) continue;
                    const calculated = (motor * inTeeth) / outTeeth;
                    if (Math.abs(calculated - target) <= 0.5) {
                        validSolutions.push({ inTeeth, outTeeth, calculated: Number(calculated.toFixed(2)) });
                    }
                }
            }

            const isValid = validSolutions.length > 0;
            if (!isValid) allValid = false;

            out.push({
                level: lvl.level,
                difficulty: lvl.difficulty,
                motorRPM: motor,
                targetRPM: target,
                availableGears: gears,
                validSolutions: validSolutions,
                isValid: isValid
            });
        }

        return { totalLevels: levels.length, allValid: allValid, details: out };
    })()
"@

    $valResult = Eval-JS $valCode

    Assert-Test ($valResult.totalLevels -eq 50) "Total Levels Count" "Expected 50, got $($valResult.totalLevels)"
    Assert-Test ($valResult.allValid -eq $true) "All 50 Levels Mathematically Valid"

    Write-Host "`nDetailed Level Audit Summary (Developer / Console Output):" -ForegroundColor Cyan
    foreach ($d in $valResult.details) {
        $solsArr = @()
        foreach ($s in $d.validSolutions) {
            $solsArr += "$($s.inTeeth)T->$($s.outTeeth)T ($($s.calculated) RPM)"
        }
        $sols = $solsArr -join ", "
        $gearsStr = "[" + ($d.availableGears -join ', ') + "]"
        $statusIcon = if ($d.isValid) { "[VALID]" } else { "[INVALID]" }
        $lvlStr = $d.level.ToString().PadLeft(2)
        $diffStr = $d.difficulty.ToString().PadRight(12)
        $motorStr = $d.motorRPM.ToString().PadLeft(4)
        $targetStr = $d.targetRPM.ToString().PadLeft(4)
        Write-Host "  Level $lvlStr | $diffStr | Motor: $motorStr | Target: $targetStr | Gears: $gearsStr | Sols: $sols $statusIcon"
    }

    Write-Host "`n--- [2. LEVEL SELECT MODAL: 7 TIERS AND 50 BUTTONS] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.openLevelSelectModal();" | Out-Null
    Start-Sleep -Milliseconds 400

    $tierCount = Eval-JS "document.querySelectorAll('.tier-section').length"
    Assert-Test ($tierCount -eq 7) "Level Select Tiers Count" "Expected 7 tiers, got $tierCount"

    $tileCount = Eval-JS "document.querySelectorAll('.level-tile').length"
    Assert-Test ($tileCount -eq 50) "Level Select Button Tiles Count" "Expected 50 tiles, got $tileCount"

    $tierNames = Eval-JS "Array.from(document.querySelectorAll('.tier-badge')).map(function(b) { return b.textContent; }).join(', ')"
    Write-Host "  Tiers Rendered: $tierNames" -ForegroundColor Gray
    Assert-Test ($tierNames -like "*BEGINNER*INTERMEDIATE*HARD*EXPERT*HARD*ADVANCED*EXPERT*") "Tiers Progression Sequence"

    Save-Screenshot "phase9_50lvl_01_level_select.png"
    Eval-JS "window.gearFactory.closeLevelSelectModal();" | Out-Null
    Start-Sleep -Milliseconds 300

    Write-Host "`n--- [3. LEVEL 1 GAMEPLAY AND RATIO VERIFICATION] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.loadLevel(1, true);" | Out-Null
    Start-Sleep -Milliseconds 400

    $l1Data = Eval-JS @"
    (function() {
        var p = window.gearFactory.puzzle;
        var s = window.gearFactory.state;
        return {
            currentLevel: p.currentLevel,
            motorRPM: s.targetInputRPM,
            targetRPM: s.targetOutputRPM
        };
    })()
"@
    Assert-Test ($l1Data.currentLevel -eq 1) "Level 1 Loaded"
    Assert-Test ($l1Data.motorRPM -eq 1000 -and $l1Data.targetRPM -eq 500) "Level 1 Parameters" "Motor: $($l1Data.motorRPM), Target: $($l1Data.targetRPM)"

    # Solve Level 1: In 20T, Out 40T
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 300

    $l1Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Test ($l1Check -eq $true) "Level 1 Check Solution" "Solved with 20T/40T"

    $l2Unlocked = Eval-JS "window.gearFactory.isLevelUnlocked(2);"
    Assert-Test ($l2Unlocked -eq $true) "Level 2 Unlocked After Level 1"

    Eval-JS "window.gearFactory.closeLevelComplete && window.gearFactory.closeLevelComplete();" | Out-Null

    Write-Host "`n--- [4. LEVEL 21 (HARD) GAMEPLAY AND VERIFICATION] ---" -ForegroundColor Yellow
    # Unlock Level 21 and load it
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(21); window.gearFactory.loadLevel(21, true);" | Out-Null
    Start-Sleep -Milliseconds 400

    $l21Data = Eval-JS @"
    (function() {
        var p = window.gearFactory.puzzle;
        var s = window.gearFactory.state;
        var el = document.getElementById('puzzle-level-indicator');
        return {
            currentLevel: p.currentLevel,
            motorRPM: s.targetInputRPM,
            targetRPM: s.targetOutputRPM,
            diff: el ? el.textContent : ''
        };
    })()
"@
    Assert-Test ($l21Data.currentLevel -eq 21) "Level 21 Loaded"
    Assert-Test ($l21Data.motorRPM -eq 1600 -and $l21Data.targetRPM -eq 1200) "Level 21 Specs" "Motor: $($l21Data.motorRPM), Target: $($l21Data.targetRPM)"
    Write-Host "  HUD Indicator: $($l21Data.diff)" -ForegroundColor Gray

    # Solve Level 21: In 30T, Out 40T -> 1600 * 30/40 = 1200 RPM
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 30); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 300

    $l21Mesh = Eval-JS @"
    (function() {
        var p = window.gearFactory.puzzle;
        var ca = window.gearFactory.inputGear;
        var cb = window.gearFactory.outputGear;
        return {
            inTeeth: p.selectedInputTeeth,
            outTeeth: p.selectedOutputTeeth,
            hasInputGear: !!ca,
            hasOutputGear: !!cb
        };
    })()
"@
    Assert-Test ($l21Mesh.inTeeth -eq 30 -and $l21Mesh.outTeeth -eq 40) "Gears Mounted (30T / 40T)"
    Assert-Test ($l21Mesh.hasInputGear -and $l21Mesh.hasOutputGear) "3D Gears Active In Scene"

    $l21Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Test ($l21Check -eq $true) "Level 21 Solution Check Passed"

    $l22Unlocked = Eval-JS "window.gearFactory.isLevelUnlocked(22);"
    Assert-Test ($l22Unlocked -eq $true) "Level 22 Unlocked Sequentially"

    Save-Screenshot "phase9_50lvl_02_level21_solved.png"
    Eval-JS "window.gearFactory.closeLevelComplete && window.gearFactory.closeLevelComplete();" | Out-Null

    Write-Host "`n--- [5. LEVEL 35 (ADVANCED) GAMEPLAY AND VERIFICATION] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(35); window.gearFactory.loadLevel(35, true);" | Out-Null
    Start-Sleep -Milliseconds 400

    $l35Data = Eval-JS @"
    (function() {
        var s = window.gearFactory.state;
        return {
            motorRPM: s.targetInputRPM,
            targetRPM: s.targetOutputRPM
        };
    })()
"@
    Assert-Test ($l35Data.motorRPM -eq 2280 -and $l35Data.targetRPM -eq 1900) "Level 35 Specs" "Motor: $($l35Data.motorRPM), Target: $($l35Data.targetRPM)"

    # Solve Level 35: In 50T, Out 60T -> 2280 * 50/60 = 1900 RPM
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 50); window.gearFactory.placeGearOnShaft('output', 60);" | Out-Null
    Start-Sleep -Milliseconds 300

    $l35Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Test ($l35Check -eq $true) "Level 35 Solution Check Passed" "Ratio 5:6 (1900 RPM)"
    Eval-JS "window.gearFactory.closeLevelComplete && window.gearFactory.closeLevelComplete();" | Out-Null

    Write-Host "`n--- [6. LEVEL 50 (EXPERT GRANDMASTER) AND CAMPAIGN COMPLETION] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.setHighestUnlockedLevel(50); window.gearFactory.loadLevel(50, true);" | Out-Null
    Start-Sleep -Milliseconds 400

    $l50Data = Eval-JS @"
    (function() {
        var s = window.gearFactory.state;
        var p = window.gearFactory.puzzle;
        return {
            level: p.currentLevel,
            motorRPM: s.targetInputRPM,
            targetRPM: s.targetOutputRPM
        };
    })()
"@
    Assert-Test ($l50Data.level -eq 50) "Level 50 Loaded"
    Assert-Test ($l50Data.motorRPM -eq 2520 -and $l50Data.targetRPM -eq 3150) "Level 50 Grandmaster Specs" "Motor: $($l50Data.motorRPM), Target: $($l50Data.targetRPM)"

    # Solve Level 50: In 50T, Out 40T -> 2520 * 50/40 = 3150 RPM
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 50); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 300

    $l50Check = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Test ($l50Check -eq $true) "Level 50 Solution Check Passed" "Ratio 5:4 (3150 RPM)"

    Start-Sleep -Milliseconds 300

    $completeModalState = Eval-JS @"
    (function() {
        var m = document.getElementById('level-complete-modal');
        var title = m ? (m.querySelector('.modal-title') ? m.querySelector('.modal-title').textContent : '') : '';
        var eyebrow = m ? (m.querySelector('.modal-eyebrow') ? m.querySelector('.modal-eyebrow').textContent : '') : '';
        var nextBtn = document.getElementById('btn-modal-next-level');
        var nextBtnDisplay = nextBtn ? window.getComputedStyle(nextBtn).display : '';
        var highestUnlocked = window.gearFactory.getHighestUnlockedLevel();
        return {
            modalVisible: m && window.getComputedStyle(m).display !== 'none',
            title: title,
            eyebrow: eyebrow,
            nextBtnHidden: nextBtnDisplay === 'none',
            highestUnlocked: highestUnlocked
        };
    })()
"@

    Assert-Test ($completeModalState.modalVisible -eq $true) "Level Complete Modal Visible"
    Assert-Test ($completeModalState.title -eq "ALL LEVELS COMPLETE") "Campaign Victory Title" "Expected 'ALL LEVELS COMPLETE', got '$($completeModalState.title)'"
    Assert-Test ($completeModalState.eyebrow -eq "CAMPAIGN COMPLETED") "Campaign Victory Eyebrow" "Expected 'CAMPAIGN COMPLETED', got '$($completeModalState.eyebrow)'"
    Assert-Test ($completeModalState.nextBtnHidden -eq $true) "Next Level Button Hidden on Level 50"
    Assert-Test ($completeModalState.highestUnlocked -eq 50) "Max Level Cap Preserved" "Highest unlocked remains 50 (does not overflow to 51)"

    Save-Screenshot "phase9_50lvl_03_campaign_complete.png"
    Eval-JS "window.gearFactory.closeLevelComplete && window.gearFactory.closeLevelComplete();" | Out-Null

    Write-Host "`n--- [7. SYSTEM MODALS AND CONTROLS REGRESSION VERIFICATION] ---" -ForegroundColor Yellow

    # Pause / Resume
    Eval-JS "window.gearFactory.openPauseModal();" | Out-Null
    Start-Sleep -Milliseconds 200
    $pauseVis = Eval-JS "document.getElementById('pause-modal') && document.getElementById('pause-modal').style.display !== 'none'"
    Assert-Test ($pauseVis -eq $true) "Pause Modal Open"
    Eval-JS "window.gearFactory.closePauseModal();" | Out-Null
    Start-Sleep -Milliseconds 200
    $pauseHidden = Eval-JS "document.getElementById('pause-modal') && document.getElementById('pause-modal').style.display === 'none'"
    Assert-Test ($pauseHidden -eq $true) "Pause Modal Resume / Close"

    # Reset Level
    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20); window.gearFactory.resetLevel();" | Out-Null
    $resetCheck = Eval-JS "window.gearFactory.puzzle.selectedInputTeeth === null"
    Assert-Test ($resetCheck -eq $true) "Reset Level Clears Placed Gears"

    # Settings Modal
    Eval-JS "window.gearFactory.openSettingsModal();" | Out-Null
    Start-Sleep -Milliseconds 200
    $settingsVis = Eval-JS "document.getElementById('settings-modal') && document.getElementById('settings-modal').style.display !== 'none'"
    Assert-Test ($settingsVis -eq $true) "Settings Modal Open"
    Eval-JS "window.gearFactory.closeSettingsModal();" | Out-Null

    # Main Menu Modal
    Eval-JS "window.gearFactory.openMainMenu();" | Out-Null
    Start-Sleep -Milliseconds 200
    $menuVis = Eval-JS "document.getElementById('main-menu-modal') && document.getElementById('main-menu-modal').style.display !== 'none'"
    Assert-Test ($menuVis -eq $true) "Main Menu Modal Open"
    Eval-JS "window.gearFactory.closeMainMenu();" | Out-Null

    # Audio Toggles
    $sfxToggle = Eval-JS "window.gearFactory.audio.toggleSfx();"
    Assert-Test ($sfxToggle -eq $false -or $sfxToggle -eq $true) "SFX Audio Toggle"
    $musicToggle = Eval-JS "window.gearFactory.audio.toggleMusic();"
    Assert-Test ($musicToggle -eq $false -or $musicToggle -eq $true) "Music Audio Toggle"

    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " 50-LEVEL VERIFICATION COMPLETE: $passedTests / $totalTests TESTS PASSED" -ForegroundColor $(if ($passedTests -eq $totalTests) { "Green" } else { "Red" })
    Write-Host "==========================================================" -ForegroundColor Cyan

    if ($passedTests -ne $totalTests) {
        throw "One or more tests failed!"
    }
}
finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
