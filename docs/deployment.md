# OmniQuantAI Deployment Guide

## Recommended v1 Deployment Model

OmniQuantAI has two deployment modes:

1. **Full demo environment**

   Runs CoralOS, Docker-launched buyer/seller agents, marketplace API, frontend, and Solana devnet settlement.

   Best for:

   - GitHub Codespaces
   - local Docker
   - VM-style hosts
   - judge demos

2. **Split public preview**

   Runs the frontend as a static app and points it at a separately hosted API/feed service.

   Best for:

   - Vercel or Netlify frontend
   - Render, Railway, or Fly API
   - read-only demos backed by fixture data or a controlled CoralOS host

## Local / Codespaces

```sh
npm run bootstrap
npm run health
npm run judge
```

`npm run judge` starts:

- CoralOS on port `5555`
- marketplace API/feed on port `4000`
- React dashboard on port `5173`
- buyer and seller agent Docker containers

In Codespaces, make port `5173` public or open the forwarded URL.

## Environment Variables

Required for the full devnet settlement demo:

```ini
SOLANA_RPC_URL=https://api.devnet.solana.com
BUYER_KEYPAIR_B58=...
SELLER_KEYPAIR_B58=...
ARBITER_KEYPAIR_B58=...
WALLET=...
```

Optional data and LLM providers:

```ini
VENICE_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
FINNHUB_API_KEY=...
NEWS_API_KEY=...
FMP_API_KEY=...
PYTH_SOL_USD_FEED_ID=...
```

Optional persistence:

```ini
OMNIQUANT_DATA_DIR=.omniquant-data
OMNIQUANT_PERSIST=1
```

Never expose wallet keys or API keys to the frontend.

## Frontend Deployment

The dashboard lives in `examples/marketplace/web`.

```sh
cd examples/marketplace/web
npm install
npm run build
```

For Vercel/Netlify:

- build command: `npm run build`
- output directory: `dist`
- configure API routing or `VITE_API_BASE_URL` to point at the API/feed service

The frontend works with:

- same-origin `/api` proxy in local dev
- Codespaces forwarded URLs
- explicit API base URL when deployed

## API Deployment

The API/feed lives in `examples/marketplace/feed`.

```sh
cd examples/marketplace/feed
npm install
npm run build
npm start
```

Production-like API routes:

- `GET /health`
- `POST /api/sessions/start`
- `GET /api/sessions/:id`
- `GET /api/feed?session=<id>`
- `GET /api/market/:id/status`

For a live agent demo, the API host must reach CoralOS and Docker-launched agents. If the host cannot run Docker or mount the Docker socket, use fixture mode for a public preview and keep the full demo in Codespaces.

## CoralOS And Docker

The full demo requires:

- Docker daemon
- CoralOS container
- agent images built from `coral-agents/buyer-agent` and `coral-agents/seller-agent`
- host callback networking configured by `scripts/demo-omniquant.js`

This is why Codespaces is the recommended v1 demo environment.

## Solana

Default network: devnet.

Fund the buyer wallet from `WALLETS.txt` using [faucet.solana.com](https://faucet.solana.com/).

Mainnet is not enabled by default and should not be enabled without product, legal, and operational review.

## Production Check

Before sharing a deployment:

```sh
npm run production-check
```

This runs health, typecheck, and tests without requiring production secrets.

## Known v1 Limitations

- File-backed persistence is suitable for demos and early design partners, not high-scale workloads.
- CoralOS Docker orchestration is easiest in local/Codespaces/VM environments.
- External data providers are optional and always fallback-safe.
- The app provides research infrastructure, not trading or financial advice.
