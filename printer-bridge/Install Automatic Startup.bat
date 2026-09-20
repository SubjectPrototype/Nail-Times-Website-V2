@echo off
setlocal
cd /d "%~dp0"
title Install Nail Times Printer Bridge

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this computer.
  echo Install the Node.js LTS version from https://nodejs.org/ and run this installer again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo The private printer configuration file is missing.
  echo Run Start Printer Bridge.bat once to configure it, then run this installer again.
  echo.
  pause
  exit /b 1
)

set "INSTALL_DIR=%LOCALAPPDATA%\NailTimesPrinterBridge"
set "STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Nail Times Printer Bridge.lnk"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /y "index.js" "%INSTALL_DIR%\index.js" >nul
copy /y ".env" "%INSTALL_DIR%\.env" >nul
copy /y "Start Printer Bridge.bat" "%INSTALL_DIR%\Start Printer Bridge.bat" >nul

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut('%STARTUP_LINK%'); $shortcut.TargetPath = '%INSTALL_DIR%\Start Printer Bridge.bat'; $shortcut.WorkingDirectory = '%INSTALL_DIR%'; $shortcut.WindowStyle = 7; $shortcut.Save()"
if errorlevel 1 (
  echo Automatic startup could not be installed.
  pause
  exit /b 1
)

start "" /min "%INSTALL_DIR%\Start Printer Bridge.bat"
echo.
echo Installation complete.
echo The bridge is running and will start automatically whenever this Windows user signs in.
echo Keep the installed files in %INSTALL_DIR%.
echo.
pause
