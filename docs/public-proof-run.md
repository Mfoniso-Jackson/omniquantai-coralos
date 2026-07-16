# OmniQuantAI Public Proof Run

This proof run captures a complete OmniQuantAI market lifecycle on Solana devnet: a buyer requests NVDA investment research, four specialist agents bid, the buyer selects the best-value seller, the winning agent delivers an investment memo with provider provenance, verification passes, and payment is released on-chain.

## Run Summary

- Captured: 2026-07-16T20:50:12.427Z
- Session ID: `88634a97-a1ea-471f-a0b6-4bb2c6d3d727`
- Namespace: `omniquant`
- Settlement mode: direct devnet escrow
- Buyer wallet: `95KuXMKPCRHcg33iseKi4rAvv51QEwAJ3aQYT4QTfRKp`
- Winning agent: `news-earnings`
- Recommendation: `HOLD`
- Memo confidence: `72`
- Verification: `PASS`, score `100`
- Data badge: `Live data`
- Source count: `7`
- Provider observation count: `7`

## Lifecycle Evidence

The market completed the full product loop:

```text
WANT -> BID x4 -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

Evidence is stored under:

```text
evidence/2026-07-16-data-provenance-proof/
```

Included metadata:

- `summary.md` - human-readable proof summary
- `dashboard.png` - dashboard screenshot from the proof run
- `feed.json` - frontend feed snapshot
- `explorer-links.json` - deposit/release Explorer URLs

The delivered memo includes `provider_observability` with provider, capability, mode, latency, cache-hit state, success, and fallback usage.

## On-Chain Proof

- Deposit: https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet
- Release: https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet

## Demo Video

The MP4 demo video is intentionally not committed to git. It is attached to the GitHub release:

```text
proof-2026-07-16
```

Release asset:

```text
omniquantai-data-provenance-proof.webm
```

## What Is Real vs. Mocked

Real:

- Market lifecycle orchestration
- Four seller bids
- Buyer scoring and winner selection
- Delivered investment committee memo
- Verification pass
- Solana devnet deposit and release transactions
- Explorer links
- Session persistence metadata
- Agent reputation update record

Mocked or demo-scoped:

- Financial research data can mix live providers and deterministic fallback. This run used live Yahoo Finance price and live Pyth SOL/USD oracle context, with deterministic fallback where keys were unavailable.
- Portfolio holdings are demo-context data.
- This run used direct devnet escrow for proof reliability.

## Note

An earlier arbiter-gated attempt reached deposit, delivery, and verification but failed release because the devnet arbiter program config expected a different arbiter key. This proof run uses direct devnet escrow to demonstrate the full buyer-to-seller payment lifecycle end to end.
