# OmniQuantAI Public Proof Run

Captured: 2026-07-16T15:56:02.429Z
Session ID: 4964720d-d6d5-4737-97d9-5e643fd156c7
Namespace: omniquant
Settlement mode: direct devnet escrow
Buyer wallet: 95KuXMKPCRHcg33iseKi4rAvv51QEwAJ3aQYT4QTfRKp
Winning agent: portfolio-risk

## Explorer Links

Deposit: https://explorer.solana.com/tx/27ZyJMrfz6eArcKJnUDamNzcDdxuVCxsEZP1vufVYQcm5WU5wcGwXAFZD7a3oL42iXDJ1zMyv2RNDmXMa9XZzs4r?cluster=devnet
Release: https://explorer.solana.com/tx/265d6bKH2miwXQtEqkVNcVJQfyGDWj5wAxqrEr7yiSSyMdLDE7q4nhjh9XwiMgM1rPiz5eLXg82iH9jGmExALLn1?cluster=devnet

## Lifecycle Evidence

- WANT: true
- BID count: 4
- AWARD: true
- DEPOSITED: true
- DELIVERED: true
- VERIFIED: PASS score=100
- RELEASED: true

## Research Request

nvda-3-6m-exposure

## Memo Output

Recommendation: HOLD
Confidence: 72

Memo is stored in decision_records.jsonl under the memo field.

## Artifacts

- dashboard.png
- feed.json
- judge.log
- research_requests.jsonl
- agent_bids.jsonl
- winners.jsonl
- decision_records.jsonl
- settlements.jsonl
- agent_reputation.jsonl
- market_snapshots.jsonl

## Note

This run used direct devnet escrow for the release proof. An earlier arbiter-gated attempt reached deposit, delivery, and verification but failed release because the devnet arbiter program config expected a different arbiter key.
