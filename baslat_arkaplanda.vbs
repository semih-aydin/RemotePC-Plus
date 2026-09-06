' RemotePC+ Arka Planda Sessiz Baslatici
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c node server.js", 0, False
WScript.Sleep 1500
WshShell.Run "http://localhost:5000/admin"
