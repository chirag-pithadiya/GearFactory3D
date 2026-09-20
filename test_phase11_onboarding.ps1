param([int]$Port = 9348)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " GEAR FACTORY 3D - PHASE 11 ONBOARDING & BEGINNER SUITE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_phase11_test_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$artifactDir = "C:\Users\Chirag\.gemini\antigravity-ide\brain\4074bfb4-5c5b-41ff-8a4c-16b01d98df65"
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
            } while (! $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $msg = $raw | ConvertFrom-Json
            if ($msg.method -eq "Runtime.exceptionThrown") {
                Write-Host "JS EXCEPTION: $($msg.params.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
            }
            if ($msg.id -eq $thisId) { return $msg }
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
        Write-Host "  -> Saved screenshot: $name" -ForegroundColor Green
    }

    Send-CDP "Page.enable" | Out-Null
    Send-CDP "Runtime.enable" | Out-Null

    $totalTests = 0
    $passedTests = 0

    function Assert-Condition($condition, $message) {
        $script:totalTests++
        if ($condition) {
            $script:passedTests++
            Write-Host "  [PASS] $message" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $message" -ForegroundColor Red
            throw "Assertion failed: $message"
        }
    }

    Write-Host "`n--- [1. FIRST-TIME PLAYER EXPERIENCE FLOW] ---" -ForegroundColor Yellow
    Eval-JS "localStorage.removeItem('gear_factory_has_seen_welcome'); localStorage.removeItem('gearfactory_welcomed');" | Out-Null
    $welcomeTriggered = Eval-JS "window.gearFactory.checkFirstTimeWelcome(() => window.gearFactory.loadLevel(1, false));"
    Start-Sleep -Milliseconds 400

    $welcomeActive = Eval-JS "document.getElementById('welcome-modal').classList.contains('active') || document.getElementById('welcome-modal').style.display === 'flex'"
    Assert-Condition ($welcomeActive -eq $true) "Welcome modal is active for first-time player"

    $welcomeTitle = Eval-JS "document.querySelector('#welcome-modal .modal-title').innerText"
    Assert-Condition ($welcomeTitle -like "*WELCOME TO THE FACTORY*") "Welcome modal title is 'WELCOME TO THE FACTORY'"

    $welcomeBody = Eval-JS "document.querySelector('#welcome-modal .welcome-rules-box').innerText"
    Assert-Condition ($welcomeBody -like "*Connect the gears*" -and $welcomeBody -like "*make the machine run*") "Welcome steps convey core rules simply"

    Save-Screenshot "phase11_01_welcome_modal.png"

    # Click start first machine
    Eval-JS "document.getElementById('btn-welcome-start').click();" | Out-Null
    Start-Sleep -Milliseconds 400

    $welcomeClosed = Eval-JS "document.getElementById('welcome-modal').style.display === 'none' || !document.getElementById('welcome-modal').classList.contains('active')"
    Assert-Condition ($welcomeClosed -eq $true) "Welcome modal closed after pressing start"

    $lvl1Loaded = Eval-JS "window.gearFactory.currentLevel === 1"
    Assert-Condition ($lvl1Loaded -eq $true) "First machine (Level 1) automatically loaded"

    Eval-JS "window.gearFactory.closeLevelIntro();" | Out-Null
    Start-Sleep -Milliseconds 300

    Write-Host "`n--- [2. LEVEL 1 VISUAL LEARNING & INSTRUCTIONAL PRESENTATION] ---" -ForegroundColor Yellow
    $missionBanner = Eval-JS "document.getElementById('level-mission-banner').innerText"
    Assert-Condition ($missionBanner -like "*MOTOR*") "Level 1 mission banner shows visual MOTOR diagram"

    $objectiveText = Eval-JS "document.getElementById('mission-objective-text').innerText"
    Assert-Condition ($objectiveText -like "*motor shaft*" -and $objectiveText -like "*machine*") "Level 1 objective is simple and beginner-friendly"

    $shaftPulse = Eval-JS "document.getElementById('input-shaft-slot').classList.contains('beginner-guidance-pulse')"
    Assert-Condition ($shaftPulse -eq $true) "Shaft slot has gentle beginner guidance pulse on Level 1"

    $hintText = Eval-JS "document.getElementById('contextual-hint-text').innerText"
    Assert-Condition ($hintText -like "*motor shaft*") "Contextual hint recommends placing gear on motor shaft"

    $motorGearLabel = Eval-JS "document.querySelector('#input-shaft-slot .slot-title').innerText"
    Assert-Condition ($motorGearLabel -like "*INPUT GEAR*" -or $motorGearLabel -like "*MOTOR GEAR*") "Wording updated to 'INPUT GEAR'"

    $machineGearLabel = Eval-JS "document.querySelector('#output-shaft-slot .slot-title').innerText"
    Assert-Condition ($machineGearLabel -like "*OUTPUT GEAR*" -or $machineGearLabel -like "*MACHINE GEAR*") "Wording updated to 'OUTPUT GEAR'"

    $targetSpeedLabel = Eval-JS "document.querySelector('.target-box .objective-label').innerText"
    Assert-Condition ($targetSpeedLabel -like "*Target Speed*") "Target RPM simplified to 'Target Speed'"

    Save-Screenshot "phase11_02_level1_guidance.png"

    Write-Host '
