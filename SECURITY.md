# Security Policy

## Scope

Security covers wallet keys, provider API keys, CoralOS session access, marketplace messages, settlement, persistence, and frontend/backend trust boundaries.

## Reporting Security Problems

Do not create a public GitHub issue for security problems. Use GitHub private vulnerability reporting for the repository, or contact the maintainers directly if private reporting is unavailable.

Include:

- affected component
- reproduction steps
- expected impact
- logs or transaction links if safe to share
- whether any key material or funds were exposed

## Secrets

- `.env` is gitignored and must stay local.
- `BUYER_KEYPAIR_B58`, `SELLER_KEYPAIR_B58`, and `ARBITER_KEYPAIR_B58` must never reach frontend code.
- Provider API keys must be read server-side only.
- Do not paste private keys into issues, pull requests, screenshots, or demo decks.

## Wallet Keys

Current demo wallets are for Solana devnet. They are not mainnet custody infrastructure.

Mainnet requires:

- dedicated key custody
- capped order sizes
- operational runbook
- incident response plan
- legal and security review

## Trust Boundaries

- Frontend calls the feed API.
- Feed API talks to CoralOS.
- Buyer and seller agents sign settlement transactions.
- Frontend must display proofs, not sign transactions.

## Threat Model

Agent threats:

- prompt injection
- fake evidence
- collusion
- overconfident claims

Settlement threats:

- wrong seller payout
- reused reference
- unfunded escrow
- premature release
- mainnet misconfiguration

Data threats:

- stale provider data
- unlabeled fallback data
- private portfolio leakage
- misleading timestamps

## Controls

- devnet guard for settlement paths
- payout wallet matching
- deterministic verification before release
- explicit `Live data` versus `Demo fallback data`
- no hardcoded Codespaces URLs
- no financial-advice claims
