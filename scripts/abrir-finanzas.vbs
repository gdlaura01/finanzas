' Lo que ejecuta el icono «Finanzas»: abre la app sin enseñar ninguna ventana de terminal.
Set fso = CreateObject("Scripting.FileSystemObject")
raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = raiz
sh.Run "cmd /c npx --no-install tsx scripts\lanzador.ts", 0, False
