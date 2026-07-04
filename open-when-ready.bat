@echo off
REM Waits for the dev server to answer on :4499, then opens the browser.
set "URL=http://localhost:4499"

for /l %%i in (1,1,90) do (
  powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 (
    start "" "%URL%"
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)

echo Timed out waiting for the server to start.
exit /b 1
