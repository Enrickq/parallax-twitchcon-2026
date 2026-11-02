@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org
  pause
  exit /b 1
)
echo PARALLAX - open http://127.0.0.1:3000 in your browser
echo Keep this window open. Press Ctrl+C to stop.
node server.js
pause
