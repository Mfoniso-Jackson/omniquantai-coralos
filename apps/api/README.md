# Public API App

Target host: Railway service `omniquant-api`

Current implementation:

```text
examples/marketplace/feed
```

Production responsibilities:

- authentication boundary
- session creation
- versioned REST API
- market history
- memo retrieval
- agent registry
- reputation reads
- settlement reads
- health and readiness endpoints
- Server-Sent Events market stream

Current versioned endpoints:

```text
GET  /health
GET  /ready
POST /v1/markets
GET  /v1/market-jobs/:id
GET  /v1/markets
GET  /v1/markets/:id
GET  /v1/markets/:id/events
GET  /v1/markets/:id/stream
GET  /v1/agents
GET  /v1/agents/:id
GET  /v1/memos/:id
GET  /v1/settlements/:id
```

The API remains stateless. `POST /v1/markets` now returns an asynchronous Redis job when `REDIS_URL`
is configured. Local demo launch remains on `POST /api/start`.

## MassifX Private API Boundary

MassifX must consume OmniQuantAI through `omniquant_client/` instead of importing internal packages or
scattering HTTP calls. The planned private quant API surface is intentionally small:

```text
GET  /v1/health
POST /v1/backtests
POST /v1/signals/generate
POST /v1/risk/evaluate
POST /v1/orders/prepare
POST /v1/orders/execute
GET  /v1/models
```

See `docs/massifx-architecture-refactor.md`.

Current behavior:

- `GET /v1/health` returns a private API boundary health payload.
- `GET /v1/models` returns an empty model registry projection.
- `POST /v1/backtests` runs the first OmniQuantAI-owned deterministic backtest implementation. It
  accepts provided candles when available and otherwise falls back to deterministic demo candles.
- `POST /v1/signals/generate` runs deterministic strategy signal generation for trend, mean
  reversion, breakout, and volatility-regime strategies.
- `POST /v1/risk/evaluate` runs deterministic controls for max position size, leverage, stop-loss,
  drawdown, daily loss, stale data, volatility, open positions, and kill switch.
- `POST /v1/orders/prepare` prepares paper orders after risk approval and returns prepared/rejected
  status with deterministic refusal reasons.
- `POST /v1/orders/execute` executes paper-only prepared orders against a supplied paper account and
  returns filled/rejected status plus the updated paper account.
