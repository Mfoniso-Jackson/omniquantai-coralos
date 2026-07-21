# omniquantai.com Deployment Plan

Milestone 2 is the public OmniQuantAI experience:

```text
visit -> understand -> start a market -> watch agents compete
```

The domain should not be a static brochure. It should be a public dashboard connected to a live testnet market API.

## Public Experience

Visitors should be able to:

- understand OmniQuantAI as a Financial Intelligence Network
- see the exact market thesis
- click **Start Market**
- watch the buyer broadcast a research request
- watch specialist agents bid
- see the winner selected
- read the investment committee memo
- see devnet settlement proof

## Deployment Architecture

```text
omniquantai.com
  -> static React dashboard
  -> VITE_API_BASE_URL
  -> marketplace API/feed
  -> CoralOS
  -> buyer/seller Docker agents
  -> Solana devnet
```

The frontend can be hosted on any static host. The market API needs Docker-capable infrastructure because it launches CoralOS and buyer/seller agents.

## Frontend Build

The repository includes a GitHub Pages workflow:

```text
.github/workflows/deploy-omniquantai-com.yml
```

It builds the React dashboard with the current free API host:

```ini
VITE_API_BASE_URL=https://omniquantai-private-api.onrender.com
```

and publishes `examples/marketplace/web/dist`.

For local verification:

```sh
cd examples/marketplace/web
VITE_API_BASE_URL=https://omniquantai-private-api.onrender.com npm run build
```

Output:

```text
examples/marketplace/web/dist
```

The frontend supports both variables:

- `VITE_API_BASE_URL` - preferred public deployment variable
- `VITE_FEED_URL` - backwards-compatible alias

If neither is set, the app uses same-origin `/api` routes, which is correct for local Vite proxy or a reverse-proxy deployment where `omniquantai.com/api` routes to the feed service.

## API Host

Run the feed service on a Docker-capable host:

```sh
cd examples/marketplace/feed
npm install
npm run build
npm start
```

Required runtime:

- Node 20+
- Docker daemon
- CoralOS reachable on port `5555`
- feed API reachable on port `4000`
- funded devnet buyer wallet
- `.env` created from `.env.testnet.example`

Required checks:

```sh
npm run health
npm run milestone:market
```

## Domain Routing

Recommended public shape:

- `omniquantai.com` -> frontend
- `api.omniquantai.com` -> marketplace API/feed

Current free posture:

- `omniquantai.com` -> GitHub Pages frontend
- `VITE_API_BASE_URL` -> `https://omniquantai-private-api.onrender.com`
- frontend readiness checks call `/api/ready`, so the public site stays in Public Proof Mode until the hosted API can reach CoralOS

The frontend ships with:

```text
examples/marketplace/web/public/CNAME
```

so the built artifact declares `omniquantai.com` for GitHub Pages.

Alternative:

- `omniquantai.com` -> frontend and reverse proxy
- `omniquantai.com/api/*` -> marketplace API/feed

DNS records depend on the chosen host. Do not point the domain at a static frontend unless Start Market can reach the API.

## Release Gate

Before changing DNS or announcing the domain:

```sh
npm run milestone:market
npm run testnet-check
```

Then verify from the public URL:

1. Open `https://omniquantai.com`.
2. Confirm the landing/dashboard explains the Financial Intelligence Network.
3. Click **Start Market**.
4. Confirm the URL updates with a session ID.
5. Confirm the dashboard reaches:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

6. Save session ID, memo output, screenshot, and Explorer links.

## Current Boundary

This milestone is still devnet/testnet only.

Do not enable:

```ini
ALLOW_MAINNET=1
SOLANA_NETWORK=mainnet
```

Mainnet remains a separate milestone behind `npm run mainnet-readiness` and external review.
