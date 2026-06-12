// Root launcher stub. Compiled to Aperture.exe in the repo root so the app can
// be started from C:\AI\Aperture directly. The real Electron exe must stay in
// dist\win-unpacked\ beside its DLLs and resources, so this just forwards to it.
//
// Rebuild (only needed if this file changes):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe
//     /win32icon:resources\icon.ico /out:Aperture.exe launcher.cs

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

class Launcher
{
    [STAThread]
    static void Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string exe = Path.Combine(root, @"dist\win-unpacked\Aperture.exe");
        if (!File.Exists(exe))
        {
            MessageBox.Show("Aperture.exe not found at:\n" + exe +
                "\n\nRun /ship-aperture to build and package the app.",
                "Aperture launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var sb = new StringBuilder();
        foreach (string a in args)
            sb.Append('"').Append(a.Replace("\"", "\\\"")).Append("\" ");

        Process.Start(new ProcessStartInfo
        {
            FileName = exe,
            Arguments = sb.ToString().TrimEnd(),
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(exe)
        });
    }
}
