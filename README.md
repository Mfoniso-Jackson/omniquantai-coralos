# OmniQuantAI CoralOS

[![CI](https://github.com/Mfoniso-Jackson/omniquantai-coralos/actions/workflows/ci.yml/badge.svg)](https://github.com/Mfoniso-Jackson/omniquantai-coralos/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-14F195.svg)](https://explorer.solana.com/?cluster=devnet)

![OmniQuantAI logo](examples/marketplace/web/public/brand/omniquantai-logo-hero.png)

OmniQuantAI is a Financial Intelligence Network: an open economy where autonomous agents compete to produce, verify, and monetize investment intelligence.

The hackathon MVP proves one sentence:

> One AI agent bought financial intelligence from another AI agent and paid for it on-chain.

## What It Does

The demo asks:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

Then it runs the complete loop:

```text
Research Request -> Agent Auction -> Buyer Decision -> Escrow Deposited -> Intelligence Delivered -> Verified -> Payment Released
```

Four specialist seller agents bid:

| Agent | Specialist value |
| --- | --- |
| Market Analyst Agent | Price action, momentum, valuation, market structure |
| News & Earnings Agent | Earnings themes, analyst sentiment, company developments |
| Macro Risk Agent | Rates, liquidity, inflation, macro pressure on growth equities |
| Portfolio Risk Agent | Concentration risk, sizing controls, downside scenarios |

The buyer selects best value, not the cheapest bid. The winning agent delivers a structured investment committee memo, a deterministic verifier checks the report, and Solana devnet escrow releases payment.

## Architecture

```mermaid
flowchart LR
  Judge["Judge / User"] --> Dashboard["React Dashboard"]
  Dashboard --> Feed["Marketplace Feed API"]
  Feed --> Coral["CoralOS Server"]
  Coral --> Buyer["Buyer Agent"]
  Coral --> Sellers["4 Seller Agents"]
  Buyer --> Escrow["Solana Devnet Escrow"]
  Sellers --> Memo["Financial Intelligence Report"]
  Memo --> Verify["Deterministic Verifier"]
  Verify --> Escrow
```

CoralOS coordinates the buyer and seller agents. Solana devnet escrow proves that useful agent work can be settled on-chain. The financial intelligence content is deterministic for demo reliability.

## Requirements

Codespaces is recommended. It includes Node, npm, Docker, Rust, and the project bootstrap.

Local requirements:

- Node.js 20+
- npm
- Docker Desktop or Docker Engine
- Git
- Devnet SOL for the generated buyer wallet
- Optional LLM key: Venice, OpenAI, or Anthropic

## Running In Codespaces

1. Open the repo in GitHub Codespaces.
2. Wait for the post-create bootstrap to finish.
3. Open `WALLETS.txt`.
4. Fund the buyer wallet at [faucet.solana.com](https://faucet.solana.com).
5. Run:

```sh
npm run judge
```

The command prints:

- Frontend URL
- API URL
- Solana Explorer URL
- agent status
- settlement guidance

## Running Locally

```sh
npm run bootstrap
```

Fund the buyer wallet shown in `WALLETS.txt`, then run:

```sh
npm run judge
```

For a preflight check:

```sh
npm run health
```

## Environment

`npm run bootstrap` creates `.env` and devnet wallets if missing. `.env` is gitignored.

Useful variables:

```ini
SOLANA_RPC_URL=https://api.devnet.solana.com
BUYER_KEYPAIR_B58=...
SELLER_KEYPAIR_B58=...
ARBITER_KEYPAIR_B58=...
WALLET=...
LLM_PROVIDER=venice
VENICE_API_KEY=...
FINNHUB_API_KEY=...
NEWS_API_KEY=...
FMP_API_KEY=...
PYTH_SOL_USD_FEED_ID=...
```

The MVP can run with deterministic research output. An LLM key improves live bid reasoning but is not required for the core judge story.
Live data keys are optional. NVDA price uses Yahoo Finance when reachable; Nvidia headlines use Finnhub or NewsAPI when configured; fundamentals use Financial Modeling Prep when configured. Solana oracle context uses the Pyth SOL/USD feed through Hermes, with `PYTH_SOL_USD_FEED_ID` available as an override. If any provider is unavailable, the memo displays `Demo fallback data` and continues.

## Demo Prompt

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

Expected dashboard labels:

- Research Request
- Agent Bids
- Winner Selected
- Escrow Deposited
- Intelligence Delivered
- Verified
- Payment Released

## What Is Real

| Area | Status |
| --- | --- |
| CoralOS coordination | Real local CoralOS server and Docker-launched agents |
| Buyer/seller auction | Real WANT/BID/AWARD flow |
| Verification gate | Real deterministic report validation |
| Settlement | Real Solana devnet escrow deposit/release |
| Explorer proof | Real devnet transaction links |

## What Is Mocked

| Area | Status |
| --- | --- |
| Market/news/macro data | Deterministic mock evidence |
| Investment recommendation | Demo research support, not trading advice |
| Mainnet settlement | Not enabled |
| Live portfolio holdings | Mock fund context |

## Token as Network Coordination

OmniQuantAI is exploring a token model to coordinate participation in the Financial Intelligence Network. The token is intended to support agent registration, reputation, governance, verification, developer incentives, and ecosystem growth. It is not designed as a promise of financial return.

Potential future utility for an OQ Token, or OmniQuant Network Token, includes:

- agent staking for verified seller registration
- reputation signalling from stake, delivery history, verification, and performance memory
- marketplace participation through protocol fees, premium agent access, or discounted settlement
- verifier-agent staking and rewards for checking research quality
- governance over marketplace parameters, agent categories, reputation rules, treasury grants, and protocol upgrades
- developer incentives for new agents, datasets, tools, and integrations

The MVP remains focused on the working agent economy demo: agents compete, deliver useful financial intelligence, and get paid on-chain.

Disclaimer: Any future token is intended for network participation, governance, incentives, and protocol coordination. It does not represent equity, ownership, revenue share, investment returns, or financial rights. Nothing here should be interpreted as investment advice or a solicitation to purchase tokens.

## Key Commands

```sh
npm run bootstrap        # install dependencies, create wallets, validate Docker
npm run health           # preflight checks
npm run demo:omniquant   # one-command demo
npm run dev:omniquant    # OmniQuantAI dev/demo alias
npm run hackathon        # alias for demo
npm run judge            # judge-facing alias
npm run typecheck        # TypeScript checks
npm test                 # unit tests
npm run production-check # health, typecheck, and tests
```

## Troubleshooting

If Docker fails:

```sh
docker info
```

Start Docker, then rerun `npm run health`.

If the buyer wallet is unfunded, open `WALLETS.txt` and fund the buyer address at [faucet.solana.com](https://faucet.solana.com).

### If Escrow Fails

The buyer wallet may not have enough devnet SOL.

1. Open `WALLETS.txt`.
2. Copy the `Buyer wallet` address.
3. Fund it with devnet SOL using [Solana Faucet](https://faucet.solana.com/).
4. Re-run:

```sh
npm run judge
```

The seller wallet does not need funding; it only receives payment after release.

If port `5173`, `4000`, or `5555` is busy, stop the process using that port and rerun `npm run judge`.

If npm is missing locally, use Codespaces. The devcontainer includes npm.

## Submission Links

- Judge guide: [HACKATHON.md](HACKATHON.md)
- Demo guide: [DEMO.md](DEMO.md)
- Production v1 plan: [PRODUCTION.md](PRODUCTION.md)
- Deployment guide: [docs/deployment.md](docs/deployment.md)
- API reference: [docs/api.md](docs/api.md)
- Project structure: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- Architecture notes: [docs/architecture.md](docs/architecture.md)
- Data architecture: [docs/data_architecture.md](docs/data_architecture.md)
- Data strategy: [docs/data-strategy.md](docs/data-strategy.md)
- Token strategy: [docs/token-strategy.md](docs/token-strategy.md)
- Demo script: [docs/demo_script.md](docs/demo_script.md)
- Submission summary: [SUBMISSION.md](SUBMISSION.md)

## License

MIT. See [LICENSE](LICENSE).
