param([int]$Port = 9292)
$ErrorActionPreference = "Stop"

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = Join-Path $env:TEMP "gear_index_file_test"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

$indexPath = "d:\GAMES\GearFactory3D\index.html"
$fileUrl = "file:///$($indexPath.Replace('\', '/'))"

$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--use-gl=angle",
    "--enable-webgl",
    $fileUrl
) -PassThru

try {
    Start-Sleep -Seconds 3
    $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json"
    $page = $pages | Where-Object { $_.type -eq "page" -or $_.url -like "*GearFactory3D*" } | Select-Object -First 1
    if (-not $page) { $page = $pages[0] }
    Write-Host "Page URL: $($page.url)"
    Write-Host "Page Title: $($page.title)"

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
                Write-Host "JS EXCEPTION: $($msg.params.exceptionDetails.exception.description)" -ForegroundColor Red
            } elseif ($msg.method -eq "Console.messageAdded") {
                Write-Host "CONSOLE [$($msg.params.message.level)]: $($msg.params.message.text)" -ForegroundColor Yellow
            }
            if ($msg.id -eq $thisId) {
                return $msg
            }
        }
    }

    [void](Send-CDP "Runtime.enable")
    [void](Send-CDP "Console.enable")

    Start-Sleep -Seconds 2

    $eval = Send-CDP "Runtime.evaluate" @{
        expression = @"
        (() => {
            const gf = window.gearFactory;
            const canvas = document.getElementById('webgl-canvas');
            return {
                url: window.location.href,
                protocol: window.location.protocol,
                hasCanvas: !!canvas,
                canvasWidth: canvas ? canvas.width : 0,
                canvasHeight: canvas ? canvas.height : 0,
                hasTHREE: typeof window.THREE !== 'undefined',
                hasGearFactory: typeof gf !== 'undefined',
                hasInputGear: !!(gf && gf.inputGear),
                hasOutputGear: !!(gf && gf.outputGear),
                inputTeeth: gf ? gf.selectedInputTeeth : null,
                outputTeeth: gf ? gf.selectedOutputTeeth : null,
                isRunning: gf ? gf.state.isRunning : false
            };
        })()
"@
        returnByValue = $true
    }
    Write-Host "file:/// protocol evaluation result:" -ForegroundColor Cyan
    $eval.result.result.value | ConvertTo-Json | Write-Host

    [void](Send-CDP "Emulation.setDeviceMetricsOverride" @{
        width = 1440
        height = 900
        deviceScaleFactor = 1
        mobile = $false
    })
    Start-Sleep -Seconds 1

    $ss = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    [System.IO.File]::WriteAllBytes("d:\GAMES\GearFactory3D\index_file_protocol_preview.png", [System.Convert]::FromBase64String($ss.result.data))
    [System.IO.File]::WriteAllBytes("C:\Users\Chirag\.gemini\antigravity-ide\brain\fa3d4768-9a7d-4667-b7d1-d056cca8ec26\gear_polished_3d_preview.png", [System.Convert]::FromBase64String($ss.result.data))
    Write-Host "Saved index_file_protocol_preview.png and gear_polished_3d_preview.png" -ForegroundColor Green
} finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
}
