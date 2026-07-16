# OmniQuantAI Financial Intelligence Graph

OmniQuantAI is not only a market UI. It is a Financial Intelligence Network where every completed research market becomes permanent structured knowledge.

The graph is the durable asset:

- which questions institutions asked
- which specialist agents competed
- what evidence they used
- which agent won
- what memo was delivered
- how verification scored it
- how settlement completed
- how agent reputation changed
- what future outcomes later proved or disproved

## Design Principles

- Event-first: every lifecycle step is append-only.
- Graph-shaped: entities are persisted as nodes and relationships as edges.
- PostgreSQL first: Supabase is the initial system of record.
- Graph-ready: node and edge tables preserve a future migration path to Neo4j, Kuzu, TigerGraph, or a vector/graph hybrid.
- Audit-friendly: nothing important is destructively overwritten.
- Provider-aware: data sources, timestamps, live/fallback mode, and provider observability remain attached to memos.

## Core Nodes

| Node | Purpose |
| --- | --- |
| `MarketSession` | Durable market container keyed by session ID. |
| `ResearchRequest` | Buyer research question, budget, asset, and service. |
| `Buyer` | Buyer agent or future institutional user. |
| `Agent` | Specialist seller identity. |
| `AgentProfile` | Specialization, reputation, win rate, revenue, delivery history. |
| `AgentBid` | Price, confidence, delivery time, and reasoning. |
| `MarketSnapshot` | Market data snapshot used by the research request. |
| `Evidence` | Source-backed observations used in memo construction. |
| `InvestmentCommitteeMemo` | Versioned delivered memo and provenance. |
| `Verification` | Completeness and release decision. |
| `Settlement` | Escrow/reference/signature state. |
| `ExplorerTransaction` | Deposit and release transaction proofs. |
| `Outcome` | Future recommendation-quality measurement. |
| `Reputation` | Append-only reputation delta for each market. |
| `Portfolio` | Future holdings and exposure context. |
| `Institution` | Future customer/account boundary. |
| `Workspace` | Future team/project boundary. |

## Core Edges

| Edge | From | To |
| --- | --- | --- |
| `contains_request` | `MarketSession` | `ResearchRequest` |
| `broadcasts` | `Buyer` | `ResearchRequest` |
| `uses_market_snapshot` | `ResearchRequest` | `MarketSnapshot` |
| `solicits_agent` | `ResearchRequest` | `Agent` |
| `submits_bid` | `Agent` | `AgentBid` |
| `answers_request` | `AgentBid` | `ResearchRequest` |
| `selects_winner` | `Buyer` | `Winner` |
| `awards_agent` | `Winner` | `Agent` |
| `generates_memo` | `Agent` | `InvestmentCommitteeMemo` |
| `responds_to_request` | `InvestmentCommitteeMemo` | `ResearchRequest` |
| `verified_by` | `InvestmentCommitteeMemo` | `Verification` |
| `settled_through` | `InvestmentCommitteeMemo` | `Settlement` |
| `pays_agent` | `Settlement` | `Agent` |
| `updates_reputation` | `Settlement` | `Reputation` |
| `improves_future_intelligence` | `Outcome` | `AgentProfile` |

## Event Stream

Every market lifecycle stage emits an append-only event:

```text
SessionCreated
WantBroadcast
BidSubmitted
WinnerSelected
EscrowRequested
SettlementInitiated
MemoGenerated
VerificationPassed / VerificationFailed
SettlementCompleted
MarketClosed
ReputationUpdated
```

The event stream is enough to reconstruct the market timeline. Entity records provide query-optimized projections.

## Current Implementation

The feed server persists a durable local development store under:

```text
.omniquant-data/
```

The files are JSONL projections:

- `market_sessions.jsonl`
- `research_requests.jsonl`
- `market_events.jsonl`
- `agent_bids.jsonl`
- `winners.jsonl`
- `investment_memos.jsonl`
- `settlements.jsonl`
- `agent_reputation.jsonl`
- `agent_profiles.jsonl`
- `graph_nodes.jsonl`
- `graph_edges.jsonl`

This lets the app keep history today without requiring Supabase credentials.

## Production Store

Initial production storage is Supabase PostgreSQL. The migration lives in:

```text
supabase/migrations/202607160001_financial_intelligence_graph.sql
```

PostgreSQL stores the event stream, normalized entities, memo payloads, and graph edges. JSONB is used only where the payload is intentionally vendor- or memo-shaped.

## Read APIs

The feed server exposes history endpoints:

```text
GET /api/markets
GET /api/markets/:id
GET /api/agents
GET /api/agents/:id
GET /api/sessions
GET /api/memo/:id
GET /api/reputation/:agent
GET /api/graph/session/:id
```

These endpoints are the first contract for Market History, Agent Profiles, Memo Library, Session Explorer, and Reputation Dashboard UI.

## Future Outcome Tracking

Outcome tracking is intentionally designed but not fully implemented yet:

```text
Recommendation
  -> evaluation window
  -> realized price/performance
  -> outcome score
  -> reputation update
```

This lets OmniQuantAI measure which specialist agents create intelligence that later proves useful.

## Moat

The graph compounds through:

- reputation history
- decision memory
- verified memo quality
- settlement history
- provider provenance
- future outcome scores

Models can be copied. A high-quality financial intelligence graph with millions of settled work transactions is much harder to replicate.
