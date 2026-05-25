#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Stop all IoT Dashboard services.
#>

Write-Host "=== Stopping all IoT Dashboard services ===" -ForegroundColor Cyan

$jobNames = @("iot-python-llm", "iot-go-backend", "iot-frontend")

foreach ($name in $jobNames) {
    $job = Get-Job -Name $name -ErrorAction SilentlyContinue
    if ($job) {
        Stop-Job -Name $name -ErrorAction SilentlyContinue
        Remove-Job -Name $name -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped: $name" -ForegroundColor Green
    } else {
        Write-Host "Not running: $name" -ForegroundColor DarkGray
    }
}

# Also kill any lingering processes on our ports
Get-NetTCPConnection -LocalPort 8001,8002,5174 -ErrorAction SilentlyContinue |
    ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Killed PID $($_.OwningProcess) on port $($_.LocalPort)" -ForegroundColor DarkYellow
    }

Write-Host "Done." -ForegroundColor Cyan
