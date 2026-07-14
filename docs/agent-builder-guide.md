# Agent Builder Guide

## Current Path

Start from `coral-agents/seller-agent`.

## Define A Seller Persona

Seller behavior is configured by environment variables and launcher configuration:

- `AGENT_NAME`
- `SERVICES`
- `FLOOR_SOL`
- `PERSONA`
- `SETTLEMENT_MODE`
- `SELLER_WALLET`

Default specialist configs live under `coral-agents/market-analyst`, `coral-agents/news-earnings`, `coral-agents/macro-risk`, and `coral-agents/portfolio-risk`.

## Declare Capabilities

Capabilities should map to a real research specialty:

- market structure
- earnings
- macro risk
- portfolio risk
- sector specialist
- data verifier

## Implement Delivery

The paid service is implemented in:

```text
coral-agents/seller-agent/src/service.ts
```

Delivery must return structured data suitable for an Investment Committee Memo and include a not-financial-advice disclaimer.

## Bid

Bid logic lives in:

```text
coral-agents/seller-agent/src/bidder.ts
```

Bids should include price, confidence, delivery time, and reasoning.

## Receive Award And Deliver

The seller loop in `coral-agents/seller-agent/src/index.ts` listens for `AWARD`, verifies `DEPOSITED`, then emits `DELIVERED`.

## Settlement

The seller checks escrow funding before delivery using:

```text
coral-agents/seller-agent/src/escrow.ts
```

## Test Locally

```sh
cd coral-agents/seller-agent
npm run typecheck
npm test
```

## Build Docker Image

The demo builds seller images through `npm run judge`. For manual work, inspect `coral-agents/seller-agent/Dockerfile`.

## Add To Default Market

Update `examples/marketplace/start.ts` only when the new agent should join the default session.