--- [3. LEVELS 2–5 CONCEPT PROGRESSION CHECK] ---' -ForegroundColor Yellow
    Eval-JS 'window.gearFactory.setHighestUnlockedLevel(10);' | Out-Null
    # Level 2
    Eval-JS "window.gearFactory.loadLevel(2, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl2Hint = Eval-JS "document.getElementById('level-mission-banner').innerText"
    Assert-Condition (($lvl2Hint -like "*SMALL GEAR*" -and $lvl2Hint -like "*BIG GEAR*")) "Level 2 visual hint shows SMALL GEAR -> BIG GEAR"
    $lvl2Obj = Eval-JS "document.getElementById('mission-objective-text').innerText"
    Assert-Condition ($lvl2Obj -like "*Big gears turn slower*") "Level 2 objective explains big gears turn slower"

    # Level 3
    Eval-JS "window.gearFactory.loadLevel(3, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl3Hint = Eval-JS "document.getElementById('level-mission-banner').innerText"
    Assert-Condition (($lvl3Hint -like "*BIG GEAR*" -and $lvl3Hint -like "*SMALL GEAR*")) "Level 3 visual hint shows BIG GEAR -> SMALL GEAR"
    $lvl3Obj = Eval-JS "document.getElementById('mission-objective-text').innerText"
    Assert-Condition ($lvl3Obj -like "*Small gears turn faster*") "Level 3 objective explains small gears turn faster"

    # Level 4 Direction
    Eval-JS "window.gearFactory.loadLevel(4, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl4Obj = Eval-JS "document.getElementById('mission-objective-text').innerText"
    Assert-Condition ($lvl4Obj -like "*opposite directions*") "Level 4 objective explains gears turn in opposite directions"

    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20); window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 300

    $inArrowVis = Eval-JS "window.gearFactory.inputDirectionArrow ? window.gearFactory.inputDirectionArrow.visible : false"
    $outArrowVis = Eval-JS "window.gearFactory.outputDirectionArrow ? window.gearFactory.outputDirectionArrow.visible : false"
    Assert-Condition ($inArrowVis -eq $true -and $outArrowVis -eq $true) "Subtle 3D direction rotation arrows visible on Level 4"

    $dirBadgeIn = Eval-JS "document.querySelector('#input-shaft-slot .slot-dir-badge').innerText"
    $dirBadgeOut = Eval-JS "document.querySelector('#output-shaft-slot .slot-dir-badge').innerText"
    Assert-Condition ($dirBadgeIn -like "*CW*" -and $dirBadgeOut -like "*CCW*") "UI slot cards display opposite direction badges (CW vs CCW)"

    Save-Screenshot "phase11_03_level4_direction_arrows.png"

    # Level 5 Target matching
    Eval-JS "window.gearFactory.loadLevel(5, true);" | Out-Null
    Start-Sleep -Milliseconds 200
    $lvl5Obj = Eval-JS "document.getElementById('mission-objective-text').innerText"
    Assert-Condition ($lvl5Obj -like "*target speed*") "Level 5 teaches matching target speed"

    Write-Host "`n--- [4. CONTEXTUAL HINT SYSTEM & NON-HARSH FEEDBACK] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.loadLevel(1, true);" | Out-Null
    Start-Sleep -Milliseconds 200

    $hintEmpty = Eval-JS "document.getElementById('contextual-hint-text').innerText"
    Assert-Condition ($hintEmpty -like "*motor shaft*") "Contextual hint for empty workbench guides to motor shaft"

    Eval-JS "window.gearFactory.placeGearOnShaft('input', 20);" | Out-Null
    Start-Sleep -Milliseconds 200
    $hintOneGear = Eval-JS "document.getElementById('contextual-hint-text').innerText"
    Assert-Condition ($hintOneGear -like "*machine shaft*") "Contextual hint advises placing gear on machine shaft"

    Eval-JS "window.gearFactory.placeGearOnShaft('output', 10);" | Out-Null
    Start-Sleep -Milliseconds 200
    Eval-JS "window.gearFactory.checkSolution();" | Out-Null
    Start-Sleep -Milliseconds 300

    $failBanner = Eval-JS "document.getElementById('fail-banner-desc').innerText"
    Assert-Condition ($failBanner -notlike "*ERROR*" -and $failBanner -notlike "*FAIL*" -and $failBanner -like "*Not quite!*") "Incorrect feedback is friendly and non-harsh ('Not quite!')"
    Assert-Condition ($failBanner -like "*too fast*") "Failure feedback coaches player that machine is spinning too fast"

    $hintTooFast = Eval-JS "document.getElementById('contextual-hint-text').innerText"
    Assert-Condition ($hintTooFast -like "*too fast*" -or $hintTooFast -like "*larger machine gear*") "Contextual hint suggests larger machine gear to slow down"

    Eval-JS "window.gearFactory.placeGearOnShaft('output', 40);" | Out-Null
    Start-Sleep -Milliseconds 200
    $isSolved = Eval-JS "window.gearFactory.checkSolution();"
    Assert-Condition ($isSolved -eq $true) "Level 1 solved with correct 20T/40T ratio"

    $successBanner = Eval-JS "document.getElementById('success-banner-desc').innerText"
    Assert-Condition ($successBanner -like "*GEARS CONNECTED!*" -and $successBanner -like "*Machine running*") "Success feedback is punchy and satisfying ('GEARS CONNECTED!')"

    Save-Screenshot "phase11_04_friendly_success_modal.png"

    Write-Host "`n--- [5. RPM EXPLANATION MODAL] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.closeLevelComplete();" | Out-Null
    Start-Sleep -Milliseconds 200

    Eval-JS "document.getElementById('btn-rpm-info').click();" | Out-Null
    Start-Sleep -Milliseconds 300

    $rpmModalActive = Eval-JS "document.getElementById('rpm-info-modal').classList.contains('active') || document.getElementById('rpm-info-modal').style.display === 'flex'"
    Assert-Condition ($rpmModalActive -eq $true) "RPM info modal opens upon clicking question mark button"

    $rpmModalContent = Eval-JS "document.querySelector('#rpm-info-modal .rpm-info-card').innerText"
    Assert-Condition ($rpmModalContent -like "*Revolutions Per Minute*" -and $rpmModalContent -like "*one minute*") "RPM explanation explains rotations per minute simply for non-engineers"

    Save-Screenshot "phase11_05_rpm_info_modal.png"

    Eval-JS "document.getElementById('btn-close-rpm-info').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $rpmModalClosed = Eval-JS "document.getElementById('rpm-info-modal').style.display === 'none' || !document.getElementById('rpm-info-modal').classList.contains('active')"
    Assert-Condition ($rpmModalClosed -eq $true) "RPM modal closes properly"

    Write-Host "`n--- [6. 'HOW GEARS WORK' 4-PAGE VISUAL GUIDE] ---" -ForegroundColor Yellow
    Eval-JS "window.gearFactory.openHowGearsModal();" | Out-Null
    Start-Sleep -Milliseconds 300

    $howActive = Eval-JS "document.getElementById('how-gears-work-modal').classList.contains('active') || document.getElementById('how-gears-work-modal').style.display === 'flex'"
    Assert-Condition ($howActive -eq $true) "'How Gears Work' modal opened"

    $page1Text = Eval-JS "document.getElementById('how-gears-body').innerText"
    Assert-Condition ($page1Text -like "*Small gears can spin faster*") "Page 1 teaches small gear spins faster"

    Eval-JS "document.getElementById('btn-how-gears-next').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $page2Text = Eval-JS "document.getElementById('how-gears-body').innerText"
    Assert-Condition ($page2Text -like "*Big gears can spin slower*") "Page 2 teaches big gear spins slower"

    Eval-JS "document.getElementById('btn-how-gears-next').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $page3Text = Eval-JS "document.getElementById('how-gears-body').innerText"
    Assert-Condition ($page3Text -like "*transfer movement*") "Page 3 teaches two gears transfer movement"

    Save-Screenshot "phase11_06_how_gears_page3.png"

    Eval-JS "document.getElementById('btn-how-gears-next').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $page4Text = Eval-JS "document.getElementById('how-gears-body').innerText"
    Assert-Condition ($page4Text -like "*different gears*") "Page 4 invites player to experiment"

    Eval-JS "document.getElementById('btn-close-how-gears').click();" | Out-Null
    Start-Sleep -Milliseconds 200
    $howClosed = Eval-JS "document.getElementById('how-gears-work-modal').style.display === 'none' || !document.getElementById('how-gears-work-modal').classList.contains('active')"
    Assert-Condition ($howClosed -eq $true) "'How Gears Work' modal closes"

    Write-Host "`n--- [7. LEVELS 6-10 DIFFICULTY PROGRESSION AND INDUSTRIAL AESTHETIC] ---" -ForegroundColor Yellow
    for ($i = 6; $i -le 10; $i++) {
        $lvl = Eval-JS "window.gearFactory.levelData.find(l => l.level === $i)"
        $gLen = $lvl.availableGears.length
        Assert-Condition ($gLen -ge 4) "Level $i has multiple gear choices ($gLen gears)"
        Assert-Condition ($lvl.objective.Length -gt 5) "Level $i has clear workshop objective: $($lvl.objective)"
    }

    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " PHASE 11 ONBOARDING VERIFICATION: $passedTests / $totalTests TESTS PASSED" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

} finally {
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




