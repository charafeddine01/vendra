' Vendra Commercial POS - Silent Desktop Launcher (No CMD Window)
' Double-click to start server silently and open in app window
Option Explicit

Dim WshShell, fso, scriptDir
Dim edgePath, chromePath, phpExe, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Ensure logs folder exists
If Not fso.FolderExists(scriptDir & "\logs") Then
    fso.CreateFolder(scriptDir & "\logs")
End If

' Prefer php-win.exe (completely headless, no console) over php.exe
If fso.FileExists(scriptDir & "\php\php-win.exe") Then
    phpExe = scriptDir & "\php\php-win.exe"
ElseIf fso.FileExists(scriptDir & "\php\php.exe") Then
    phpExe = scriptDir & "\php\php.exe"
Else
    MsgBox "PHP engine not found! Please reinstall Vendra POS.", 16, "Vendra POS Error"
    WScript.Quit 1
End If

' Check if port 8080 is already responding
Dim http, isRunning
isRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.open "GET", "http://127.0.0.1:8080/api/index.php", False
http.setTimeouts 800, 800, 800, 800
http.send
If Err.Number = 0 Then isRunning = True
Err.Clear
On Error GoTo 0

' Start PHP server in background (window style 0 = hidden)
If Not isRunning Then
    cmd = """" & phpExe & """ -c """ & scriptDir & "\php\php.ini"" -S 127.0.0.1:8080 -t """ & scriptDir & "\app"" """ & scriptDir & "\app\router.php"""
    WshShell.Run cmd, 0, False
    WScript.Sleep 2000
End If

' Find Edge or Chrome for App Mode (borderless window)
edgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
If Not fso.FileExists(edgePath) Then
    edgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
End If

chromePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
If Not fso.FileExists(chromePath) Then
    chromePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
End If

' Launch browser in App Mode (no URL bar, looks like native app)
If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=""http://127.0.0.1:8080"" --window-size=1280,900 --no-first-run --disable-default-browser-check", 1, False
ElseIf fso.FileExists(chromePath) Then
    WshShell.Run """" & chromePath & """ --app=""http://127.0.0.1:8080"" --window-size=1280,900 --no-first-run --disable-default-browser-check", 1, False
Else
    WshShell.Run "http://127.0.0.1:8080", 1, False
End If

Set WshShell = Nothing
Set fso = Nothing
