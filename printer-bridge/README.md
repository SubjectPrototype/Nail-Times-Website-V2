# Nail Times Printer Bridge

This process runs on a Windows computer inside the salon network. It polls the hosted Nail Times API for receipt jobs and sends ESC/POS data to the Ethernet receipt printer.

## Setup

1. Copy `printer-bridge/.env.example` to `printer-bridge/.env`.
2. Set `BRIDGE_API_URL` to the deployed backend URL.
3. Generate a long random value for `PRINT_BRIDGE_TOKEN` and use the same value in the deployed backend environment.
4. Keep `PRINTER_IP=10.0.0.101` and `PRINTER_PORT=9100` for the salon printer.
5. Start the bridge from the project root with `npm run printer-bridge`.

The confirmed printer is a GoCheckIn MHT-P80A with 80mm paper and an Ethernet connection on TCP port `9100`. The bridge sends standard ESC/POS receipt data directly to that socket.

## Network Test

Run this from the salon computer:

```powershell
Test-NetConnection 10.0.0.101 -Port 9100
```

`TcpTestSucceeded: True` confirms that the computer can reach the expected printer port.
