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

The worker boundary exists, but BullMQ consumption is the next implementation slice.

Required future variables:

```ini
REDIS_URL=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CORAL_BRIDGE_URL=
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
