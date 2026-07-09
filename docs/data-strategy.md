# OmniQuantAI Data Strategy

## Principle

Production v1 must feel real without becoming fragile.

The data system follows this rule:

```text
Use live data when available.
Fallback deterministically when unavailable.
Never break the demo because an API key is missing.
```

## Default Asset

The default demo asset is:

```text
NVDA
```

Default research question:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

## Provider Layers

Current provider surfaces:

| Provider | Purpose | Live source | Fallback |
| --- | --- | --- | --- |
| `marketDataProvider` | price and movement | Yahoo Finance / configured provider | deterministic NVDA snapshot |
| `newsProvider` | recent headlines | Finnhub or NewsAPI | deterministic Nvidia headlines |
| `fundamentalsProvider` | fundamentals | Financial Modeling Prep | deterministic valuation context |
| `macroProvider` | macro context | configured provider roadmap | deterministic macro risks |
| `onChainProvider` / oracle provider | settlement and Solana context | Pyth Hermes / Solana RPC | deterministic devnet context |
| `mockProvider` | reliable demo data | none | canonical fallback |

## Data Source Badges

The UI and memo should display:

- `LIVE DATA` when live provider responses are used
- `DEMO DATA` when deterministic fallback data is used

Every evidence item should include:

- source label
- timestamp
- provider mode
- confidence caveat where relevant

## Persistence

Production v1 uses lightweight JSONL persistence. This keeps the project easy to run in Codespaces and local Docker without introducing database operations.

Persisted records include:

- market sessions
- research requests
- agent bids
- buyer decisions
- generated memos
- settlement status
- agent reputation snapshots
- timestamps
- data source metadata

Default directory:

```text
.omniquant-data/
```

Override:

```ini
OMNIQUANT_DATA_DIR=/path/to/data
```

Disable:

```ini
OMNIQUANT_PERSIST=0
```

## Reputation Inputs

Agent reputation v1 can be derived from market events:

- jobs completed
- jobs won
- win rate
- total revenue earned on devnet/demo settlement
- average confidence
- average delivery time
- verified deliveries
- last active timestamp
- specialty

This is not yet a performance-alpha score. It is a marketplace reliability and participation signal.

## Financial Intelligence Graph

The future graph should connect:

- research requests
- agents
- bids
- evidence
- recommendations
- decisions
- verification checks
- settlements
- outcomes
- reputation updates

Production v1 should keep stable IDs and timestamps so JSONL records can later migrate to SQLite, Postgres, or a graph database.

## Data Safety

- Do not execute trades.
- Do not present research as personalized financial advice.
- Do not require paid API keys for the demo.
- Do not expose provider API keys to the frontend.
- Keep fallback behavior explicit and visible.
