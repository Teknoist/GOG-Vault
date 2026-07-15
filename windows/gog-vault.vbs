Set shell = CreateObject("WScript.Shell")
appDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = appDir
Set env = shell.Environment("PROCESS")
env("CONFIG_DIRECTORY") = shell.ExpandEnvironmentStrings("%APPDATA%") & "\GOG Vault"
env("DOWNLOAD_DIRECTORY") = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\Downloads\GOG Vault"
env("UI_DOWNLOAD_LABEL") = "Windows: " & env("DOWNLOAD_DIRECTORY")
If Not CreateObject("Scripting.FileSystemObject").FolderExists(env("CONFIG_DIRECTORY")) Then CreateObject("Scripting.FileSystemObject").CreateFolder env("CONFIG_DIRECTORY")
If Not CreateObject("Scripting.FileSystemObject").FolderExists(env("DOWNLOAD_DIRECTORY")) Then CreateObject("Scripting.FileSystemObject").CreateFolder env("DOWNLOAD_DIRECTORY")
shell.Run Chr(34) & appDir & "\php\php-win.exe" & Chr(34) & " " & Chr(34) & appDir & "\php-bin\ui.php" & Chr(34), 0, False
WScript.Sleep 1200
shell.Run "http://127.0.0.1:8787/", 1, False
