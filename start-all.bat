@echo off
cd /d "%~dp0"

echo ==================================================
echo    WhatsApp AutoPilot  -  Launcher
echo ==================================================
echo.

REM --- 1. Check Node.js is installed ---------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo         Download the LTS version from https://nodejs.org and re-run this file.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Using Node.js %%v

REM --- 2. Install dependencies if needed -----------------------------
if not exist "node_modules" (
  echo.
  echo First run detected - installing dependencies.
  echo This downloads Chromium ^(~150 MB^) and may take several minutes...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed. Scroll up for details.
    pause
    exit /b 1
  )
) else (
  echo Dependencies already installed - skipping.
)

REM --- 2b. Stop any previous instance + orphaned Chromium ------------
echo Cleaning up any previous instance...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :4499 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'chromium.exe') -and $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>nul

REM --- 3. Open the browser once the server is ready ------------------
echo.
echo Starting server on http://localhost:4499
echo The dashboard will open in your browser automatically.
echo Access key: whatever you set in .env, otherwise the default wa-admin-2025
echo.
start "WA-Open" /d "%~dp0" cmd /c open-when-ready.bat

REM --- 4. Run the app (keep this window open) ------------------------
call npm run dev

echo.
echo Server stopped. Press any key to close this window.
pause >nul
