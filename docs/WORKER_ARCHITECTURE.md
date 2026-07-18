# Worker Architecture

## Goal

Move long-running market work out of the public API.

## Queue

Target: Redis with BullMQ or equivalent.

Primary queue:

```text
omniquant:start_market
```

Dead-letter queue:

```text
omniquant:dead-letter
```

## Job Shape

```json
{
  "type": "start_market",
  "sessionId": "uuid",
  "namespace": "omniquant",
  "request": {
    "service": "omniquant",
    "argument": "nvda-3-6m-exposure",
    "budgetSol": 0.03
  },
  "correlationId": "uuid"
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

- jobs are idempotent by `sessionId`
- failed provider calls fall back deterministically
- settlement monitoring reconciles by reference/signature
- worker shutdown drains in-flight jobs
- repeated failures enter the dead-letter queue with diagnostics
