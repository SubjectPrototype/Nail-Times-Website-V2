# Nail Times Printer Bridge

This process runs on a Windows computer inside the salon network. It polls the hosted Nail Times API for receipt jobs and sends ESC/POS data to the Ethernet receipt printer.

## Setup

1. Copy `printer-bridge/.env.example` to `printer-bridge/.env`.
2. Set `BRIDGE_API_URL` to the deployed backend URL.
3. Generate a long random value for `PRINT_BRIDGE_TOKEN` and use the same value in the deployed backend environment.
4. Keep `PRINTER_IP=10.0.0.101` based on the GoCheckIn printer screen.
5. Start the bridge from the project root with `npm run printer-bridge`.

The initial defaults assume an 80mm ESC/POS printer on TCP port `9100`. Update the printer port, width, character count, and cutting setting after confirming the exact model.

## Network Test

Run this from the salon computer:

```powershell
Test-NetConnection 10.0.0.101 -Port 9100
```

`TcpTestSucceeded: True` confirms that the computer can reach the expected printer port.
