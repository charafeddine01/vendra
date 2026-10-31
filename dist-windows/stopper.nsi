; Vendra POS - Native Stopper (.exe)
Unicode true
SilentInstall silent
OutFile "VendraPOS/Stop-VendraPOS.exe"
RequestExecutionLevel user
Icon "VendraPOS/vendra.ico"

Section
    ExecWait 'taskkill /F /IM php.exe'
    ExecWait 'taskkill /F /IM php-win.exe'
SectionEnd
