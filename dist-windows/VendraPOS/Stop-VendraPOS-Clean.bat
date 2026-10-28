@echo off
echo Stopping Vendra POS...

:: Kill PHP server processes
taskkill /F /IM php.exe /T >nul 2>&1
taskkill /F /IM php-win.exe /T >nul 2>&1

echo [DONE] Vendra POS server stopped.
echo.
set /p REMOVE="Remove from Windows Startup? [Y/N]: "
if /i "%REMOVE%"=="Y" (
    reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "VendraPOS" /f >nul 2>&1
    echo [SUCCESS] Removed from Windows Startup.
)
pause
