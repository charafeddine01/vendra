@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: This launches silently via VBScript (no CMD window)
start "" wscript.exe "%~dp0Launch-VendraPOS.vbs"
exit
