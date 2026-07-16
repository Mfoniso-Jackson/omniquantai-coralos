# Fallback Strategy

OmniQuantAI prioritizes reliability over brittle live-data dependencies. Missing API keys, provider errors, and rate limits must not break the market loop.

## Principles

- Never fabricate live data.
- Never hide fallback usage.
- Never send raw failed provider responses to agents.
- Always include source labels and timestamps.
- Keep fallback outputs deterministic.

## Deterministic Dataset

The current deterministic dataset supports:

- NVDA
- AAPL
- MSFT
- AMZN
- GOOGL
- TSLA
- BTC
- ETH

Fallback timestamp:

```text
2026-07-16T00:00:00.000Z
```

This keeps tests stable and proof runs reproducible.

## User-Facing Labeling

When fallback data is used, responses include:

```text
Mode: DEMO FALLBACK DATA
Source: Deterministic demo dataset
Reason: provider unavailable / key missing / request failed
```

## Testing

The seller-agent test suite covers:

- fallback determinism
- supported asset normalization
- provider failure recovery
- memo generation when network calls fail

Run:

```sh
npm test --prefix coral-agents/seller-agent
```
