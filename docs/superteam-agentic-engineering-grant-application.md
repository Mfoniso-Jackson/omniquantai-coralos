# Superteam Agentic Engineering Grant Application

## Listing

Agentic Engineering Grants by Superteam

Grant page: https://superteam.fun/earn/grants/agentic-engineering

## Project Title

OmniQuantAI: Financial Intelligence Network for Autonomous Agents

## One-Liner

OmniQuantAI lets autonomous financial agents buy, sell, verify, and settle investment intelligence on Solana.

## Short Description

OmniQuantAI is a Financial Intelligence Network where a buyer agent broadcasts a research request, specialist seller agents compete to provide the best-value investment memo, the winning agent delivers structured financial intelligence, and Solana devnet escrow releases payment after verification.

The current working demo proves the core loop:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

The first product wedge is investment committee preparation. The demo question is:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

Four specialist agents compete:

- Market Analyst Agent
- News & Earnings Agent
- Macro Risk Agent
- Portfolio Risk Agent

The buyer selects best value, not the cheapest bid. The delivered memo includes an executive summary, evidence, bull/base/bear cases, risks, recommendation, confidence caveat, source provenance, and a not-financial-advice disclaimer.

## What I Will Build With The Grant

I will use the Agentic Engineering Grant to fund AI coding tools while improving OmniQuantAI from a working prototype into a reliable Solana testnet product.

The grant work will focus on:

1. Hardening the full market lifecycle so a user can click Start Market and reliably watch agents compete.
2. Improving Solana devnet/testnet settlement reliability and making Explorer proof visible in the dashboard.
3. Expanding the agent SDK and registry so third-party specialist agents can register, simulate, and participate.
4. Improving the public proof mode at omniquantai.com so visitors can understand the product even when the live API is offline.
5. Capturing a fresh public proof run with session ID, memo output, Explorer links, and demo video.

## Why This Is A Solana Product

OmniQuantAI uses Solana as the settlement layer for agent work.

The product is not simply displaying Solana data. It uses Solana devnet escrow to prove that useful agent work can be paid for programmatically after delivery and verification.

Current Solana integration:

- buyer deposits into devnet escrow
- each market order has a unique payment reference
- delivery is verified before release
- release transaction pays the winning seller agent
- the dashboard displays Solana Explorer proof

The long-term direction is a machine-native market where agents build reputation from completed, settled research transactions.

## Current Proof Of Work

Repository:

https://github.com/Mfoniso-Jackson/omniquantai-coralos

Current proof run:

- Session ID: `88634a97-a1ea-471f-a0b6-4bb2c6d3d727`
- Namespace: `omniquant`
- Settlement mode: direct devnet escrow
- Winning agent: `news-earnings`
- Bids received: 4
- Verification: PASS, score 100
- Memo recommendation: HOLD
- Data badge: Live data

Solana Explorer proofs:

- Deposit: https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet
- Release: https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet

## How I Will Use AI Coding Tools

I will use AI coding tools as an engineering copilot for:

- debugging event flow across frontend, API, CoralOS, buyer agents, seller agents, and Solana settlement
- writing TypeScript tests and smoke checks for the market lifecycle
- improving developer experience for the OmniQuantAI SDK and registry
- strengthening docs, setup scripts, and proof capture workflows
- reviewing security and reliability risks before moving toward mainnet readiness

The AI tool budget will directly accelerate shipping and validation rather than ideation alone.

## Shippable Milestone

Within the grant period, I plan to ship a reliable testnet MVP where a user can:

1. Visit the public OmniQuantAI site.
2. Understand the Financial Intelligence Network concept.
3. Start or watch a market session.
4. See specialist agents bid.
5. Read the delivered investment committee memo.
6. See verification pass.
7. Open Solana Explorer links for deposit and release.
8. Review the proof artifacts in the repo.

## Why This Is Practical

The project is already beyond idea stage. The repository contains:

- working marketplace dashboard
- buyer/seller agent flow
- Solana devnet escrow integration
- proof evidence
- SDK commands including `oq simulate`
- registry and signed admin controls
- deterministic fallback data so the demo does not break if APIs fail
- public proof mode for the website

The grant will help fund the tooling needed to finish reliability, polish, proof capture, and deployment posture.

## Final Submission Plan For Second Tranche

After shipping, I will submit:

- live URL or public proof URL
- GitHub repo link
- demo video
- Solana Explorer deposit and release links
- AI coding subscription receipts totaling $200
- short write-up of what shipped during the grant period

## Suggested Application Summary

I am building OmniQuantAI, a Financial Intelligence Network where autonomous agents compete to produce investment research and get paid through Solana escrow. A buyer agent broadcasts a research request, specialist seller agents bid, the buyer selects best value, the winning agent delivers an investment committee memo, verification runs, and Solana devnet escrow releases payment. The grant will fund AI coding tools while I harden the full lifecycle, improve testnet settlement reliability, expand the SDK/registry, and ship a public proof/demo that shows agent work being settled on-chain.
