# OmniQuant Private Client

`omniquant_client/` is the private boundary for product apps that consume OmniQuantAI.

MassifX should use this client from its backend instead of importing OmniQuantAI internals or scattering
HTTP calls across the app.

## Current Scope

The first client slice intentionally covers only the private API surface needed for the initial
quant workflow:

```text
GET  /v1/health
POST /v1/backtests
POST /v1/signals/generate
POST /v1/risk/evaluate
POST /v1/orders/prepare
POST /v1/orders/execute
GET  /v1/models
```

`executePaperOrder` only allows paper execution. Live exchange execution is deferred until the risk,
custody, compliance, and deployment gates are complete.

## Usage

```ts
import { OmniQuantClient } from '@omniquant/private-client'

const omniquant = new OmniQuantClient({
  baseUrl: process.env.OMNIQUANT_API_URL!,
  apiKey: process.env.OMNIQUANT_API_KEY,
})

const backtest = await omniquant.runBacktest({
  strategyId: 'trend-following',
  symbol: 'BTCUSDT',
  timeframe: '1h',
  start: '2026-01-01',
  end: '2026-02-01',
  initialCapital: 100000,
})
```

## Rule

MassifX owns users, portfolios, subscriptions, UI, reporting, and permissions.

OmniQuantAI owns market intelligence, strategy computation, risk evaluation, signals, execution
preparation, analytics, backtests, and decision logs.
