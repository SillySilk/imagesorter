# Registers Aperture as a file handler for images and videos.
# Run once from the same folder as Aperture.exe (root repo folder or
# dist\win-unpacked — both contain an Aperture.exe).
# Re-run with -Unregister to remove associations.

param([switch]$Unregister)

$ExePath = Join-Path $PSScriptRoot "Aperture.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "Aperture.exe not found at: $ExePath"
    Write-Host "Run this script from the same folder as Aperture.exe."
    pause; exit 1
}

$ProgId  = "ApertureImageSuite"
$AppName = "Aperture"
$ExeName = Split-Path $ExePath -Leaf   # "Aperture.exe"
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
    Remove-Item -Path "HKCU:\Software\Classes\Applications\$ExeName" -Recurse -ErrorAction SilentlyContinue
    Write-Host "Aperture file associations removed."
} else {
    # --- 1. ProgID: how files of type ApertureImageSuite open ---
    $classPath = "HKCU:\Software\Classes\$ProgId"
    New-Item -Path $classPath -Force | Out-Null
    Set-ItemProperty -Path $classPath -Name "(default)" -Value "Image/Video File"
    Set-ItemProperty -Path $classPath -Name "FriendlyTypeName" -Value "Image/Video File"

    New-Item -Path "$classPath\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$classPath\DefaultIcon" -Name "(default)" -Value "`"$ExePath`",0"

    New-Item -Path "$classPath\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$classPath\shell\open\command" -Name "(default)" -Value "`"$ExePath`" `"%1`""

    # --- 2. Application registration: makes Aperture show up by name in the
    #         Windows "Open with" dialog and lets users browse to the exe. ---
    $appPath = "HKCU:\Software\Classes\Applications\$ExeName"
    New-Item -Path $appPath -Force | Out-Null
    Set-ItemProperty -Path $appPath -Name "FriendlyAppName" -Value $AppName

    New-Item -Path "$appPath\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$appPath\DefaultIcon" -Name "(default)" -Value "`"$ExePath`",0"

    New-Item -Path "$appPath\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "$appPath\shell\open\command" -Name "(default)" -Value "`"$ExePath`" `"%1`""

    New-Item -Path "$appPath\SupportedTypes" -Force | Out-Null

    # --- 3. Hook up each extension ---
    foreach ($ext in $Extensions) {
        $extPath = "HKCU:\Software\Classes\$ext"
        New-Item -Path $extPath -Force | Out-Null
        Set-ItemProperty -Path $extPath -Name "(default)" -Value $ProgId

        # Offer Aperture in the per-extension "Open with" list
        $owPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithProgids"
        New-Item -Path $owPath -Force | Out-Null
        New-ItemProperty -Path $owPath -Name $ProgId -PropertyType Binary -Value ([byte[]]@()) -Force | Out-Null

        # Declare the extension as supported by the application
        Set-ItemProperty -Path "$appPath\SupportedTypes" -Name $ext -Value ""
    }

    Write-Host "Aperture registered as a file handler for images and videos."
    Write-Host ""
    Write-Host "To set Aperture as the DEFAULT for a type (Windows protects this"
    Write-Host "setting, so it must be confirmed in the UI once per type):"
    Write-Host "  Right-click an image > Open with > Choose another app"
    Write-Host "  > pick Aperture > check 'Always use this app' > OK."
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
