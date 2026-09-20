# Nail Times Printer Bridge

This process runs on a Windows computer inside the salon network. It polls the hosted Nail Times API for receipt jobs and sends ESC/POS data to the Ethernet receipt printer.

## Setup

1. Copy `printer-bridge/.env.example` to `printer-bridge/.env`.
2. Set `BRIDGE_API_URL` to the real deployed backend URL, such as `https://your-service.onrender.com` (not the website/frontend URL).
3. Generate a long random value for `PRINT_BRIDGE_TOKEN` and use the same value in the deployed backend environment.
4. Keep `PRINTER_IP=10.0.0.101` and `PRINTER_PORT=9100` for the salon printer.
5. Start the bridge from the project root with `npm run printer-bridge`.

Keep that terminal window open. A queued job only prints while this bridge process is running. A successful startup shows the backend URL followed by `10.0.0.101:9100`; configuration and polling errors appear in the same window.

The bridge checks for a job immediately on startup and every five seconds afterward. Set `BRIDGE_POLL_INTERVAL_MS=5000` in the installed `.env` and restart the bridge to apply this interval to an existing installation.

## Salon Computer Package

The salon computer does not need the full website project. Copy the packaged `salon-printer-bridge` folder to that computer, install Node.js LTS, and double-click `Start Printer Bridge.bat`. Keep its window open while direct printing is needed.

For automatic startup, use the private package that includes `.env`, extract it, and double-click `Install Automatic Startup.bat`. It installs the bridge under `%LOCALAPPDATA%\NailTimesPrinterBridge`, starts it minimized, and creates a shortcut in the current Windows user's Startup folder. Windows must sign in to that user before the bridge starts. Use `Remove Automatic Startup.bat` to disable future automatic launches.

The private package contains `PRINT_BRIDGE_TOKEN` and must be handled like a password. Do not upload it publicly or commit it to Git.

The confirmed printer is a GoCheckIn MHT-P80A with 80mm paper and an Ethernet connection on TCP port `9100`. The bridge sends standard ESC/POS receipt data directly to that socket.

## Updating an Installed Bridge

Close the running bridge window before updating. Extract the latest package, then copy its `index.js` into `%LOCALAPPDATA%\NailTimesPrinterBridge`, replacing the existing file. Keep the installed `.env` to preserve the salon's settings and token. Double-click `Start Printer Bridge.bat` in the installed folder to restart. The existing automatic startup shortcut still works.

Receipt headings use the printer's native center alignment without added leading spaces, including the enlarged NAIL TIMES heading. Updating the website alone does not update the installed bridge.

## Network Test

Run this from the salon computer:

```powershell
Test-NetConnection 10.0.0.101 -Port 9100
```

`TcpTestSucceeded: True` confirms that the computer can reach the expected printer port.
