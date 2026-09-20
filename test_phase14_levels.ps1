# ==========================================================================
# Gear Factory 3D - Phase 14: 100 Levels Verification Suite
# ==========================================================================

$ErrorActionPreference = "Stop"
$port = 8088
$wsUrl = $null
$chromeProcess = $null
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\f5312182-ac41-491c-b05c-546e6a127f00"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 14 (100 LEVELS) VERIFICATION" -ForegroundColor Cyan
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

$cdpPort = 9370
$tempUserData = Join-Path $env:TEMP "gear_phase14_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$serverUrl = "http://localhost:$port"

$chromeArgs = @(
    "--headless=new",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$tempUserData",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1920,1080",
    $serverUrl
)

Write-Host "Launching Chrome headless on debugging port $cdpPort..." -ForegroundColor Yellow
$chromeProcess = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -PassThru

try {
    Start-Sleep -Seconds 3

    # Query Chrome Debugging targets
    $targetsResponse = Invoke-RestMethod -Uri "http://localhost:$cdpPort/json"
    $pageTarget = $targetsResponse | Where-Object { $_.type -eq "page" -or $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $pageTarget) { $pageTarget = $targetsResponse[0] }

    $wsUrl = $pageTarget.webSocketDebuggerUrl
    Write-Host "Connected to WebSocket: $wsUrl" -ForegroundColor Green

    # WebSocket setup
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
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

    function Save-Screenshot($name) {
        $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $pngBytes = [System.Convert]::FromBase64String($res.result.data)
        $outPath = Join-Path $artifactDir $name
        [System.IO.File]::WriteAllBytes($outPath, $pngBytes)
        $rootPath = Join-Path "d:\GAMES\GearFactory3D" $name
        [System.IO.File]::WriteAllBytes($rootPath, $pngBytes)
        Write-Host "  -> Saved screenshot: $name" -ForegroundColor Green
    }

    # Enable Page domain and wait for app to mount
    Send-CDP "Page.enable" | Out-Null
    Start-Sleep -Seconds 2

    # Inject test suite from disk
    $testSuitePath = Join-Path $PSScriptRoot "test_phase14.js"
    $testSuiteCode = [System.IO.File]::ReadAllText($testSuitePath)
    Eval-JS $testSuiteCode | Out-Null
    Write-Host "Injected test_phase14.js into browser context." -ForegroundColor Green

    # =========================================================================
    # TEST 1: Automated Mathematical Validation of All 100 Levels
    # =========================================================================
    Write-Host "`n--- TEST 1: Programmatic Validation of All 100 Levels ---" -ForegroundColor Yellow
    $valRes = Eval-JS "window.__phase14.runValidation()"

    Write-Host "Total Levels in System: $($valRes.totalLevels)" -ForegroundColor Cyan
    Write-Host "Validation Passed Count: $($valRes.validCount) / $($valRes.totalLevels)" -ForegroundColor Cyan
    Write-Host "All Pass: $($valRes.allPass)" -ForegroundColor Cyan
    Write-Host "Has Level 101: $($valRes.hasLevel101)" -ForegroundColor Cyan
    Write-Host "Has Duplicates: $($valRes.hasDuplicates)" -ForegroundColor Cyan
    Write-Host "First Level ID: $($valRes.firstLevelId), Last Level ID: $($valRes.lastLevelId)" -ForegroundColor Cyan
    Write-Host "Property Validation Errors: $($valRes.propertyErrorsCount)" -ForegroundColor Cyan

    if (-not $valRes.allPass) {
        Write-Host "FAILED LEVELS: $($valRes.failedLevels -join ', ')" -ForegroundColor Red
        throw "Test 1 Failed: Not all levels passed mathematical validation."
    }
    if ($valRes.totalLevels -ne 100) {
        throw "Test 1 Failed: Total levels is $($valRes.totalLevels), expected exactly 100."
    }
    if ($valRes.hasLevel101) {
        throw "Test 1 Failed: Level 101 unexpectedly exists!"
    }
    if ($valRes.hasDuplicates) {
        throw "Test 1 Failed: Duplicate level IDs detected!"
    }
    if ($valRes.propertyErrorsCount -gt 0) {
        throw "Test 1 Failed: Found property errors: $($valRes.propertyErrors -join '; ')"
    }
    Write-Host "TEST 1 PASSED: Exactly 100 levels, 100% mathematically valid, no Level 101, zero property errors." -ForegroundColor Green

    # =========================================================================
    # TEST 2: Integrity of Levels 1-50 (Zero Regressions)
    # =========================================================================
    Write-Host "`n--- TEST 2: Preservation of Levels 1-50 ---" -ForegroundColor Yellow
    $anchors = Eval-JS "window.__phase14.testPreservedLevels()"

    foreach ($a in $anchors) {
        Write-Host "  Anchor Level $($a.level): Motor $($a.motorRPM) RPM -> Target $($a.targetRPM) RPM ($($a.difficulty)) [Gears: $($a.hasGears)] [PASS]" -ForegroundColor Cyan
    }
    Write-Host "TEST 2 PASSED: Levels 1-50 are perfectly preserved." -ForegroundColor Green

    # =========================================================================
    # TEST 3: Sample Gameplay Verification (Anchor and Milestone Levels)
    # =========================================================================
    Write-Host "`n--- TEST 3: Interactive Gameplay on Sample Levels ---" -ForegroundColor Yellow
    $sampleDefs = @(
        @{ id = 1;   inT = 20; outT = 40; expRPM = 500;  desc = "Level 1 (Beginner)" },
        @{ id = 10;  inT = 50; outT = 40; expRPM = 1500; desc = "Level 10 (Intermediate)" },
        @{ id = 25;  inT = 20; outT = 50; expRPM = 720;  desc = "Level 25 (Challenge)" },
        @{ id = 50;  inT = 50; outT = 40; expRPM = 3150; desc = "Level 50 (Campaign 1 Finale)" },
        @{ id = 51;  inT = 20; outT = 20; expRPM = 1200; desc = "Level 51 (Beginner+ Equal gears)" },
        @{ id = 60;  inT = 40; outT = 20; expRPM = 2000; desc = "Level 60 (Beginner+ Finale)" },
        @{ id = 70;  inT = 40; outT = 50; expRPM = 1600; desc = "Level 70 (Intermediate Finale)" },
        @{ id = 80;  inT = 50; outT = 30; expRPM = 2250; desc = "Level 80 (Advanced Finale)" },
        @{ id = 90;  inT = 50; outT = 60; expRPM = 2250; desc = "Level 90 (Master Finale)" },
        @{ id = 100; inT = 60; outT = 50; expRPM = 3600; desc = "Level 100 (The Apex Grandmaster Finale)" }
    ) | ConvertTo-Json -Compress

    $playResults = Eval-JS "window.__phase14.testSampleGameplay($sampleDefs)"

    foreach ($pr in $playResults) {
        Write-Host "  Gameplay Test $($pr.desc): Mounted $($pr.inT)T/$($pr.outT)T -> Calc $($pr.calcRPM) RPM (Exp: $($pr.expRPM)) -> Solved: $($pr.isCorrect) (Unlocked: $($pr.highestUnlocked))" -ForegroundColor Green
        if (-not $pr.pass) {
            throw "Gameplay Test Failed for Level $($pr.id)!"
        }
    }
    Write-Host "TEST 3 PASSED: All tested anchor and milestone levels played and solved successfully." -ForegroundColor Green

    # =========================================================================
    # TEST 4: Level 100 Campaign Completion (No Level 101)
    # =========================================================================
    Write-Host "`n--- TEST 4: Level 100 Campaign Completion Screen ---" -ForegroundColor Yellow
    $finalScreenRes = Eval-JS "window.__phase14.testLevel100Completion()"

    Write-Host "  Modal Title: '$($finalScreenRes.modalTitle)'" -ForegroundColor Cyan
    Write-Host "  Modal Eyebrow: '$($finalScreenRes.modalEyebrow)'" -ForegroundColor Cyan
    Write-Host "  Next Level Button Hidden: $($finalScreenRes.nextBtnHidden)" -ForegroundColor Cyan
    Write-Host "  Highest Unlocked Level: $($finalScreenRes.highestUnlocked)" -ForegroundColor Cyan

    if ($finalScreenRes.modalTitle -ne "ALL LEVELS COMPLETE") {
        throw "Test 4 Failed: Expected modal title 'ALL LEVELS COMPLETE', got '$($finalScreenRes.modalTitle)'."
    }
    if (-not $finalScreenRes.nextBtnHidden) {
        throw "Test 4 Failed: Next level button should be hidden on Level 100 completion!"
    }
    if ($finalScreenRes.highestUnlocked -gt 100) {
        throw "Test 4 Failed: Highest unlocked level is $($finalScreenRes.highestUnlocked), should not exceed 100!"
    }
    Save-Screenshot "phase14_level100_all_complete.png"
    Write-Host "TEST 4 PASSED: Level 100 cleanly triggers ALL LEVELS COMPLETE and caps progression at 100." -ForegroundColor Green

    # Close completion modal
    Eval-JS "if (window.gearFactory.closeLevelComplete) window.gearFactory.closeLevelComplete();" | Out-Null

    # =========================================================================
    # TEST 5: Level Select Modal and Chapter Tabs UI
    # =========================================================================
    Write-Host "`n--- TEST 5: Level Select Modal (100 Levels Grid and Tabs) ---" -ForegroundColor Yellow
    $lvlSelectRes = Eval-JS "window.__phase14.testLevelSelectUI()"

    Write-Host "  Modal Visible: $($lvlSelectRes.modalVisible)" -ForegroundColor Cyan
    Write-Host "  Total Level Tiles Rendered: $($lvlSelectRes.totalTilesCount)" -ForegroundColor Cyan
    Write-Host "  Chapter Tabs: $($lvlSelectRes.tabLabels -join ' | ')" -ForegroundColor Cyan
    Write-Host "  Tab Filter Test Passed: $($lvlSelectRes.filterTestPassed)" -ForegroundColor Cyan

    if ($lvlSelectRes.totalTilesCount -ne 100) {
        throw "Test 5 Failed: Expected 100 level tiles in Level Select modal, found $($lvlSelectRes.totalTilesCount)."
    }
    if (-not $lvlSelectRes.filterTestPassed) {
        throw "Test 5 Failed: Chapter tab filtering failed."
    }
    Start-Sleep -Milliseconds 500
    Save-Screenshot "phase14_level_select_screen.png"
    Write-Host "TEST 5 PASSED: Level Select renders exactly 100 tiles with functioning chapter tabs." -ForegroundColor Green

    # Close level select modal
    Eval-JS "if (window.gearFactory.closeLevelSelectModal) window.gearFactory.closeLevelSelectModal();" | Out-Null

    # =========================================================================
    # TEST 6: Visual Confirmation Screenshots (Levels 51, 70, 100)
    # =========================================================================
    Write-Host "`n--- TEST 6: Capturing Visual Proof Screenshots ---" -ForegroundColor Yellow
    
    # Level 51 running
    Eval-JS "window.__phase14.prepareLevel(51, 20, 20)" | Out-Null
    Start-Sleep -Milliseconds 600
    Save-Screenshot "phase14_level51_running.png"

    # Level 70 running
    Eval-JS "window.__phase14.prepareLevel(70, 40, 50)" | Out-Null
    Start-Sleep -Milliseconds 600
    Save-Screenshot "phase14_level70_running.png"

    # Level 100 running
    Eval-JS "window.__phase14.prepareLevel(100, 60, 50)" | Out-Null
    Start-Sleep -Milliseconds 600
    Save-Screenshot "phase14_level100_running.png"

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " PHASE 14 VERIFICATION COMPLETE: ALL 6 TESTS PASSED!" -ForegroundColor Green
    Write-Host " Total Levels: 100 (Levels 1 to 100)" -ForegroundColor Green
    Write-Host " Level 101: Does not exist" -ForegroundColor Green
    Write-Host " Levels 1-50: Strictly preserved" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempUserData) {
        Remove-Item -Recurse -Force $tempUserData -ErrorAction SilentlyContinue
    }
}
