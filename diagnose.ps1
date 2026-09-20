# Diagnostic script to inspect the running page via Chrome CDP
param([int]$Port = 9226)

$ErrorActionPreference = "Stop"

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_diag"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--window-size=1440,900",
    "--use-gl=angle",
    "--enable-webgl",
    "http://localhost:8088/index.html"
) -PassThru

try {
    Start-Sleep -Seconds 2
    $pages = Invoke-RestMethod -Uri "http://localhost:$Port/json"
    $gamePage = $pages | Where-Object { $_.url -like "*localhost:8088*" } | Select-Object -First 1
    if (-not $gamePage) { $gamePage = $pages[0] }

    $wsUrl = [System.Uri]::new($gamePage.webSocketDebuggerUrl)
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $ws.ConnectAsync($wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:msgId = 100

    function Read-NextJson() {
        $buffer = [byte[]]::new(2097152) # 2MB
        $memStream = [System.IO.MemoryStream]::new()
        do {
            $recvSegment = [System.ArraySegment[byte]]::new($buffer)
            $res = $ws.ReceiveAsync($recvSegment, [System.Threading.CancellationToken]::None).Result
            $memStream.Write($buffer, 0, $res.Count)
        } while (-not $res.EndOfMessage)

        $jsonStr = [System.Text.Encoding]::UTF8.GetString($memStream.ToArray())
        return ($jsonStr | ConvertFrom-Json)
    }

    function Call-CDP($method, $params = @{}) {
        $script:msgId++
        $thisId = $script:msgId
        $cmdObj = @{ id = $thisId; method = $method; params = $params }
        $json = $cmdObj | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $segment = [System.ArraySegment[byte]]::new($bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $msg = Read-NextJson
            if ($msg.method) {
                if ($msg.method -eq "Runtime.exceptionThrown") {
                    Write-Host "EXCEPTION: $($msg.params.exceptionDetails.exception.description)" -ForegroundColor Red
                } elseif ($msg.method -eq "Console.messageAdded") {
                    Write-Host "CONSOLE: [$($msg.params.message.level)] $($msg.params.message.text)" -ForegroundColor Yellow
                }
            }
            if ($msg.id -eq $thisId) {
                return $msg
            }
        }
    }

    [void](Call-CDP "Runtime.enable")
    [void](Call-CDP "Console.enable")
    [void](Call-CDP "Page.enable")

    Start-Sleep -Milliseconds 2000

    # Evaluate everything
    $evalJs = @"
    (() => {
        const res = {};
        res.hasGearFactory = typeof window.gearFactory !== 'undefined';
        const canvas = document.getElementById('webgl-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            res.canvas = {
                width: canvas.width,
                height: canvas.height,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                display: window.getComputedStyle(canvas).display,
                visibility: window.getComputedStyle(canvas).visibility,
                opacity: window.getComputedStyle(canvas).opacity
            };
        } else {
            res.canvas = 'NOT FOUND';
        }
        const container = document.getElementById('three-container');
        if (container) {
            const crect = container.getBoundingClientRect();
            res.container = {
                clientWidth: container.clientWidth,
                clientHeight: container.clientHeight,
                rect: { top: crect.top, left: crect.left, width: crect.width, height: crect.height }
            };
        } else {
            res.container = 'NOT FOUND';
        }

        if (window.gearFactory) {
            const gf = window.gearFactory;
            res.sceneChildren = gf.scene ? gf.scene.children.map(c => ({
                name: c.name || c.type,
                type: c.type,
                visible: c.visible,
                pos: [c.position.x, c.position.y, c.position.z],
                scale: [c.scale.x, c.scale.y, c.scale.z],
                childrenCount: c.children ? c.children.length : 0
            })) : 'NO SCENE';

            if (gf.camera) {
                res.camera = {
                    position: [gf.camera.position.x, gf.camera.position.y, gf.camera.position.z],
                    aspect: gf.camera.aspect,
                    fov: gf.camera.fov,
                    near: gf.camera.near,
                    far: gf.camera.far
                };
            }
            if (gf.controls) {
                res.controlsTarget = [gf.controls.target.x, gf.controls.target.y, gf.controls.target.z];
            }
            res.state = gf.state;
            res.puzzleState = gf.puzzleState;
        }

        return res;
    })()
"@

    $r = Call-CDP "Runtime.evaluate" @{ expression = $evalJs; returnByValue = $true }
    Write-Host "Scene Info:" -ForegroundColor Cyan
    $r.result.result.value | ConvertTo-Json -Depth 6 | Write-Host

    # Screenshot
    $ss = Call-CDP "Page.captureScreenshot" @{ format = "png" }
    $ssBytes = [System.Convert]::FromBase64String($ss.result.data)
    [System.IO.File]::WriteAllBytes("d:\GAMES\GearFactory3D\diag_preview.png", $ssBytes)
    Write-Host "Screenshot saved to diag_preview.png" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
}
