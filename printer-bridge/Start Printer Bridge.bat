@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Nail Times Printer Bridge

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this computer.
  echo Install the Node.js LTS version from https://nodejs.org/ and then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo First-time setup
  echo.
  set /p BRIDGE_TOKEN=Paste the PRINT_BRIDGE_TOKEN from Render: 
  if not defined BRIDGE_TOKEN (
    echo A token is required.
    pause
    exit /b 1
  )
  (
    echo BRIDGE_API_URL=https://nail-times-website-v2-1.onrender.com
    echo PRINT_BRIDGE_TOKEN=!BRIDGE_TOKEN!
    echo PRINTER_IP=10.0.0.101
    echo PRINTER_PORT=9100
    echo PRINTER_PAPER_WIDTH_MM=80
    echo PRINTER_CHARACTERS_PER_LINE=42
    echo PRINTER_AUTO_CUT=true
    echo PRINTER_TIMEOUT_MS=7000
    echo BRIDGE_POLL_INTERVAL_MS=3000
    echo BUSINESS_TIMEZONE=America/Chicago
  ) > ".env"
  echo.
  echo Setup saved.
)

echo Starting the Nail Times printer bridge...
echo Keep this window open while receipts should print.
echo.
node index.js

echo.
echo The printer bridge stopped or could not start. Review the message above.
pause
