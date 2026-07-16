# Live Data

The Financial Data Layer uses live providers when practical and safe. Live data is always labeled.

## Current Behavior

The seller agent requests normalized context from:

```text
coral-agents/seller-agent/src/providers/financialDataProvider.ts
```

The context may include a mixture of live and fallback sources. The aggregate `dataMode` becomes `LIVE DATA` when at least one live source is present.

When `FMP_API_KEY` is configured, the gateway uses Financial Modeling Prep for company profiles and richer fundamentals. If FMP is unavailable, those capabilities fall back to deterministic demo data while preserving the same memo schema.

## Memo Provenance

Investment Committee Memos include:

- latest price
- recent headlines
- fundamentals
- company profile
- macro context
- technical indicators
- Solana oracle context
- data sources
- source timestamps
- confidence caveat
- provider observability

## Failure Handling

External providers are allowed to fail. The product is not.

Provider failure sequence:

```text
live provider
  -> provider-specific fallback
  -> deterministic dataset
  -> memo with degraded-mode caveat
```

The UI and memo should show `Live data` or `Demo fallback data` clearly.
