@echo off
title Stop Vendra POS
echo Stopping Vendra POS background server...
taskkill /F /IM php.exe /T 2>nul
taskkill /F /IM php-win.exe /T 2>nul
echo [OK] Vendra POS background server stopped.
timeout /t 2 >nul
