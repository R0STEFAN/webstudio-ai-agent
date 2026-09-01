@echo off
setlocal
title Webstudio AI Agent - Control Center
cd /d "%~dp0"

echo.
echo ========================================================
echo   Webstudio AI Agent // Control Center Dashboard
echo ========================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please install Node.js ^(v22.12.0+ recommended^) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Starting Webstudio Control Center GUI...
node scripts\gui-server.mjs %*

if errorlevel 1 (
    echo.
    echo [ERROR] Webstudio Control Center terminated with an error.
    pause
)
