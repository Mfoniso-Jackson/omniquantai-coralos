# Data Providers

OmniQuantAI uses a provider-based Financial Data Layer. Agents consume normalized context, not raw API payloads.

## Current Live Providers

| Capability | Provider | Environment |
| --- | --- | --- |
| Equity price | Yahoo Finance chart API | no key |
| News | Finnhub | `FINNHUB_API_KEY` |
| News | NewsAPI | `NEWS_API_KEY` |
| Fundamentals | Financial Modeling Prep profile, quote, and key metrics APIs | `FMP_API_KEY` |
| Company profile | Financial Modeling Prep profile API | `FMP_API_KEY` |
| Solana oracle context | Pyth Hermes | optional `PYTH_SOL_USD_FEED_ID` |

## Current Fallback Providers

Deterministic demo data supports:

```text
NVDA, AAPL, MSFT, AMZN, GOOGL, TSLA, BTC, ETH
```

Fallback data includes prices, fundamentals, news, company profiles, macro indicators, and technical indicators.

## Environment Variables

```ini
FINNHUB_API_KEY=
NEWS_API_KEY=
FMP_API_KEY=
PYTH_SOL_USD_FEED_ID=
```

Missing variables do not break the demo. The data layer falls back and labels the response.

## Licensing Notes

Provider licensing varies. Before using a provider in production, confirm:

- redistribution rights
- commercial use terms
- rate limits
- attribution requirements
- whether data can be stored or displayed publicly

Demo fallback data is static and should not be treated as live market data.
