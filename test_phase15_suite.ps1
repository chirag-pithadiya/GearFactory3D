# ==========================================================================
# Gear Factory 3D - Phase 15: Points & Gear Inventory Verification Suite
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
Write-Host " GEAR FACTORY 3D - PHASE 15 (POINTS & UNLOCKS) TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromeExe) {
    throw "Google Chrome executable not found."
}

$cdpPort = 9375
$tempUserData = Join-Path $env:TEMP "gear_phase15_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$serverUrl = "http://localhost:$port"

$chromeArgs = @(
    "--headless=new",
    "--remote-debugging-port=$cdpPort",
    "--user-data-dir=$tempUserData",
    "--disable-extensions",
    "--use-gl=angle",
    "--enable-webgl",
    "--window-size=1920,1080",
    $serverUrl
)

Write-Host "Launching Chrome headless on debugging port $cdpPort..." -ForegroundColor Yellow
$chromeProcess = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -PassThru

try {
    Start-Sleep -Seconds 3

    $targetsResponse = Invoke-RestMethod -Uri "http://localhost:$cdpPort/json"
    $pageTarget = $targetsResponse | Where-Object { $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $pageTarget) {
        $pageTarget = $targetsResponse | Where-Object { $_.type -eq "page" } | Select-Object -First 1
    }
    if (-not $pageTarget) { $pageTarget = $targetsResponse[0] }

    $wsUrl = $pageTarget.webSocketDebuggerUrl
    Write-Host "Connected to WebSocket: $wsUrl" -ForegroundColor Green

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
        $segment = [System.ArraySegment[byte]]::new($bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        $buffer = [byte[]]::new(1048576)
        while ($true) {
            $memStream = [System.IO.MemoryStream]::new()
            do {
                $seg = [System.ArraySegment[byte]]::new($buffer)
                $res = $ws.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).Result
                $memStream.Write($buffer, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $rawStr = [System.Text.Encoding]::UTF8.GetString($memStream.ToArray())
            $json = $rawStr | ConvertFrom-Json
            if ($json.id -eq $thisId) {
                return $json.result
            }
        }
    }

    # Enable Page and Runtime
    Send-CDP "Page.enable" | Out-Null
    Send-CDP "Runtime.enable" | Out-Null
    Start-Sleep -Seconds 2

    # Inject test_phase15.js
    $testScript = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "test_phase15.js"), [System.Text.Encoding]::UTF8)
    Send-CDP "Runtime.evaluate" @{ expression = $testScript; returnByValue = $true } | Out-Null
    Write-Host "Injected test_phase15.js successfully." -ForegroundColor Green

    # Run all automated tests
    $testEval = Send-CDP "Runtime.evaluate" @{ expression = "try { JSON.stringify(window.__phase15.runAll()); } catch (e) { JSON.stringify({ error: e.message, stack: e.stack }); }"; returnByValue = $true }
    if (-not $testEval.result.value) {
        Write-Host "Evaluation returned no value. Raw response:" -ForegroundColor Red
        $testEval | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Red
        throw "Failed to evaluate window.__phase15.runAll()"
    }
    $testResults = $testEval.result.value | ConvertFrom-Json
    if ($testResults.error) {
        Write-Host "JS Exception during tests: $($testResults.error)" -ForegroundColor Red
        Write-Host $testResults.stack -ForegroundColor Red
        throw "JS Exception in test suite"
    }

    Write-Host "`n================ TEST RESULTS ================" -ForegroundColor Cyan
    Write-Host "1. Starter Setup (10T-50T, 0 pts):      $($testResults.t1_starterSetup.pass)" -ForegroundColor $(if ($testResults.t1_starterSetup.pass) { "Green" } else { "Red" })
    Write-Host "2. Level 1 Rewards (225 pts):           $($testResults.t2_level1Rewards.pass)" -ForegroundColor $(if ($testResults.t2_level1Rewards.pass) { "Green" } else { "Red" })
    Write-Host "3. Anti-Farming (No Duplicate Base/Bonus): $($testResults.t3_antiFarming.pass)" -ForegroundColor $(if ($testResults.t3_antiFarming.pass) { "Green" } else { "Red" })
    Write-Host "4. Unlock Thresholds (60T-100T):        $($testResults.t4_unlockThresholds.pass)" -ForegroundColor $(if ($testResults.t4_unlockThresholds.pass) { "Green" } else { "Red" })
    Write-Host "5. Locked Gear Drag Rejection & Modal:  $($testResults.t5_lockedGearDrag.pass)" -ForegroundColor $(if ($testResults.t5_lockedGearDrag.pass) { "Green" } else { "Red" })
    Write-Host "6. Unlocked Gear Drag Allowed:          $($testResults.t6_unlockedGearDrag.pass)" -ForegroundColor $(if ($testResults.t6_unlockedGearDrag.pass) { "Green" } else { "Red" })
    Write-Host "7. Reset Level Isolation:               $($testResults.t7_resetLevelIsolation.pass)" -ForegroundColor $(if ($testResults.t7_resetLevelIsolation.pass) { "Green" } else { "Red" })
    Write-Host "8. All 100 Levels Validated:            $($testResults.t8_all100Levels.pass)" -ForegroundColor $(if ($testResults.t8_all100Levels.pass) { "Green" } else { "Red" })
    Write-Host "9. Level 100 Completion (No Lvl 101):   $($testResults.t9_level100Completion.pass)" -ForegroundColor $(if ($testResults.t9_level100Completion.pass) { "Green" } else { "Red" })
    Write-Host "10. Safe Progression Migration:         $($testResults.t10_migration.pass)" -ForegroundColor $(if ($testResults.t10_migration.pass) { "Green" } else { "Red" })
    Write-Host "11. Auto-Unlock & Points Immutability:  $($testResults.t11_automaticUnlockImmutability.pass)" -ForegroundColor $(if ($testResults.t11_automaticUnlockImmutability.pass) { "Green" } else { "Red" })
    Write-Host "12. Multi-Threshold Simultaneous Unlock:$($testResults.t12_multipleThresholdUnlock.pass)" -ForegroundColor $(if ($testResults.t12_multipleThresholdUnlock.pass) { "Green" } else { "Red" })
    Write-Host "13. Zero Buy/Spend Wording in UI:       $($testResults.t13_noPurchaseTerminology.pass)" -ForegroundColor $(if ($testResults.t13_noPurchaseTerminology.pass) { "Green" } else { "Red" })
    Write-Host "----------------------------------------------"
    Write-Host "OVERALL PASS STATUS: $($testResults.allPassed)" -ForegroundColor $(if ($testResults.allPassed) { "Green" } else { "Red" })

    # Screenshot Helper
    function Capture-Screen($fileName) {
        $shotRes = Send-CDP "Page.captureScreenshot" @{ format = "png" }
        $shotBytes = [System.Convert]::FromBase64String($shotRes.data)
        $outPath = Join-Path $artifactDir $fileName
        [System.IO.File]::WriteAllBytes($outPath, $shotBytes)
        Write-Host "Captured screenshot: $fileName" -ForegroundColor Green
    }

    # 1. Capture Header & Gameplay with Points
    Send-CDP "Runtime.evaluate" @{ expression = "
        window.gearFactory.closeWelcomeModal();
        window.gearFactory.closeLevelComplete();
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
        window.gearFactory.resetAllProgress();
        window.gearFactory.addPlayerPoints(3250);
        window.gearFactory.loadLevel(42, true);
        window.gearFactory.closeWelcomeModal();
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
    " } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_gameplay_points_header.png"

    # 2. Capture Gear Inventory Modal (showing 'Unlocks automatically at')
    Send-CDP "Runtime.evaluate" @{ expression = "window.gearFactory.openGearInventoryModal();" } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_gear_inventory_modal.png"
    Send-CDP "Runtime.evaluate" @{ expression = "window.gearFactory.closeGearInventoryModal();" } | Out-Null

    # 3. Capture Locked Gear Modal
    Send-CDP "Runtime.evaluate" @{ expression = "document.querySelector('.available-gear-card[data-teeth=""80""]')?.click();" } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_locked_gear_modal.png"
    Send-CDP "Runtime.evaluate" @{ expression = "document.getElementById('btn-close-locked-gear')?.click();" } | Out-Null

    # 4. Capture Level Complete with Automatic Gear Unlock Announcement
    Send-CDP "Runtime.evaluate" @{ expression = "
        window.gearFactory.resetAllProgress();
        window.gearFactory.addPlayerPoints(900);
        window.gearFactory.loadLevel(1, true);
        window.gearFactory.placeInputGear(20);
        window.gearFactory.placeOutputGear(40);
        window.gearFactory.checkSolution();
    " } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_auto_unlock_level_complete.png"
    Capture-Screen "phase15_level_complete_rewards.png"

    # 5. Capture Mobile Viewport (390 x 844) Gameplay
    Send-CDP "Emulation.setDeviceMetricsOverride" @{
        width = 390
        height = 844
        deviceScaleFactor = 2
        mobile = $true
    } | Out-Null
    Send-CDP "Runtime.evaluate" @{ expression = "
        window.gearFactory.closeLevelComplete();
        window.gearFactory.closeWelcomeModal();
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
        window.gearFactory.addPlayerPoints(3250);
        window.gearFactory.loadLevel(42, true);
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
    " } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_mobile_layout.png"

    # 6. Capture Main Menu with Points
    Send-CDP "Emulation.clearDeviceMetricsOverride" | Out-Null
    Send-CDP "Runtime.evaluate" @{ expression = "
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
        window.gearFactory.openMainMenu();
    " } | Out-Null
    Start-Sleep -Milliseconds 600
    Capture-Screen "phase15_main_menu.png"

} finally {
    if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        $chromeProcess.Kill()
    }
    if (Test-Path $tempUserData) {
        Remove-Item -Path $tempUserData -Recurse -Force -ErrorAction SilentlyContinue
    }
}
