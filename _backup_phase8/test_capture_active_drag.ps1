param([int]$Port = 9337)
$ErrorActionPreference = "Stop"

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_drag_preview_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
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
            if ($msg.id -eq $thisId) { return $msg }
        }
    }

    function Exec-Eval($expr) {
        $res = Send-CDP "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
        return $res.result.result.value
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Page.enable")
    [void](Send-CDP "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false })

    Start-Sleep -Seconds 2

    # Start dragging 20T gear and position preview directly over the Input Shaft drop target with green halo
    Exec-Eval @"
    (() => {
        const gf = window.gearFactory;
        const dd = gf.dragDropState;
        gf.startGearDrag(20);
        dd.activeHoverTarget = 'input';
        dd.previewMesh.position.set(0, dd.shaftPositions.shaftY, dd.shaftPositions.posZInput);
        dd.haloMeshes.input.userData.setOpacity(0.90);
        dd.haloMeshes.output.userData.setOpacity(0.0);
    })()
"@

    Start-Sleep -Milliseconds 400
    $dragPreviewImg = Join-Path $artifactDir "phase5_active_drag_highlight.png"
    $res = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    $bytes = [System.Convert]::FromBase64String($res.result.data)
    [System.IO.File]::WriteAllBytes($dragPreviewImg, $bytes)
    Write-Host "Active Drag Screenshot saved: $dragPreviewImg" -ForegroundColor Green

} finally {
    if ($proc -and -not $proc.HasExited) {
        $proc.Kill()
    }
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
