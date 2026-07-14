# Data Strategy

## Thesis

Market data is a commodity. The proprietary moat is the Financial Intelligence Graph.

## Current MVP Persistence

Current persistence is JSONL-based and produced by the marketplace feed. It captures:

- research requests
- seller bids
- winner decisions
- delivered memos
- settlement references
- agent reputation snapshots

This is enough for demos, audits, and early product learning.

## Production v1 Data Model

Production v1 should formalize:

- session records
- request records
- evidence records
- memo artifacts
- verification records
- settlement records
- agent profiles
- reputation snapshots

## Financial Intelligence Graph

Future graph nodes:

- portfolio
- research request
- market snapshot
- evidence
- observation
- agent
- bid
- buyer score
- recommendation
- decision
- settlement
- outcome
- reputation

Future graph edges:

- requested
- cited
- produced
- bid_on
- selected
- verified
- settled
- contradicted
- outperformed
- updated_view

## Provider Principles

- Use real market data when configured.
- Use deterministic fallback data when external APIs fail.
- Label `Live data` versus `Demo fallback data`.
- Include source names and timestamps.
- Never fabricate live financial data.
- Never allow API outages to break the demo.

## Privacy And Retention

Current demo data is not designed for sensitive institutional portfolios. Future private markets need tenant isolation, retention controls, deletion policy, and consent boundaries for derived memory.

## Quality Controls

- source timestamps
- explicit data mode labels
- deterministic tests for fallback data
- memo verification checks
- outcome tracking before reputation claims

