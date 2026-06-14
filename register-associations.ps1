# Registers Aperture as a file handler for images and videos.
# Run from the repo root OR from dist\win-unpacked.
# Re-run with -Unregister to remove associations.
#
# IMPORTANT: associations MUST target the REAL Electron exe in
# dist\win-unpacked\Aperture.exe — NOT the root forwarding stub. The root
# Aperture.exe just spawns the real app and exits immediately; Windows'
# "Open with" rejects an instantly-exiting process as a file handler and
# bounces back to the picker (it won't let you set it as default). Only the
# real, persistent Electron exe works as a handler. The root stub is for
# manually double-clicking to start the app, not for file associations.

param([switch]$Unregister)

# Prefer the real Electron exe; fall back to the local one if we're already
# running from inside dist\win-unpacked.
$real = Join-Path $PSScriptRoot "dist\win-unpacked\Aperture.exe"
$here = Join-Path $PSScriptRoot "Aperture.exe"
if (Test-Path $real) {
    $ExePath = $real
} elseif (Test-Path $here) {
    $ExePath = $here   # running from within dist\win-unpacked
} else {
    Write-Error "Real Aperture.exe not found. Build the app first (/ship-aperture)."
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

    # --- 4. Capabilities + RegisteredApplications ---
    # These make Aperture appear in Settings > Default Apps and in the
    # "Set defaults by app" list. Without them Windows never shows Aperture
    # as a named app even if the ProgId and UserChoice are both correct.
    $capPath = "HKCU:\Software\Aperture\Capabilities"
    New-Item -Path $capPath -Force | Out-Null
    Set-ItemProperty -Path $capPath -Name "ApplicationName"        -Value $AppName
    Set-ItemProperty -Path $capPath -Name "ApplicationDescription" -Value "Fast image and video viewer"
    Set-ItemProperty -Path $capPath -Name "ApplicationIcon"        -Value "`"$ExePath`",0"

    New-Item -Path "$capPath\FileAssociations" -Force | Out-Null
    foreach ($ext in $Extensions) {
        Set-ItemProperty -Path "$capPath\FileAssociations" -Name $ext -Value $ProgId
    }

    # RegisteredApplications: the single key that tells Windows "Aperture is an app"
    New-Item -Path "HKCU:\Software\RegisteredApplications" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\Software\RegisteredApplications" -Name $AppName -Value "Software\Aperture\Capabilities"

    Write-Host "Aperture registered as a file handler for images and videos."
    Write-Host "Aperture added to RegisteredApplications (will appear in Default Apps)."
    Write-Host ""
    Write-Host "To set Aperture as the DEFAULT for a type (Windows protects this"
    Write-Host "setting, so it must be confirmed in the UI once per type):"
    Write-Host "  Settings > Apps > Default apps > search 'Aperture', then assign types."
    Write-Host "  Or: right-click an image > Open with > Choose another app"
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
