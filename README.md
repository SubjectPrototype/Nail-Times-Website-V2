# Nail Times Website V2

Monorepo for the Nail Times project.

- Root app: React (Create React App) website
- `server/`: Express + MongoDB backend
- `mobile/`: Expo React Native app

## Project Structure

```text
nail-shop/
  mobile/    # Expo app
  server/    # Node/Express API
  src/       # React web app source
```

## Prerequisites

- Node.js 18+ (recommended)
- npm
- MongoDB connection string for the backend

## Setup

Install dependencies in each app:

```bash
# root web app
npm install

# backend
cd server && npm install

# mobile app
cd ../mobile && npm install
```

## Environment Variables (Backend)

1. In `server/`, copy `.env.example` to `.env`.
2. Fill in real values.

```bash
cd server
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

## Run Locally

Run the web app and backend together from the project root:

```bash
npm start
```

This starts the website at `http://localhost:3000` and the API at `http://localhost:4000`.

To run them separately, use the following commands in two terminals.

### 1) Web App (root)

```bash
npm run start:web
```

Default: `http://localhost:3000`

### 2) Backend (`server/`)

```bash
cd server
npm run dev
```

Default: `http://localhost:4000`

### 3) Mobile (`mobile/`)

```bash
cd mobile
npm start
```

Then choose iOS/Android/Web in Expo.

## Salon Receipt Printer Bridge

The hosted backend queues direct-print receipt jobs because it cannot connect to a private salon IP address. A small bridge process on a salon computer polls those jobs and forwards ESC/POS data to the Ethernet printer.

See `printer-bridge/README.md` for setup. After configuration, run:

```bash
npm run printer-bridge
```

The initial printer defaults are IP `10.0.0.101`, TCP port `9100`, and 80mm paper. Confirm the port and printer model before relying on direct printing in production.

## Common Git Workflow

```bash
git add .
git commit -m "Describe your change"
git push
```

## Notes

- Never commit secrets. Keep `server/.env` out of Git.
- Update `server/.env.example` when adding new required env vars.
