param([int]$Port = 9260)
$ErrorActionPreference = "Stop"

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$tempDir = Join-Path $env:TEMP "edge_gear_test"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=$tempDir",
    "--window-size=1440,900",
    "http://localhost:8088/index.html"
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $gamePage = $pages | Where-Object { $_.url -like "*8088*" } | Select-Object -First 1
    if (-not $gamePage) { $gamePage = $pages[0] }
    $wsUrl = [System.Uri]::new($gamePage.webSocketDebuggerUrl)
    
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $ws.ConnectAsync($wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:id = 1
    function Send-CDP($method, $params = @{}) {
        $script:id++
        $thisId = $script:id
        $req = @{ id = $thisId; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($req)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()

        while ($true) {
            $buf = [byte[]]::new(2097152)
            $ms = [System.IO.MemoryStream]::new()
            do {
                $recvSegment = [System.ArraySegment[byte]]::new($buf)
                $res = $ws.ReceiveAsync($recvSegment, [System.Threading.CancellationToken]::None).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)

            $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $msg = $raw | ConvertFrom-Json
            if ($msg.method -eq "Runtime.exceptionThrown") {
                Write-Host "EDGE EXCEPTION: $($msg.params.exceptionDetails.exception.description)" -ForegroundColor Red
            } elseif ($msg.method -eq "Console.messageAdded") {
                Write-Host "EDGE CONSOLE: [$($msg.params.message.level)] $($msg.params.message.text)" -ForegroundColor Yellow
            }
            if ($msg.id -eq $thisId) {
                return $msg
            }
        }
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Console.enable")

    Start-Sleep -Seconds 2

    # Check for console messages and evaluate window.gearFactory
    $evalJs = @"
    (() => {
        const c = document.getElementById('webgl-canvas');
        let webglErr = null;
        let gl = null;
        try {
            gl = c.getContext('webgl2') || c.getContext('webgl');
        } catch (e) {
            webglErr = e.message;
        }
        return {
            hasCanvas: !!c,
            canvasW: c ? c.width : 0,
            canvasH: c ? c.height : 0,
            hasGL: !!gl,
            webglErr: webglErr,
            glVendor: gl ? gl.getParameter(gl.VENDOR) : null,
            glRenderer: gl ? gl.getParameter(gl.RENDERER) : null,
            hasGearFactory: typeof window.gearFactory !== 'undefined',
            hasInputGear: !!(window.gearFactory && window.gearFactory.inputGear),
            hasOutputGear: !!(window.gearFactory && window.gearFactory.outputGear)
        };
    })()
"@

    $r = Send-CDP "Runtime.evaluate" @{ expression = $evalJs; returnByValue = $true }
    Write-Host "Edge Evaluation State:" -ForegroundColor Cyan
    $r.result.result.value | ConvertTo-Json | Write-Host

    $ss = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    [System.IO.File]::WriteAllBytes("d:\GAMES\GearFactory3D\edge_preview.png", [System.Convert]::FromBase64String($ss.result.data))
    Write-Host "Screenshot saved to edge_preview.png" -ForegroundColor Green
} finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
}
