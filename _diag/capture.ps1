$d  = 'C:\AI\Aperture\_diag'
$pm = "$d\Procmon64.exe"
$pml= "$d\trace.pml"
$csv= "$d\trace.csv"
$png= 'C:\AI\Images\Gemini_Generated_Image_yf25bjyf25bjyf25.png'
Remove-Item $pml,$csv,"$d\capture_status.txt" -ErrorAction SilentlyContinue
Start-Process $pm -ArgumentList "/AcceptEula","/Quiet","/Minimized","/BackingFile","`"$pml`""
Start-Sleep -Seconds 4
# Autonomous trigger of the modern Open With dialog
Start-Process rundll32.exe -ArgumentList "shell32.dll,OpenAs_RunDLL `"$png`""
# Window stays open ~16s so a manually-opened Open With dialog is also captured
Start-Sleep -Seconds 16
Start-Process $pm -ArgumentList "/Terminate" -Wait
Start-Sleep -Seconds 2
Start-Process $pm -ArgumentList "/OpenLog","`"$pml`"","/SaveAs","`"$csv`"" -Wait
"DONE pml=$([math]::Round((Get-Item $pml -ErrorAction SilentlyContinue).Length/1MB,1))MB csv=$([math]::Round((Get-Item $csv -ErrorAction SilentlyContinue).Length/1MB,1))MB" | Out-File "$d\capture_status.txt"
