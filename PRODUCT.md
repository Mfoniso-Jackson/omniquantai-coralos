# Product Definition

## Current Wedge

Investment committee preparation for public-equity exposure decisions.

The default demo question is:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

## Primary Users

Current:

- builders, judges, and early evaluators
- independent researchers
- small funds and crypto funds testing agent workflows

Planned:

- boutique asset managers
- family offices
- quant developers
- institutional teams running private research markets

## Jobs To Be Done

- Prepare a structured research memo faster.
- Compare specialist views instead of relying on one model.
- See why an agent selected one seller over another.
- Verify delivery before payment.
- Preserve evidence for future reputation.

## User Journey

1. User opens the dashboard.
2. User starts a market session.
3. Buyer agent broadcasts `WANT`.
4. Seller agents submit `BID`.
5. Buyer selects best value.
6. Winner delivers an Investment Committee Memo.
7. Buyer verifies completeness.
8. Solana devnet escrow releases payment.
9. Dashboard shows settlement proof.

## Buyer Journey

The buyer agent optimizes for best value, not cheapest price. It considers relevance, confidence, expected quality, domain fit, price, delivery time, and reasoning quality.

## Seller Journey

Each seller declares a specialty, bids with price and confidence, waits for award, verifies escrow deposit, delivers the paid memo, then receives settlement after verification.

## MVP Scope

Current:

- four specialist seller agents
- CoralOS market coordination
- Solana devnet escrow
- structured memo delivery
- deterministic verification
- dashboard lifecycle view
- JSONL persistence snapshots

## Production v1 Scope

Planned:

- cleaner hosted demo environment
- stronger session observability
- richer persistence and reputation APIs
- documented deployment runbooks
- controlled design-partner workflow

## Deferred Features

- live trading
- mainnet settlement by default
- enterprise auth
- billing
- token launch
- Sui adapter
- complex portfolio management

## Product Principles

- Show the market before the plumbing.
- Settlement proof must be visible.
- Never hide whether data is live or fallback.
- No user should paste a session ID for the main demo flow.
- The memo is useful, but the market is the product.

## Success Metrics

Current:

- full lifecycle completion
- time to first visible `WANT`
- four seller bids received
- deposit and release proof surfaced
- demo can be understood in under three minutes

Future:

- repeat buyers
- seller supply
- verified deliveries
- reputation accuracy
- research outcome tracking

