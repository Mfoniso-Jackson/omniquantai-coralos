# Worker Architecture

## Goal

Move long-running market work out of the public API.

## Queue

Current: Redis-backed queue using a small internal RESP client, so no new runtime dependency is required.
Future: BullMQ or equivalent once delayed jobs, retries, and dead-letter inspection need richer tooling.

Primary queue:

```text
omniquant:start_market
```

Dead-letter queue:

```text
omniquant:start_market:dead-letter
```

## Job Shape

```json
{
  "id": "uuid",
  "type": "start_market",
  "status": "queued",
  "namespace": "omniquant",
  "attempts": 0,
  "maxAttempts": 3,
  "idempotencyKey": "request-uuid",
  "request": {
    "service": "omniquant",
    "argument": "nvda-3-6m-exposure",
    "budgetSol": 0.03
  },
  "createdAt": "2026-07-18T00:00:00.000Z",
  "updatedAt": "2026-07-18T00:00:00.000Z"
}
```

## Responsibilities

- start markets asynchronously
- collect provider data with fallbacks
- call CoralOS bridge
- persist lifecycle events
- monitor settlement
- retry transient failures
- update agent reputation

## Reliability Requirements

- queued market creation is idempotent by `Idempotency-Key`
- `POST /v1/markets` returns the same job for repeated `Idempotency-Key` values
- `POST /v1/markets` does not block on CoralOS startup
- failed `start_market` jobs retry with backoff before entering the dead-letter queue
- job state transitions are appended to `market_jobs.jsonl`
- failed provider calls fall back deterministically
- settlement monitoring reconciles by reference/signature
- worker shutdown drains in-flight jobs
- repeated failures enter the dead-letter queue with diagnostics

## Current Commands

API:

```sh
npm run start --prefix examples/marketplace/feed
```

Worker:

```sh
REDIS_URL=redis://... npm run worker --prefix examples/marketplace/feed
```

Local demo compatibility:

```text
POST /api/start
```

The compatibility route remains synchronous for Codespaces/demo recordings. Production callers should use
`POST /v1/markets`.
