# Test loading src/main.js directly
param([int]$Port = 9226)

$tempDir = "C:\Users\Chirag\AppData\Local\Temp\gear_factory_test_src"
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$proc = Start-Process -FilePath $chromePath -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$tempDir",
    "--window-size=1280,800",
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
        $buffer = [byte[]]::new(2097152)
        $memStream = [System.IO.MemoryStream]::new()
        do {
            $recvSegment = [System.ArraySegment[byte]]::new($buffer)
            $res = $ws.ReceiveAsync($recvSegment, [System.Threading.CancellationToken]::None).Result
            $memStream.Write($buffer, 0, $res.Count)
        } while (-not $res.EndOfMessage)
        $bytes = $memStream.ToArray()
        $jsonStr = [System.Text.Encoding]::UTF8.GetString($bytes)
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
            if ($msg.id -eq $thisId) { return $msg }
        }
    }

    [void](Call-CDP "Runtime.enable")
    [void](Call-CDP "Console.enable")

    # Now let's try importing ./src/main.js dynamically
    $evalJs = @"
    (async () => {
        try {
            console.log('Testing dynamic import of ./src/main.js...');
            const mod = await import('./src/main.js');
            console.log('Successfully imported ./src/main.js!');
            return { success: true };
        } catch (err) {
            console.error('Import error for ./src/main.js:', err.message, err.stack);
            return { success: false, error: err.message, stack: err.stack };
        }
    })()
"@
    $r = Call-CDP "Runtime.evaluate" @{ expression = $evalJs; awaitPromise = $true; returnByValue = $true }
    Write-Host "Dynamic import result:" -ForegroundColor Cyan
    $r.result.result.value | ConvertTo-Json | Write-Host
} finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill() }
}
