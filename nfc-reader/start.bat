@echo off
title Archisys NFC Reader
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed.
  echo Download it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo.
echo Starting Archisys NFC Reader...
echo.
node index.js

echo.
pause
