# Deployment Guide

## Current Safe Deployment Posture

Current: devnet/testnet lane only.

Use public proof mode for `omniquantai.com` until `api.omniquantai.com` has a Docker-capable host.

## 1. Frontend On Vercel

Build:

```sh
npm install --prefix examples/marketplace/web
npm run build --prefix examples/marketplace/web
```

Environment:

```ini
VITE_API_BASE_URL=https://api.omniquantai.com
```

Output:

```text
examples/marketplace/web/dist
```

## 2. API On Railway

Service name:

```text
omniquant-api
```

Dockerfile:

```text
infrastructure/docker/api.Dockerfile
```

Health check:

```text
/ready
```

Minimum required variables:

```ini
PORT=4000
NODE_ENV=production
CORAL_SERVER_URL=
CORAL_TOKEN=
CORAL_NAMESPACE=omniquant
SOLANA_RPC_URL=https://api.devnet.solana.com
OMNIQUANT_PERSIST=1
```

## 3. Worker On Railway

Service name:

```text
omniquant-worker
```

The worker consumes Redis-backed `start_market` jobs created by `POST /v1/markets`. Keep
`POST /api/start` available for local/Codespaces demo mode only.

Required variables:

```ini
REDIS_URL=
CORAL_SERVER_URL=
CORAL_TOKEN=
CORAL_NAMESPACE=omniquant
OMNIQUANT_PERSIST=1
OMNIQUANT_DATA_DIR=.omniquant-data
START_MARKET_QUEUE=omniquant:start_market
START_MARKET_DEAD_LETTER_QUEUE=omniquant:start_market:dead-letter
START_MARKET_MAX_ATTEMPTS=3
START_MARKET_RETRY_BACKOFF_MS=5000
```

Future persistence/bridge variables:

```ini
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CORAL_BRIDGE_URL=
```

Run command:

```sh
npm run worker --prefix examples/marketplace/feed
```

## 4. CoralOS Bridge

Service name:

```text
omniquant-coral-bridge
```

The bridge must run in a Docker-capable environment with access to the CoralOS runtime and agent
containers. Do not place it in Vercel.

## Deployment Gate

Every deploy should pass:

```sh
npm run typecheck
npm test
npm run smoke:testnet
npm run testnet-check
```

Production promotion requires a fresh proof run with session ID, Explorer links, screenshot, memo output,
and lifecycle evidence.
