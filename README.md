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

Run each service in its own terminal.

### 1) Web App (root)

```bash
npm start
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

## Common Git Workflow

```bash
git add .
git commit -m "Describe your change"
git push
```

## Notes

- Never commit secrets. Keep `server/.env` out of Git.
- Update `server/.env.example` when adding new required env vars.
