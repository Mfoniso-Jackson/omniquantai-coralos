# OmniQuantAI Data Architecture

OmniQuantAI is designed around this loop:

```text
Data -> Intelligence -> Decisions -> Outcomes -> Learning -> Better Intelligence
```

The moat is not market data. Market data is a commodity. The moat is the Financial Intelligence Graph:
research requests, agent observations, hypotheses, buyer decisions, settlements, outcomes, reputation,
and learning.

## Seven Logical Layers

### Layer 1: Market Data

Market data enters through provider interfaces. Providers may be live or deterministic demo providers.
Missing API keys must never break the demo.

Future provider targets:

- Yahoo Finance
- Finnhub
- Polygon
- Alpha Vantage
- Financial Modeling Prep
- SEC EDGAR
- NewsAPI
- FRED
- CoinGecko
- Birdeye
- Dune
- Solana
- Sui

MVP status: provider interfaces plus deterministic market snapshot persistence. The seller memo attempts live NVDA price data through Yahoo Finance, live headlines through Finnhub or NewsAPI when keys exist, and fundamentals through Financial Modeling Prep when configured. Any failure falls back to deterministic demo data.

### Layer 2: Context

The Context Engine transforms raw provider data into usable investment context:

- market news
- macro events
- sector trends
- sentiment
- valuation metrics
- volatility
- liquidity
- portfolio exposures

MVP status: context is embedded in the deterministic investment committee memo and market snapshot model.

### Layer 3: Agent Observations

Every specialist agent should eventually emit structured observations:

- observation
- confidence
- supporting evidence
- timestamp
- source
- session ID
- agent ID

MVP status: observation schemas exist; memo evidence cards can be mapped into observations.

### Layer 4: Marketplace Intelligence

Every auction becomes proprietary marketplace data:

- research request
- buyer
- seller
- bid price
- confidence
- reasoning
- delivery time
- winner
- settlement status
- timestamp
- session

MVP status: the feed persists research requests, bids, winners, and settlements as JSONL records.

### Layer 5: Decision Intelligence

Every completed request becomes a decision record:

- question
- recommendation
- evidence
- human decision
- buyer decision
- timestamp
- confidence
- portfolio context
- future outcome

MVP status: delivered investment committee memos are persisted as decision records. Future outcomes are deferred.

### Layer 6: Agent Reputation

Agents accumulate:

- win rate
- revenue
- jobs completed
- accuracy
- calibration
- average confidence
- average delivery time
- specialization
- market domain

MVP status: deterministic reputation records are derived from the folded market round.

### Layer 7: Financial Intelligence Graph

Future graph nodes:

- Research Request
- Portfolio
- Agent
- Observation
- Evidence
- Recommendation
- Decision
- Outcome
- Settlement

Future graph edges:

- Generated
- Supports
- Rejected
- Purchased
- Verified
- Settled
- Approved
- Influenced

MVP status: records include stable IDs and relationship fields so migration to a graph database is straightforward.

## Target Architecture

```text
Market Providers
  -> Normalization
  -> Feature Store
  -> Context Engine
  -> Agent Memory
  -> Marketplace
  -> Decision Engine
  -> Settlement
  -> Financial Intelligence Graph
```

## MVP Persistence

The hackathon persists only what supports the demo:

- research requests
- agent bids
- winner decisions
- investment committee memos
- settlement status
- agent reputation snapshots
- market snapshots

Implementation:

- JSONL files are written under `.omniquant-data/` by default.
- Set `OMNIQUANT_DATA_DIR=/path/to/dir` to override.
- Set `OMNIQUANT_PERSIST=0` to disable persistence.
- Persistence is append-only and deduped per server process.

## Deferred

Not in the hackathon MVP:

- graph database
- feature store service
- portfolio upload
- outcome tracking
- institutional ACLs
- paid market data integrations
- live recommendation performance analytics

Those are intentionally deferred until the demo loop is stable.
