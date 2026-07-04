# OmniQuantAI CoralOS Hackathon Submission

## One-Line Pitch

OmniQuantAI is a CoralOS-powered marketplace where specialist financial research agents compete to sell investment intelligence, with the winner paid through Solana devnet escrow.

## Problem

Investment research is fragmented across market data, earnings commentary, macro context, and portfolio risk. Fund managers need decision-ready synthesis, but most AI research tools act like a single assistant instead of a competitive market of specialized services.

## Solution

OmniQuantAI creates a paid agent marketplace for financial intelligence. A buyer agent broadcasts a research request, specialist seller agents bid, the buyer selects best value, the winning seller delivers an investment committee memo, a verifier checks it, and Solana escrow releases payment after verification.

## Demo Request

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

Market wire format:

```text
WANT service=omniquant arg=nvda-3-6m-exposure
```

## Agents

| Agent | Role |
| --- | --- |
| Market Analyst | price action, momentum, valuation, market structure |
| News & Earnings | news, earnings themes, analyst sentiment, company developments |
| Macro Risk | rates, inflation, liquidity, macro risk |
| Portfolio Risk | concentration risk, sizing controls, drawdown cases |

## How CoralOS Is Used

CoralOS coordinates the multi-agent session. The buyer and sellers communicate through the existing market thread using the starter kit's WANT, BID, AWARD, ESCROW_REQUIRED, DEPOSITED, DELIVERED, VERIFIED, and RELEASED messages.

## How Solana Is Used

The project preserves the starter kit's arbiter-gated Solana devnet escrow. After the buyer awards a seller, funds are deposited into escrow. The seller verifies escrow before delivery. After delivery, a deterministic verification gate checks the report. The arbiter releases payment to the winning seller only after verification passes. The dashboard links deposit and release transactions to Solana Explorer.

## Judging Highlights

- Converts a single AI assistant into a competitive agent market.
- Seller agents earn for useful research rather than generating free output.
- Delivered work is packaged as an institutional investment committee memo.
- Buyer selects best value, not cheapest price.
- Verification happens before payment release.
- Settlement is visible on Solana devnet.
- CoralOS session thread is the coordination layer for request, bid, award, delivery, and release messages.
- Demo is deterministic enough for reliable judging while preserving the live agent/payment flow.
- Human approval and no-trading guardrails are explicit.

## What Is Built

- OmniQuantAI `omniquant` seller service.
- Investment committee memo delivery format.
- Four financial seller personas.
- Value-scored buyer selection.
- React dashboard labeling, scorecards, verification, and memo panel.
- Demo script and architecture docs.
- Example output report.
- README hackathon quickstart.

## What Is Mocked

The financial evidence is deterministic mock research for demo reliability. Production would connect market data, filings, news, macro data, and portfolio holdings.

## Safety

OmniQuantAI is research support only. It does not execute trades, does not provide personalized financial advice, and requires human approval before any allocation decision.

## Run

One-command judge demo:

```sh
npm run demo:omniquant
```

Manual run:

```sh
npm run setup
docker compose up -d coral
bash build-agents.sh
npm run marketplace
npm run marketplace:web
```

## Repository

https://github.com/Mfoniso-Jackson/omniquantai-coralos

## Required Submission Assets

- Repo link: ready.
- Pitch deck: draft from `docs/pitch_deck_outline.md`.
- Demo video: record after a successful local run.
- Explorer links: copy from the settled devnet deposit/release transactions.
- Team names: add in the submission form.
