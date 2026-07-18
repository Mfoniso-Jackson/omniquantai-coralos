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
GET  /v1/markets
GET  /v1/markets/:id
GET  /v1/markets/:id/events
GET  /v1/markets/:id/stream
GET  /v1/agents
GET  /v1/agents/:id
GET  /v1/memos/:id
GET  /v1/settlements/:id
```

The API remains stateless. Long-running market execution should move to `apps/worker` through Redis.
