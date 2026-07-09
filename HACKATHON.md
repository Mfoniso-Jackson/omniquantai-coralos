# OmniQuantAI Hackathon Guide

## One-Minute Setup

Use GitHub Codespaces for the cleanest judge experience.

1. Open the repository in Codespaces.
2. Wait for bootstrap to finish.
3. Open `WALLETS.txt`.
4. Fund the buyer wallet at [faucet.solana.com](https://faucet.solana.com).
5. Run:

```sh
npm run judge
```

## One Command

```sh
npm run judge
```

This runs bootstrap, health checks, CoralOS, the buyer agent, four seller agents, the marketplace API, and the React dashboard.

## Demo Flow

```text
Research Request
Agent Bids
Winner Selected
Escrow Deposited
Intelligence Delivered
Verified
Payment Released
```

The buyer asks whether a fund should increase exposure to Nvidia over the next 3-6 months. Specialist research agents bid. The buyer chooses best value. The winner delivers a structured financial intelligence memo. The verifier approves it. Solana escrow releases payment.

## Expected Output

The terminal prints:

```text
OmniQuantAI
Financial Intelligence Network
System Ready
Frontend URL: http://localhost:5173/?session=...
API URL: http://localhost:4000
Explorer URL: https://explorer.solana.com/?cluster=devnet
Agent status: buyer + four seller specialists launched through CoralOS
```

## Where Settlement Occurs

Settlement occurs on Solana devnet through the escrow flow used by the buyer agent. The dashboard shows deposit and release transaction links. Open those links in Solana Explorer with `cluster=devnet`.

## Token as Network Coordination

The hackathon MVP does not launch a token. It proves the core agent economy: specialist agents compete, deliver useful financial intelligence, and get paid on-chain.

OmniQuantAI is exploring a future OQ Token, or OmniQuant Network Token, as a participation and coordination layer for the Financial Intelligence Network. The token model is intended to support agent registration, reputation, governance, verification, developer incentives, and ecosystem growth. It is not designed as a promise of financial return.

Any future token is intended for network participation, governance, incentives, and protocol coordination. It does not represent equity, ownership, revenue share, investment returns, or financial rights. Nothing here should be interpreted as investment advice or a solicitation to purchase tokens.

For the full future-facing strategy, see [docs/token-strategy.md](docs/token-strategy.md).

## Where Agents Communicate

Agents communicate through CoralOS:

- `docker-compose.yml` starts the CoralOS server on port `5555`.
- `examples/marketplace/start.ts` creates the CoralOS session graph.
- `coral-agents/buyer-agent` broadcasts the research request and awards the winning bid.
- `coral-agents/seller-agent` powers each specialist seller persona.

## Explorer Links

During the demo, watch the dashboard settlement badges. They contain the devnet deposit and release transaction references. The base Explorer URL is:

[https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet)

## If Escrow Fails

The buyer wallet may not have enough devnet SOL.

1. Open `WALLETS.txt`.
2. Copy the `Buyer wallet` address.
3. Fund it with devnet SOL using [Solana Faucet](https://faucet.solana.com/).
4. Re-run:

```sh
npm run judge
```

The seller wallet does not need funding; it only receives payment after release.

## Judge FAQ

**Is this trading?**  
No. It is research support and not financial advice.

**Is settlement real?**  
Yes. The demo uses Solana devnet escrow.

**Is the research live market data?**
It can use live NVDA price/headline/fundamental data when provider access is configured. If a provider or API key is unavailable, the report falls back to deterministic demo data so judging remains reliable.

**Why CoralOS?**  
CoralOS coordinates independent buyer and seller agents in a machine-native service market.

**Why Solana?**  
Solana devnet provides fast, visible settlement proof for agent work.

**Is there a token in the MVP?**
No. The MVP uses Solana devnet escrow for settlement. The token strategy is a future coordination model, not part of the current hackathon settlement flow.
