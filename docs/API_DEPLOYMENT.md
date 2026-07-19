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

## Market Creation

```text
POST /v1/markets
```

Production behavior: enqueue a Redis-backed `start_market` job and return `202 Accepted`.

Example response:

```json
{
  "jobId": "uuid",
  "status": "queued",
  "namespace": "omniquant",
  "queuedAt": "2026-07-18T00:00:00.000Z",
  "statusUrl": "/v1/market-jobs/uuid"
}
```

If `REDIS_URL` is not configured, the endpoint returns `503` and tells local operators to use
`/api/start` for demo mode.

Demo-only behavior:

```text
POST /api/start
```

This route still launches synchronously so the current dashboard/Codespaces flow remains intact.

## Job Status

```text
GET /v1/market-jobs/:id
```

Returns the queued/running/completed/failed job payload. Completed jobs include the CoralOS session ID
once the worker observes it.

## Realtime

```text
GET /v1/markets/:id/stream
```

Server-Sent Events stream emitting `snapshot` events. WebSockets are a future upgrade only if SSE is not
enough.
