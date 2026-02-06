@echo off
REM Quick Build Script - Minimal output, fastest method
echo Building Rapid Image Culler...
python -m pip install --quiet --upgrade pyinstaller pillow
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
python -m PyInstaller --clean --noconfirm Rapid_Image_Culler.spec
if exist "dist\Rapid_Image_Culler.exe" (
    echo.
    echo SUCCESS: dist\Rapid_Image_Culler.exe
    echo.
    dir "dist\Rapid_Image_Culler.exe"
) else (
    echo FAILED - Check errors above
)
pause
