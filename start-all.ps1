# Start all IoT Dashboard services as independent background processes
# Usage: .\start-all.ps1
# Stop:  .\stop-all.ps1

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

Write-Host "=== IoT Dashboard — Starting All Services ===" -ForegroundColor Cyan

# Kill any previous instances on our ports
Get-NetTCPConnection -LocalPort 8001,8002,5174 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep 1

# --- Python LLM Service (:8001) ---
Write-Host "[1/3] Python LLM Service on :8001" -ForegroundColor Yellow
$py = Start-Process -FilePath "python" -ArgumentList "-u main.py" -WorkingDirectory "$root\backend-python" -NoNewWindow -PassThru
Write-Host "       PID: $($py.Id)" -ForegroundColor Green

# --- Go Backend (:8002) ---
Write-Host "[2/3] Go API Backend on :8002" -ForegroundColor Yellow
$goBin = Join-Path $root "backend-go\iot-backend.exe"
if (-not (Test-Path -LiteralPath $goBin)) {
    Write-Host "       Building Go backend..." -ForegroundColor DarkYellow
    Set-Location -LiteralPath "$root\backend-go"
    go build -o iot-backend.exe .
}
$go = Start-Process -FilePath $goBin -WorkingDirectory "$root\backend-go" -NoNewWindow -PassThru
Write-Host "       PID: $($go.Id)" -ForegroundColor Green

# --- Frontend (:5174) ---
Write-Host "[3/3] Vite Frontend on :5174" -ForegroundColor Yellow
$fe = Start-Process -FilePath "cmd" -ArgumentList "/c npx vite --host 0.0.0.0 --port 5174" -WorkingDirectory "$root\frontend" -NoNewWindow -PassThru
Write-Host "       PID: $($fe.Id)" -ForegroundColor Green

Write-Host "`n=== All services launched ===" -ForegroundColor Cyan
Write-Host "`n  Python LLM : http://localhost:8001 (PID $($py.Id))"
Write-Host "  Go API     : http://localhost:8002 (PID $($go.Id))"
Write-Host "  Frontend   : http://localhost:5174 (PID $($fe.Id))"
Write-Host "`n  Stop: .\stop-all.ps1  (or taskkill /PID $($py.Id),$($go.Id),$($fe.Id))"
