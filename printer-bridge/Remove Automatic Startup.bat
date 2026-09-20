@echo off
setlocal
title Remove Nail Times Printer Bridge Startup
set "STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Nail Times Printer Bridge.lnk"

if exist "%STARTUP_LINK%" del /q "%STARTUP_LINK%"

echo Automatic startup has been removed.
echo The installed bridge files remain in %LOCALAPPDATA%\NailTimesPrinterBridge.
echo Close its command window if the bridge is currently running.
echo.
pause
