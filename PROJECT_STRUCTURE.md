# Project Structure

## Root

| Path | Purpose |
| --- | --- |
| `README.md` | Main setup and project overview |
| `HACKATHON.md` | Judge-facing one-command guide |
| `DEMO.md` | Recording script and demo talking points |
| `SUBMISSION.md` | Submission narrative |
| `docker-compose.yml` | CoralOS server service |
| `.devcontainer/devcontainer.json` | GitHub Codespaces environment |
| `.env.example` | Safe environment template |

## Scripts

| Path | Purpose |
| --- | --- |
| `scripts/bootstrap.sh` | Installs dependencies, validates Docker, creates wallets |
| `scripts/healthcheck.sh` | Checks Docker, Node, npm, env, wallets, ports, balance |
| `scripts/check-balance.mjs` | Reads buyer wallet balance from Solana devnet |
| `scripts/demo-omniquant.js` | One-command judge demo launcher |
| `scripts/setup.js` | Generates `.env`, buyer/seller/arbiter wallets, and `WALLETS.txt` |
| `build-agents.sh` | Builds buyer and seller Docker images |

## Agents

| Path | Purpose |
| --- | --- |
| `coral-agents/buyer-agent` | Buyer agent, bid evaluation, escrow deposit/release, verification |
| `coral-agents/seller-agent` | Shared seller implementation and financial intelligence delivery |
| `coral-agents/market-analyst` | Market Analyst persona config |
| `coral-agents/news-earnings` | News & Earnings persona config |
| `coral-agents/macro-risk` | Macro Risk persona config |
| `coral-agents/portfolio-risk` | Portfolio Risk persona config |
| `coral-agents/broker` | Optional broker/reseller pattern, not required for MVP |

## Marketplace

| Path | Purpose |
| --- | --- |
| `examples/marketplace/start.ts` | Creates the CoralOS graph for buyer plus sellers |
| `examples/marketplace/feed` | Express API that folds CoralOS events into dashboard state |
| `examples/marketplace/web` | React dashboard and presentation mode |

## Runtime

| Path | Purpose |
| --- | --- |
| `packages/agent-runtime` | CoralOS client, market protocol helpers, LLM provider helpers, Solana helpers |

## Settlement

| Path | Purpose |
| --- | --- |
| `coral-agents/buyer-agent/src/escrow.ts` | Buyer-side escrow calls |
| `coral-agents/buyer-agent/src/arbiter.ts` | Arbiter release/refund wrapper |
| `coral-agents/seller-agent/src/payment.ts` | Seller settlement references |
| `examples/txodds/escrow` | Existing escrow/arbiter contracts used by the starter kit |

## Docs

| Path | Purpose |
| --- | --- |
| `docs/architecture.md` | Architecture notes |
| `docs/demo_script.md` | Three-minute spoken demo script |
| `docs/example_report.json` | Example delivered financial intelligence report |
| `docs/pitch_deck_outline.md` | Pitch deck outline |
