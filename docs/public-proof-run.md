# OmniQuantAI Public Proof Run

This proof run captures a complete OmniQuantAI market lifecycle on Solana devnet: a buyer requests NVDA investment research, four specialist agents bid, the buyer selects the best-value seller, the winning agent delivers an investment memo, verification passes, and payment is released on-chain.

## Run Summary

- Captured: 2026-07-16T15:56:02.429Z
- Session ID: `4964720d-d6d5-4737-97d9-5e643fd156c7`
- Namespace: `omniquant`
- Settlement mode: direct devnet escrow
- Buyer wallet: `95KuXMKPCRHcg33iseKi4rAvv51QEwAJ3aQYT4QTfRKp`
- Winning agent: `portfolio-risk`
- Recommendation: `HOLD`
- Memo confidence: `72`
- Verification: `PASS`, score `100`

## Lifecycle Evidence

The market completed the full product loop:

```text
WANT -> BID x4 -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

Evidence is stored under:

```text
evidence/2026-07-16-public-proof-direct/
```

Included metadata:

- `summary.md` - human-readable proof summary
- `dashboard.png` - dashboard screenshot from the proof run
- `feed.json` - frontend feed snapshot
- `research_requests.jsonl` - research request record
- `agent_bids.jsonl` - four seller bids
- `winners.jsonl` - selected winning agent
- `decision_records.jsonl` - buyer decision and delivered memo
- `settlements.jsonl` - devnet settlement records
- `agent_reputation.jsonl` - reputation update evidence
- `market_snapshots.jsonl` - saved market snapshot

## On-Chain Proof

- Deposit: https://explorer.solana.com/tx/27ZyJMrfz6eArcKJnUDamNzcDdxuVCxsEZP1vufVYQcm5WU5wcGwXAFZD7a3oL42iXDJ1zMyv2RNDmXMa9XZzs4r?cluster=devnet
- Release: https://explorer.solana.com/tx/265d6bKH2miwXQtEqkVNcVJQfyGDWj5wAxqrEr7yiSSyMdLDE7q4nhjh9XwiMgM1rPiz5eLXg82iH9jGmExALLn1?cluster=devnet

## Demo Video

The MP4 demo video is intentionally not committed to git. It is attached to the GitHub release:

```text
proof-2026-07-16
```

Local generated video path:

```text
evidence/2026-07-16-public-proof-direct/omniquantai-proof-demo.mp4
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

- Financial research data is deterministic demo data unless live providers are configured.
- Portfolio holdings are demo-context data.
- This run used direct devnet escrow for proof reliability.

## Note

An earlier arbiter-gated attempt reached deposit, delivery, and verification but failed release because the devnet arbiter program config expected a different arbiter key. This proof run uses direct devnet escrow to demonstrate the full buyer-to-seller payment lifecycle end to end.
