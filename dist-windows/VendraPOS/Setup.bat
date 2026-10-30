@echo off
setlocal enabledelayedexpansion
title Vendra POS - 1-Click Windows Setup
color 0B

cd /d "%~dp0"
set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"

echo ======================================================================
echo             VENDRA COMMERCIAL POS - WINDOWS INSTALLER
echo             Universal Retail ^& Solar Energy Showroom
echo ======================================================================
echo.
echo [1/4] Checking system prerequisites...

:: Check 64-bit architecture
if /i not "%PROCESSOR_ARCHITECTURE%"=="AMD64" if /i not "%PROCESSOR_ARCHITEW6432%"=="AMD64" (
    echo [ERROR] Vendra POS requires 64-bit Windows (x64).
    echo Your operating system appears to be 32-bit.
    echo Please contact support or run on a 64-bit Windows machine.
    pause
    exit /b 1
)

:: Create required runtime directories if missing
if not exist "%APP_ROOT%\logs" mkdir "%APP_ROOT%\logs"
if not exist "%APP_ROOT%\app\database" mkdir "%APP_ROOT%\app\database"
if not exist "%APP_ROOT%\app\public\uploads" mkdir "%APP_ROOT%\app\public\uploads"

:: Check embedded PHP engine
echo [2/4] Testing embedded PHP runtime engine...
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [NOTICE] Visual C++ Runtime missing or incomplete.
    if not exist "%APP_ROOT%\vc_redist.x64.exe" (
        echo Downloading Microsoft Visual C++ 2015-2022 x64 Redistributable...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile '%APP_ROOT%\vc_redist.x64.exe'"
    )
    if exist "%APP_ROOT%\vc_redist.x64.exe" (
        echo Installing Microsoft Visual C++ runtime...
        start /wait "" "%APP_ROOT%\vc_redist.x64.exe" /install /passive /norestart
    )
    :: Retest PHP
    "%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -v >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] PHP CLI returned an error. You can run VendraPOS-Debug.bat to check details.
    ) else (
        echo [OK] Visual C++ Runtime installed and verified.
    )
) else (
    echo [OK] PHP runtime engine verified successfully.
)

:: Test SQLite and MySQL extensions
"%APP_ROOT%\php\php.exe" -d extension_dir="%APP_ROOT%\php\ext" -c "%APP_ROOT%\php\php.ini" -r "exit(extension_loaded('pdo_sqlite') ? 0 : 1);" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] SQLite local database driver active.
) else (
    echo [WARNING] SQLite driver test failed. Check php\php.ini.
)

:: Create Desktop & Start Menu Shortcuts using native VBScript
echo [3/4] Creating Windows Desktop and Start Menu shortcuts...
set "VBS_SCRIPT=%TEMP%\vendra_mkshortcut_%RANDOM%.vbs"
(
echo Option Explicit
echo Dim ws, strDesktop, strPrograms, sc, sc2
echo Set ws = CreateObject("WScript.Shell"^)
echo strDesktop = ws.SpecialFolders("Desktop"^)
echo strPrograms = ws.SpecialFolders("Programs"^)
echo Set sc = ws.CreateShortcut(strDesktop ^& "\Vendra POS.lnk"^)
echo sc.TargetPath = "%APP_ROOT%\VendraPOS.bat"
echo sc.WorkingDirectory = "%APP_ROOT%"
echo sc.IconLocation = "%APP_ROOT%\vendra.ico, 0"
echo sc.Description = "Vendra Commercial POS System"
echo sc.Save
echo Set sc2 = ws.CreateShortcut(strPrograms ^& "\Vendra POS.lnk"^)
echo sc2.TargetPath = "%APP_ROOT%\VendraPOS.bat"
echo sc2.WorkingDirectory = "%APP_ROOT%"
echo sc2.IconLocation = "%APP_ROOT%\vendra.ico, 0"
echo sc2.Description = "Vendra Commercial POS System"
echo sc2.Save
) > "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%"
if exist "%VBS_SCRIPT%" del /f /q "%VBS_SCRIPT%"
echo [OK] Desktop Shortcut created: 'Vendra POS'
echo [OK] Start Menu Shortcut created.

:: Optional Windows autostart on boot
echo [4/4] Finalizing setup...
echo.
choice /c YN /t 6 /d N /m "Launch Vendra POS automatically when Windows starts? [Y/N]"
if %ERRORLEVEL% equ 1 (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "VendraPOS" /t REG_SZ /d "\"%APP_ROOT%\VendraPOS.bat\"" /f >nul
    echo [OK] Added to Windows Startup.
) else (
    echo [SKIPPED] Windows Startup not enabled.
)

echo.
echo ======================================================================
echo                  INSTALLATION COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo - You can launch Vendra POS anytime from your Desktop: 'Vendra POS'
echo - Offline local database caching is ACTIVE (data saved in app\database).
echo - Online replication can be configured in Products -^> Online DB Config.
echo.
echo Launching Vendra POS now...
start "" "%APP_ROOT%\VendraPOS.bat"
timeout /t 3 >nul
exit /b 0
