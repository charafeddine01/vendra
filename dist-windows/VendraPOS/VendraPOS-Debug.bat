@echo off
setlocal enabledelayedexpansion
title Vendra POS - Diagnostic & Troubleshooting Console
color 0E

cd /d "%~dp0"
set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"

echo ======================================================================
echo              VENDRA POS - DIAGNOSTIC ^& DEBUG CONSOLE
echo ======================================================================
echo Current directory: %APP_ROOT%
echo.
echo [1] Checking PHP binary...
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -v
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PHP binary failed to run. Visual C++ 2015-2022 x64 might be missing.
    if not exist "%APP_ROOT%\vc_redist.x64.exe" (
        echo Downloading Microsoft Visual C++ 2015-2022 x64 Redistributable...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile '%APP_ROOT%\vc_redist.x64.exe'"
    )
    if exist "%APP_ROOT%\vc_redist.x64.exe" (
        start /wait "" "%APP_ROOT%\vc_redist.x64.exe"
    )
)
echo.
echo [2] Checking Active PHP Extensions...
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -m
echo.
echo [3] Testing SQLite Database Connection...
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -r "try { $p = new PDO('sqlite:%APP_ROOT%\app\database\omnipos.sqlite'); echo '[OK] SQLite connected successfully. Total products: ' . $p->query('SELECT COUNT(*) FROM products')->fetchColumn() . PHP_EOL; } catch (Exception $e) { echo '[FAIL] SQLite error: ' . $e->getMessage() . PHP_EOL; }"
echo.
echo [4] Starting PHP Built-in Server on http://127.0.0.1:8080...
echo Keep this window open. Open http://127.0.0.1:8080 in your browser.
echo Press Ctrl+C to terminate the test server.
echo.
start "" "http://127.0.0.1:8080"
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -S 127.0.0.1:8080 -t "%APP_ROOT%\app" "%APP_ROOT%\app\router.php"
pause
