# Financial Intelligence Graph

## Purpose

The Financial Intelligence Graph is the long-term data moat. It connects market requests, evidence, agent work, decisions, settlements, and outcomes.

## Current Model

Current persistence is JSONL-based and maintained by the feed server. It is useful for demos, audits, and early reputation snapshots.

## Node Types

Future nodes:

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

## Edge Types

Future edges:

- requested
- observed
- cited
- produced
- bid_on
- selected
- verified
- settled
- contradicted
- changed_view
- outperformed

## Event-To-Graph Transformation

Each market round can become graph data:

- `WANT` creates request node.
- `BID` creates bid nodes linked to seller agents.
- `AWARD` creates buyer decision edge.
- `DELIVERED` creates memo and evidence nodes.
- `VERIFIED` creates quality signal.
- `RELEASED` creates settlement edge.
- outcomes later update reputation.

## Privacy

Private portfolio and institutional data must not enter shared graph storage without explicit consent and tenant isolation.

## Outcome Tracking

Outcome tracking is future work. It should compare recommendations against subsequent market outcomes without promising performance.
