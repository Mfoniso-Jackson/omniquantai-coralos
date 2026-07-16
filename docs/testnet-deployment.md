# OmniQuantAI Testnet Deployment Posture

This is the current release posture for OmniQuantAI: deploy and operate on Solana devnet/testnet only, preserve the full market lifecycle, and keep mainnet blocked until a separate readiness review passes.

## Release Objective

A testnet deployment is acceptable when a user can open the app, click **Start Market**, watch the agent market complete, read the investment committee memo, and see Solana devnet Explorer proof for deposit and release.

The protected lifecycle is:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

## Recommended Deployment Shape

### Current

Use a VM-style host or GitHub Codespaces for the full live demo:

- Docker daemon available
- CoralOS container available on port `5555`
- marketplace API/feed available on port `4000`
- dashboard available on port `5173`
- buyer/seller agents launched by the demo script
- `.env` stored only on the host

This is the highest-confidence deployment shape because the CoralOS and Docker agent graph matches local development.

### Public Preview

For a public web preview, deploy the frontend separately only if the API/feed is also reachable:

- frontend: `examples/marketplace/web`
- API/feed: `examples/marketplace/feed`
- set `VITE_API_BASE_URL` to the public API origin when not using same-origin proxy

If the host cannot run Docker/CoralOS, label the preview as fixture or read-only. Do not present fixture mode as live settlement.

## Environment Template

Start from:

```sh
cp .env.testnet.example .env
```

Then fill:

- `BUYER_KEYPAIR_B58`
- `SELLER_KEYPAIR_B58`
- `WALLET`
- `ARBITER_KEYPAIR_B58`
- optional provider keys

Keep:

```ini
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
ALLOW_MAINNET=
OMNIQUANT_PERSIST=1
```

Never expose these to the frontend:

- `BUYER_KEYPAIR_B58`
- `SELLER_KEYPAIR_B58`
- `ARBITER_KEYPAIR_B58`
- LLM/data API keys

## Pre-Deploy Gate

Run:

```sh
npm run bootstrap
npm run health
npm run milestone:market
npm run smoke:testnet
npm run testnet-check
```

Expected:

- `health` passes or shows only accepted warnings
- `milestone:market` passes the full Milestone 1 market-loop gate
- `smoke:testnet` passes the captured lifecycle and persistence check
- `testnet-check` confirms devnet/testnet settings
- buyer wallet has enough devnet SOL
- no secrets are committed

## Deployment Verification

After starting the deployment, verify:

```sh
curl http://localhost:4000/health
curl "http://localhost:4000/api/feed"
```

Then open the dashboard and start a fresh market.

Capture:

- session ID
- deposit Explorer link
- release Explorer link
- dashboard screenshot
- memo output
- feed snapshot
- market lifecycle evidence

Store proof metadata under:

```text
evidence/<date>-public-proof-<mode>/
```

Put large video assets in a GitHub release, not git history.

## Rollback Plan

If the live market fails:

1. Stop the current demo process.
2. Confirm Docker and CoralOS are healthy.
3. Confirm ports `4000`, `5173`, and `5555` are available.
4. Re-run `npm run health`.
5. Re-run `npm run judge`.
6. If Solana settlement fails, fund the buyer wallet and retry.

If the public preview is broken:

1. Revert frontend/API deployment to the last passing commit.
2. Keep the GitHub release proof link available.
3. Mark the deployment as preview unavailable until a fresh proof run passes.

## Mainnet Boundary

Mainnet is not part of this deployment posture.

Do not set:

```ini
ALLOW_MAINNET=1
SOLANA_NETWORK=mainnet
```

Run this before any future mainnet dry run:

```sh
npm run mainnet-readiness
```

Passing that check is only a configuration gate. It is not a production approval.

## Current Limitations

- Devnet/testnet only.
- No live trading.
- Not financial advice.
- File-backed persistence is suitable for early proof and design partners, not high-scale production.
- Live data providers are optional and fallback-safe.
- A full live deployment currently needs Docker-compatible infrastructure.
