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
