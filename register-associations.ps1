# Registers Aperture as a file handler for images and videos.
# Run once from the same folder as Aperture.exe.
# Re-run with -Unregister to remove associations.

param([switch]$Unregister)

$ExePath = Join-Path $PSScriptRoot "Aperture.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "Aperture.exe not found at: $ExePath"
    Write-Host "Run this script from the same folder as Aperture.exe."
    pause; exit 1
}

$ProgId = "ApertureImageSuite"
$Extensions = @(
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".tiff", ".tif", ".bmp", ".avif", ".heic", ".heif",
    ".mp4", ".webm", ".mov", ".avi", ".mkv"
)

if ($Unregister) {
    foreach ($ext in $Extensions) {
        $regPath = "HKCU:\Software\Classes\$ext"
        if (Test-Path $regPath) {
            $current = (Get-ItemProperty -Path $regPath -Name "(default)" -ErrorAction SilentlyContinue).'(default)'
            if ($current -eq $ProgId) { Remove-Item -Path $regPath -Recurse -ErrorAction SilentlyContinue }
        }
        $owPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithProgids"
        if (Test-Path $owPath) { Remove-ItemProperty -Path $owPath -Name $ProgId -ErrorAction SilentlyContinue }
    }
    Remove-Item -Path "HKCU:\Software\Classes\$ProgId" -Recurse -ErrorAction SilentlyContinue
    Write-Host "Aperture file associations removed."
} else {
    # Register ProgID
    $classPath = "HKCU:\Software\Classes\$ProgId"
    New-Item -Path $classPath -Force | Out-Null
    Set-ItemProperty -Path $classPath -Name "(default)" -Value "Image/Video File"

    New-Item -Path "$classPath\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$classPath\DefaultIcon" -Name "(default)" -Value "`"$ExePath`",0"

    New-Item -Path "$classPath\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$classPath\shell\open\command" -Name "(default)" -Value "`"$ExePath`" `"%1`""

    # Register each extension
    foreach ($ext in $Extensions) {
        $extPath = "HKCU:\Software\Classes\$ext"
        New-Item -Path $extPath -Force | Out-Null
        Set-ItemProperty -Path $extPath -Name "(default)" -Value $ProgId

        $owPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithProgids"
        New-Item -Path $owPath -Force | Out-Null
        New-ItemProperty -Path $owPath -Name $ProgId -PropertyType Binary -Value ([byte[]]@()) -Force | Out-Null
    }

    Write-Host "Aperture registered as a file handler for images and videos."
    Write-Host ""
    Write-Host "To set as default: right-click any image > Open with > Choose another app"
    Write-Host "  then select Aperture and check 'Always use this app'."
}

# Notify Windows shell of the registry change
$source = @"
using System;
using System.Runtime.InteropServices;
public class Shell32Notify {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
[Shell32Notify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
