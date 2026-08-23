@echo off
title Royal Heritage Restaurant Management ERP
echo ========================================================
echo   Launching Unified Restaurant Management ERP System...
echo   1. Backend API Server:     http://localhost:5000/api
echo   2. Unified ERP Portal:     http://localhost:3000
echo ========================================================

REM Add local node to path if present
if exist "%LOCALAPPDATA%\Programs\nodejs" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

echo Starting Backend Server on port 5000...
start "ERP Backend Server (Port 5000)" cmd /k "cd /d %~dp0server && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Unified ERP Portal on port 3000...
start "ERP Unified Portal (Port 3000)" cmd /k "cd /d %~dp0admin && npm run dev"

echo.
echo ========================================================
echo   Restaurant Management ERP Launched Successfully!
echo   - Unified Portal:          http://localhost:3000
echo   - POS Terminal:            http://localhost:3000/pos
echo   - Kitchen KDS:             http://localhost:3000/kitchen
echo   - Token Queue TV:          http://localhost:3000/display/tokens
echo   - Admin Governance:        http://localhost:3000/admin
echo   - Backend REST API:        http://localhost:5000/api
echo ========================================================

