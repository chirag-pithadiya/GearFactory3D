param([int]$Port = 9245)
$ErrorActionPreference = "Stop"

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "default_chrome_test"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--window-size=1440,900",
    "http://localhost:8088/index.html"
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $wsUrl = $pages[0].webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.ConnectAsync([System.Uri]$wsUrl, [System.Threading.CancellationToken]::None).Wait()

    $script:id = 1
    function Send-CDP($method, $params = @{}) {
        $script:id++
        $req = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($req)
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).Wait()
        
        $buf = New-Object byte[] 2097152
        $ms = New-Object System.IO.MemoryStream
        do {
            $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
            $res = $ws.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).Result
            $ms.Write($buf, 0, $res.Count)
        } while (-not $res.EndOfMessage)
        
        $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        return ($raw | ConvertFrom-Json)
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Console.enable")

    $eval = Send-CDP "Runtime.evaluate" @{ expression = @"
    (() => {
        const c = document.getElementById('webgl-canvas');
        const gl = c ? (c.getContext('webgl2') || c.getContext('webgl')) : null;
        return {
            hasCanvas: !!c,
            canvasWidth: c ? c.width : 0,
            canvasHeight: c ? c.height : 0,
            hasGL: !!gl,
            glVendor: gl ? gl.getParameter(gl.VENDOR) : null,
            glRenderer: gl ? gl.getParameter(gl.RENDERER) : null,
            gearFactoryMounted: typeof window.gearFactory !== 'undefined',
            currentAssemblyGear: !!(window.gearFactory && window.gearFactory.inputGear),
            errors: window.__errors || []
        };
    })()
"@; returnByValue = $true }

    Write-Host "Default Chrome State:"
    $eval.result.result.value | ConvertTo-Json | Write-Host

    $ss = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    [System.IO.File]::WriteAllBytes("d:\GAMES\GearFactory3D\default_chrome_preview.png", [System.Convert]::FromBase64String($ss.result.data))
    Write-Host "Saved default_chrome_preview.png"
} finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
}
