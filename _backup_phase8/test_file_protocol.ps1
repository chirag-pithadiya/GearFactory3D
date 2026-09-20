param([int]$Port = 9250)
$ErrorActionPreference = "Stop"

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "file_proto_test"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=$tempDir",
    "--window-size=1440,900",
    "file:///d:/GAMES/GearFactory3D/index.html"
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

    Start-Sleep -Seconds 1

    $eval = Send-CDP "Runtime.evaluate" @{ expression = "typeof window.gearFactory"; returnByValue = $true }
    Write-Host "Type of gearFactory on file:// : $($eval.result.result.value)"

    $ss = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    [System.IO.File]::WriteAllBytes("d:\GAMES\GearFactory3D\file_protocol_preview.png", [System.Convert]::FromBase64String($ss.result.data))
    Write-Host "Saved file_protocol_preview.png"
} finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
}
