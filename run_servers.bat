@echo off
setlocal enabledelayedexpansion
title Blueprint Generator - Server Manager

:: ========================================================
:: PROJECT STARTUP SCRIPT
:: ========================================================

:start
cls
echo ========================================================
echo   Blueprint Generator App - Starting Servers...
echo ========================================================
echo.

:: 1. Cleanup existing processes
echo [1/2] Cleaning up existing processes on ports 3000, 5001...
powershell -Command "Get-NetTCPConnection -LocalPort 3000, 5001 -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {} }"
timeout /t 1 > nul

:: 2. Start servers
echo [2/2] Launching Frontend and Backend servers...
echo.
echo --------------------------------------------------------
echo   PRESS Ctrl+C TO STOP ALL SERVERS
echo --------------------------------------------------------
echo.

:: Run all servers using the dev:all script
:: --kill-others ensures that if one server fails, the others are stopped, 
:: allowing this batch script to catch the error and restart.
(call npm run dev:all) < nul

:: 3. Handle Restart/Exit
:: If ERRORLEVEL is non-zero, it likely crashed.
:: If the user stops with Ctrl+C, it might return 0 or 1 depending on state.
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ALERT] A server has encountered an error (Exit Code: %ERRORLEVEL%).
    echo [INFO] Restarting all services in 5 seconds...
    echo [HINT] To exit completely, close this window.
    timeout /t 5
    goto start
)

echo.
echo [INFO] Servers stopped normally.
echo [INFO] Closing terminal in 2 seconds...
timeout /t 2 > nul
exit
