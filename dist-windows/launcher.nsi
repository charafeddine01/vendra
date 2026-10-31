; Vendra POS - Native Silent Windows Launcher (.exe)
; Compiles to a genuine Windows GUI PE executable with custom icon.
; Runs php.exe hidden in background and opens Edge in App Mode.

Unicode true
SilentInstall silent
OutFile "VendraPOS/VendraPOS.exe"
RequestExecutionLevel user
Icon "VendraPOS/vendra.ico"

Section
    ; 1. Check if PHP server on 127.0.0.1:8080 is already listening
    ; Launch PHP server completely hidden (SW_HIDE)
    ExecShell "" "$EXEDIR\php\php.exe" '-d extension_dir="$EXEDIR\php\ext" -c "$EXEDIR\php\php.ini" -S 127.0.0.1:8080 -t "$EXEDIR\app" "$EXEDIR\app\router.php"' SW_HIDE
    
    ; Wait 2.0 seconds for socket bind
    Sleep 2000
    
    ; 2. Try Edge in App Mode
    IfFileExists "$PROGRAMFILES\Microsoft\Edge\Application\msedge.exe" launch_edge64
    IfFileExists "$PROGRAMFILES(X86)\Microsoft\Edge\Application\msedge.exe" launch_edge32
    IfFileExists "$LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe" launch_edge_user
    
    ; Fallback to Chrome
    IfFileExists "$PROGRAMFILES\Google\Chrome\Application\chrome.exe" launch_chrome64
    IfFileExists "$PROGRAMFILES(X86)\Google\Chrome\Application\chrome.exe" launch_chrome32
    
    ; Fallback to default browser
    ExecShell "open" "http://127.0.0.1:8080"
    Quit

launch_edge64:
    ExecShell "" "$PROGRAMFILES\Microsoft\Edge\Application\msedge.exe" '--app="http://127.0.0.1:8080" --window-size=1280,900 --no-first-run --disable-default-browser-check'
    Quit

launch_edge32:
    ExecShell "" "$PROGRAMFILES(X86)\Microsoft\Edge\Application\msedge.exe" '--app="http://127.0.0.1:8080" --window-size=1280,900 --no-first-run --disable-default-browser-check'
    Quit

launch_edge_user:
    ExecShell "" "$LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe" '--app="http://127.0.0.1:8080" --window-size=1280,900 --no-first-run --disable-default-browser-check'
    Quit

launch_chrome64:
    ExecShell "" "$PROGRAMFILES\Google\Chrome\Application\chrome.exe" '--app="http://127.0.0.1:8080" --window-size=1280,900 --no-first-run --disable-default-browser-check'
    Quit

launch_chrome32:
    ExecShell "" "$PROGRAMFILES(X86)\Google\Chrome\Application\chrome.exe" '--app="http://127.0.0.1:8080" --window-size=1280,900 --no-first-run --disable-default-browser-check'
    Quit
SectionEnd
