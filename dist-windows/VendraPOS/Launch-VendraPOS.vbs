' Vendra Commercial POS - Silent Desktop Launcher (No CMD Window)
Option Explicit

Dim WshShell, fso, scriptDir
Dim edgePath, chromePath, bravePath, phpExe, cmd
Dim http, isRunning, attempts

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Ensure logs and app folders exist
If Not fso.FolderExists(scriptDir & "\logs") Then
    fso.CreateFolder(scriptDir & "\logs")
End If

' Select PHP executable (prefer php-win.exe, fallback to php.exe)
If fso.FileExists(scriptDir & "\php\php-win.exe") Then
    phpExe = scriptDir & "\php\php-win.exe"
ElseIf fso.FileExists(scriptDir & "\php\php.exe") Then
    phpExe = scriptDir & "\php\php.exe"
Else
    MsgBox "PHP engine not found in: " & scriptDir & "\php" & vbCrLf & "Please run Setup.bat to configure Vendra POS.", 16, "Vendra POS Error"
    WScript.Quit 1
End If

' 1. Check if server on port 8080 is already responding
isRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.open "GET", "http://127.0.0.1:8080/api/index.php", False
http.setTimeouts 600, 600, 600, 600
http.send
If Err.Number = 0 Then isRunning = True
Err.Clear
On Error GoTo 0

' 2. If not running, start background PHP server with explicit extension_dir and php.ini
If Not isRunning Then
    cmd = """" & phpExe & """ -d extension_dir=""" & scriptDir & "\php\ext"" -c """ & scriptDir & "\php\php.ini"" -S 127.0.0.1:8080 -t """ & scriptDir & "\app"" """ & scriptDir & "\app\router.php"""
    WshShell.Run cmd, 0, False

    ' Wait up to 6 seconds for server to start responding
    For attempts = 1 To 15
        WScript.Sleep 400
        On Error Resume Next
        Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
        http.open "GET", "http://127.0.0.1:8080/api/index.php", False
        http.setTimeouts 500, 500, 500, 500
        http.send
        If Err.Number = 0 Then
            isRunning = True
            Exit For
        End If
        Err.Clear
        On Error GoTo 0
    Next
End If

' 3. Find Edge, Chrome, or Brave for native borderless App Mode window
edgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
If Not fso.FileExists(edgePath) Then edgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
If Not fso.FileExists(edgePath) Then edgePath = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Microsoft\Edge\Application\msedge.exe")

chromePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
If Not fso.FileExists(chromePath) Then chromePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
If Not fso.FileExists(chromePath) Then chromePath = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")

bravePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe")
If Not fso.FileExists(bravePath) Then bravePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe")
If Not fso.FileExists(bravePath) Then bravePath = WshShell.ExpandEnvironmentStrings("%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe")

' 4. Launch window in App Mode
If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=""http://127.0.0.1:8080"" --window-size=1280,900 --no-first-run --disable-default-browser-check", 1, False
ElseIf fso.FileExists(chromePath) Then
    WshShell.Run """" & chromePath & """ --app=""http://127.0.0.1:8080"" --window-size=1280,900 --no-first-run --disable-default-browser-check", 1, False
ElseIf fso.FileExists(bravePath) Then
    WshShell.Run """" & bravePath & """ --app=""http://127.0.0.1:8080"" --window-size=1280,900 --no-first-run --disable-default-browser-check", 1, False
Else
    WshShell.Run "http://127.0.0.1:8080", 1, False
End If

Set WshShell = Nothing
Set fso = Nothing
