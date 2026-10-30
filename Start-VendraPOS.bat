@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

:: Check if portable distribution exists
if exist "%REPO_ROOT%\dist-windows\VendraPOS\Launch-VendraPOS.vbs" (
    start "" wscript.exe "%REPO_ROOT%\dist-windows\VendraPOS\Launch-VendraPOS.vbs"
    exit /b 0
)

:: Run directly via PHP
set "PHP_CMD=php"
if exist "%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe" (
    set "PHP_CMD=%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe"
    set "PHP_FLAGS=-d extension_dir="%REPO_ROOT%\dist-windows\VendraPOS\php\ext" -c "%REPO_ROOT%\dist-windows\VendraPOS\php\php.ini""
)

echo Starting Vendra POS on http://127.0.0.1:8000 ...
start "" "http://127.0.0.1:8000"
%PHP_CMD% %PHP_FLAGS% -S 127.0.0.1:8000 router.php
