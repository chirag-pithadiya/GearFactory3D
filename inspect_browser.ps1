Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" | ForEach-Object {
    if ($_.CommandLine -and ($_.CommandLine -notlike '*--type=*')) {
        Write-Host "Process ID: $($_.ProcessId)"
        Write-Host "CommandLine: $($_.CommandLine)"
    }
}
Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | ForEach-Object {
    if ($_.CommandLine -and ($_.CommandLine -notlike '*--type=*')) {
        Write-Host "Chrome PID: $($_.ProcessId)"
        Write-Host "Chrome CommandLine: $($_.CommandLine)"
    }
}
