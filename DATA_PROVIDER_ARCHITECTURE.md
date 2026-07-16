# OmniQuantAI Financial Data Provider Architecture

OmniQuantAI agents should never depend directly on vendor APIs. They consume the Financial Data Layer, which normalizes provider output into stable internal models and labels every response as live or fallback.

## Current Implementation

Primary runtime:

```text
seller-agent/src/providers/financialDataProvider.ts
```

The gateway exposes:

```ts
FinancialDataProvider.getContext({ asset })
```

The returned context includes:

- market price snapshot
- fundamentals
- recent news
- company profile
- macro indicators
- technical indicators
- Solana oracle liquidity context
- source metadata
- provider observability

## Normalized Models

Current normalized models live in:

```text
seller-agent/src/providers/mockDataProvider.ts
```

Implemented:

- `MarketPrice`
- `FundamentalsSnapshot`
- `NewsHeadline`
- `CompanyProfile`
- `MacroIndicator`
- `TechnicalSnapshot`
- `SolanaOracleContext`
- `OmniQuantDataContext`

Every model includes source metadata directly or through the aggregate context.

## Source Metadata

Every response must carry:

- provider/source label
- timestamp
- mode: `LIVE DATA` or `DEMO FALLBACK DATA`
- optional fallback reason

Demo data must never be presented as live data.

## Provider Flow

```text
Agent
  -> FinancialDataProvider
  -> market/news/fundamentals/oracle providers
  -> deterministic fallback dataset
  -> normalized FinancialDataContext
  -> Investment Committee Memo
```

The memo service receives normalized context only. It does not receive raw vendor payloads.

## Deterministic Fallback

Supported fallback assets:

- NVDA
- AAPL
- MSFT
- AMZN
- GOOGL
- TSLA
- BTC
- ETH

Fallback timestamps are fixed to keep tests and proof runs deterministic.

## Caching And Resilience

The gateway keeps a short in-process context cache. Individual providers also keep simple request caches.

Current behavior:

- if a live provider succeeds, live data is used
- if a provider is unavailable, fallback data is used
- if keys are missing, fallback data is used
- the platform does not fail because a provider is unavailable

## Observability

Each provider call records:

- provider
- capability
- mode
- latency
- cache hit
- success
- fallback usage
- error message when available

These records are included in the memo payload under `provider_observability`.

## Future Provider Adapters

Planned adapters:

- Twelve Data / Polygon / Alpha Vantage for prices and technicals
- Finnhub / FMP for fundamentals and company profiles
- Finnhub / Marketaux / NewsAPI for news
- FRED / ECB / World Bank for macro
- CoinGecko / Birdeye / Helius for digital assets

Each adapter should map into the existing normalized models instead of changing agent business logic.
