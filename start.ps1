# PowerShell Launcher for Royal Heritage Restaurant Management ERP System

$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Launching Unified Restaurant ERP (Single URL Portal)  " -ForegroundColor Cyan
Write-Host "  1. Backend API Server:     http://localhost:5000/api  " -ForegroundColor Cyan
Write-Host "  2. Unified ERP Portal:     http://localhost:3000      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Backend Server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; `$env:PATH = '$env:LOCALAPPDATA\Programs\nodejs;' + `$env:PATH; npm run dev"

Start-Sleep -Seconds 3

# 2. Start Unified Portal (Admin + Operations full stack)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\admin'; `$env:PATH = '$env:LOCALAPPDATA\Programs\nodejs;' + `$env:PATH; npm run dev"

Write-Host "Restaurant Management ERP Launched Successfully!" -ForegroundColor Green
Write-Host "Unified Portal:           http://localhost:3000" -ForegroundColor Yellow
Write-Host "POS Touch Terminal:       http://localhost:3000/pos" -ForegroundColor Yellow
Write-Host "Kitchen Display System:   http://localhost:3000/kitchen" -ForegroundColor Yellow
Write-Host "Public Token TV Display:  http://localhost:3000/display/tokens" -ForegroundColor Yellow
Write-Host "Super Admin Governance:   http://localhost:3000/admin" -ForegroundColor Yellow
Write-Host "Backend REST API:         http://localhost:5000/api" -ForegroundColor Yellow

