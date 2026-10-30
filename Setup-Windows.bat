@echo off
setlocal enabledelayedexpansion
title Vendra POS - Windows Setup & Launcher
color 0B

cd /d "%~dp0"
set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

echo ======================================================================
echo             VENDRA COMMERCIAL POS - WINDOWS SETUP
echo             Universal Retail ^& Solar Energy Showroom
echo ======================================================================
echo.
echo [1/4] Checking system environment...

:: Ensure 64-bit Windows
if /i not "%PROCESSOR_ARCHITECTURE%"=="AMD64" if /i not "%PROCESSOR_ARCHITEW6432%"=="AMD64" (
    echo [ERROR] Vendra POS requires 64-bit Windows (x64).
    pause
    exit /b 1
)

:: Create required runtime directories
if not exist "%REPO_ROOT%\logs" mkdir "%REPO_ROOT%\logs"
if not exist "%REPO_ROOT%\database" mkdir "%REPO_ROOT%\database"
if not exist "%REPO_ROOT%\public\uploads" mkdir "%REPO_ROOT%\public\uploads"

:: Initialize database from template if missing
if not exist "%REPO_ROOT%\database\omnipos.sqlite" (
    if exist "%REPO_ROOT%\database\omnipos-solar.sqlite" (
        copy /y "%REPO_ROOT%\database\omnipos-solar.sqlite" "%REPO_ROOT%\database\omnipos.sqlite" >nul
        echo [OK] Initialized database with solar showroom catalog.
    )
)

:: Check PHP runtime: 1. check portable php, 2. check system php
set "PHP_CMD="
if exist "%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe" (
    set "PHP_CMD=%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe"
    set "PHP_EXT=%REPO_ROOT%\dist-windows\VendraPOS\php\ext"
    set "PHP_INI=%REPO_ROOT%\dist-windows\VendraPOS\php\php.ini"
) else (
    where php >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set "PHP_CMD=php"
        set "PHP_EXT="
        set "PHP_INI="
    )
)

:: If PHP is missing, download portable PHP automatically
if "%PHP_CMD%"=="" (
    echo [2/4] Embedded PHP engine not found. Downloading portable PHP runtime...
    echo This is a one-time automated download (~28 MB)...
    mkdir "%REPO_ROOT%\dist-windows\VendraPOS\php" 2>nul
    
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ProgressPreference = 'SilentlyContinue'; " ^
        "Write-Host 'Downloading PHP 8.3 x64 portable...'; " ^
        "Invoke-WebRequest -Uri 'https://windows.php.net/downloads/releases/php-8.3.14-Win32-vs16-x64.zip' -OutFile '%TEMP%\php_setup.zip'; " ^
        "Write-Host 'Extracting PHP runtime...'; " ^
        "Expand-Archive -Path '%TEMP%\php_setup.zip' -DestinationPath '%REPO_ROOT%\dist-windows\VendraPOS\php' -Force; " ^
        "Remove-Item -Force '%TEMP%\php_setup.zip'"

    if exist "%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe" (
        set "PHP_CMD=%REPO_ROOT%\dist-windows\VendraPOS\php\php.exe"
        set "PHP_EXT=%REPO_ROOT%\dist-windows\VendraPOS\php\ext"
        set "PHP_INI=%REPO_ROOT%\dist-windows\VendraPOS\php\php.ini"
        echo [OK] Portable PHP runtime downloaded and extracted.
    ) else (
        echo [ERROR] Could not automatically download PHP runtime.
        echo Please ensure internet access is available or install PHP 8.2+ on your system.
        pause
        exit /b 1
    )
) else (
    echo [2/4] PHP runtime engine verified: %PHP_CMD%
)

:: Check Visual C++ runtime
if not "%PHP_EXT%"=="" (
    "%PHP_CMD%" -d extension_dir="%PHP_EXT%" -c "%PHP_INI%" -v >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [NOTICE] Visual C++ Runtime missing. Installing bundled Microsoft VC++...
        if exist "%REPO_ROOT%\dist-windows\VendraPOS\vc_redist.x64.exe" (
            start /wait "" "%REPO_ROOT%\dist-windows\VendraPOS\vc_redist.x64.exe" /install /passive /norestart
        )
    )
)

:: Create Desktop shortcut
echo [3/4] Creating Desktop Shortcut...
set "VBS_SCRIPT=%TEMP%\vendra_mkshortcut_%RANDOM%.vbs"
(
echo Option Explicit
echo Dim ws, strDesktop, sc
echo Set ws = CreateObject("WScript.Shell"^)
echo strDesktop = ws.SpecialFolders("Desktop"^)
echo Set sc = ws.CreateShortcut(strDesktop ^& "\Vendra POS.lnk"^)
echo sc.TargetPath = "%REPO_ROOT%\Start-VendraPOS.bat"
echo sc.WorkingDirectory = "%REPO_ROOT%"
if exist "%REPO_ROOT%\public\favicon.ico" echo sc.IconLocation = "%REPO_ROOT%\public\favicon.ico, 0"
echo sc.Description = "Vendra Commercial POS System"
echo sc.Save
) > "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%" >nul 2>&1
if exist "%VBS_SCRIPT%" del /f /q "%VBS_SCRIPT%"
echo [OK] Desktop Shortcut created: 'Vendra POS'

echo [4/4] Starting Vendra POS...
echo.
echo ======================================================================
echo                  SETUP COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo Starting application window...
start "" "%REPO_ROOT%\Start-VendraPOS.bat"
timeout /t 3 >nul
exit /b 0
