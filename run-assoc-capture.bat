@echo off
echo Launching Process Monitor capture (you will get a UAC prompt - click Yes).
echo A small "Open with" dialog will flash on screen - that is intentional.
echo Wait about 15 seconds, then this is done. You can close any leftover dialog.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','C:\AI\Aperture\_diag\capture.ps1'"
echo Capture started in elevated window. When it closes, tell Claude it is done.
pause
