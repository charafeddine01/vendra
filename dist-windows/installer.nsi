; Vendra Commercial POS - Modern Windows Installer Script
; Produces a single, self-contained, 1-click Windows Installer (.exe)

Unicode true
SetCompressor /SOLID lzma

!define PRODUCT_NAME "Vendra Commercial POS"
!define PRODUCT_VERSION "2.1.0"
!define PRODUCT_PUBLISHER "Vendra"
!define PRODUCT_WEB_SITE "https://vendra.charafeddine.xyz"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\VendraPOS.exe"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "VendraPOS/vendra.ico"
!define MUI_UNICON "VendraPOS/vendra.ico"

; Installer Pages
!define MUI_WELCOMEPAGE_TITLE "Welcome to Vendra Commercial POS Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install Vendra Commercial POS (Universal Retail & Solar Energy Showroom) on your computer.$\r$\n$\r$\n- Fully offline with local database caching.$\r$\n- Real-time replication to online shop database.$\r$\n- Runs silently in native desktop window without command prompt.$\r$\n- Automatically configures Microsoft Visual C++ Runtime and local server.$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME

!define MUI_DIRECTORYPAGE_TEXT_TOP "Vendra POS will be installed in the following folder. To install in a different folder, click Browse and select another folder."
!insertmacro MUI_PAGE_DIRECTORY

!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Launch Vendra Commercial POS now"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; Basic Installer Attributes
Name "${PRODUCT_NAME}"
OutFile "VendraPOS-Setup.exe"
InstallDir "C:\VendraPOS"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

Function .onInit
    ${IfNot} ${RunningX64}
        MessageBox MB_ICONSTOP "Vendra Commercial POS requires a 64-bit edition of Windows (x64)."
        Abort
    ${EndIf}

    ; Terminate any previous running instances before updating/installing
    ExecWait 'taskkill /F /IM php-win.exe /FI "WINDOWTITLE eq Vendra*"'
    ExecWait 'taskkill /F /IM php.exe /FI "WINDOWTITLE eq Vendra*"'
FunctionEnd

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; 1. Copy core distribution files (excluding existing sqlite database)
    File /r /x "omnipos.sqlite" /x "logs" "VendraPOS\*.*"

    ; 2. Ensure logs and runtime directories exist
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\php\logs"
    CreateDirectory "$INSTDIR\app\database"
    CreateDirectory "$INSTDIR\app\public\uploads"

    ; 3. Automatic Visual C++ 2015-2022 x64 Runtime Check & Installation
    ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
    ${If} $0 != 1
        DetailPrint "Installing Microsoft Visual C++ 2015-2022 x64 Redistributable..."
        ${If} ${FileExists} "$INSTDIR\vc_redist.x64.exe"
            ExecWait '"$INSTDIR\vc_redist.x64.exe" /install /passive /norestart' $1
            DetailPrint "Microsoft Visual C++ Runtime installed."
        ${EndIf}
    ${Else}
        DetailPrint "Microsoft Visual C++ 2015-2022 Runtime is already installed."
    ${EndIf}

    ; 4. Preserve existing database if user already has data; otherwise copy default solar showroom DB
    ${IfNot} ${FileExists} "$INSTDIR\app\database\omnipos.sqlite"
        File "/oname=$INSTDIR\app\database\omnipos.sqlite" "VendraPOS\app\database\omnipos.sqlite"
    ${EndIf}

    ; 5. Create Uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; 6. Create Shortcuts for All Users
    SetShellVarContext all
    CreateDirectory "$SMPROGRAMS\Vendra POS"
    CreateShortCut "$SMPROGRAMS\Vendra POS\Vendra POS.lnk" "$INSTDIR\VendraPOS.exe" "" "$INSTDIR\VendraPOS.exe" 0 SW_SHOWNORMAL "" "Vendra Commercial POS System"
    CreateShortCut "$SMPROGRAMS\Vendra POS\Stop Vendra POS.lnk" "$INSTDIR\Stop-VendraPOS.exe" "" "$INSTDIR\Stop-VendraPOS.exe" 0 SW_SHOWNORMAL "" "Stop Background Vendra Server"
    CreateShortCut "$SMPROGRAMS\Vendra POS\Vendra POS (Debug Console).lnk" "$INSTDIR\VendraPOS-Debug.bat" "" "$INSTDIR\vendra.ico" 0 SW_SHOWNORMAL "" "Vendra POS Diagnostic Console"
    CreateShortCut "$SMPROGRAMS\Vendra POS\Uninstall Vendra POS.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
    CreateShortCut "$DESKTOP\Vendra POS.lnk" "$INSTDIR\VendraPOS.exe" "" "$INSTDIR\VendraPOS.exe" 0 SW_SHOWNORMAL "" "Vendra Commercial POS System"

    ; Also ensure Desktop shortcut on Current User Desktop
    SetShellVarContext current
    CreateShortCut "$DESKTOP\Vendra POS.lnk" "$INSTDIR\VendraPOS.exe" "" "$INSTDIR\VendraPOS.exe" 0 SW_SHOWNORMAL "" "Vendra Commercial POS System"

    ; 7. Registry for Add/Remove Programs
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\VendraPOS.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\VendraPOS.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

Function LaunchApp
    ExecShell "" "$INSTDIR\VendraPOS.exe"
FunctionEnd

Section "Uninstall"
    ; Terminate running servers
    ExecWait '"$INSTDIR\Stop-VendraPOS.exe"'
    ExecWait 'taskkill /F /IM php.exe'

    ; Delete Shortcuts
    SetShellVarContext all
    Delete "$DESKTOP\Vendra POS.lnk"
    RMDir /r "$SMPROGRAMS\Vendra POS"

    SetShellVarContext current
    Delete "$DESKTOP\Vendra POS.lnk"

    ; Remove Registry entries
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

    ; Remove installed files
    RMDir /r "$INSTDIR\php"
    RMDir /r "$INSTDIR\app\dist"
    RMDir /r "$INSTDIR\app\api"
    RMDir /r "$INSTDIR\app\public"
    Delete "$INSTDIR\app\router.php"
    Delete "$INSTDIR\VendraPOS.exe"
    Delete "$INSTDIR\Stop-VendraPOS.exe"
    Delete "$INSTDIR\Launch-VendraPOS.vbs"
    Delete "$INSTDIR\VendraPOS.bat"
    Delete "$INSTDIR\VendraPOS-Debug.bat"
    Delete "$INSTDIR\Stop-VendraPOS.bat"
    Delete "$INSTDIR\Stop-VendraPOS-Clean.bat"
    Delete "$INSTDIR\Setup.bat"
    Delete "$INSTDIR\Install.bat"
    Delete "$INSTDIR\Install-Desktop-Shortcut.bat"
    Delete "$INSTDIR\vendra.ico"
    Delete "$INSTDIR\Uninstall.exe"
    Delete "$INSTDIR\vc_redist.x64.exe"

    RMDir "$INSTDIR\app\database"
    RMDir "$INSTDIR\app"
    RMDir "$INSTDIR\logs"
    RMDir "$INSTDIR"

    SetAutoClose true
SectionEnd
