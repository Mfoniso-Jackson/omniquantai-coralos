# API Deployment

## Service

`omniquant-api`

## Responsibilities

- authentication boundary
- session creation
- market history reads
- memo retrieval
- agent registry reads/admin writes
- reputation reads
- settlement reads
- health/readiness
- Server-Sent Events streams

## Idempotency

Future write endpoints should accept:

```text
Idempotency-Key: <uuid>
```

`POST /v1/markets` should eventually create one market per idempotency key and return the existing
market if the request is replayed.

## Health

```text
GET /health
```

Returns API process health.

## Readiness

```text
GET /ready
```

Checks CoralOS reachability unless fixture mode is enabled. Future readiness should include Supabase and
Redis connectivity.

## Realtime

```text
GET /v1/markets/:id/stream
```

Server-Sent Events stream emitting `snapshot` events. WebSockets are a future upgrade only if SSE is not
enough.
