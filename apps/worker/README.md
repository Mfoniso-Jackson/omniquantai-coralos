# Worker App

Target host: Railway service `omniquant-worker`

Current status: Redis-backed worker entrypoint in `examples/marketplace/feed`.

The worker will consume Redis jobs and perform long-running work that must never run in Vercel and
should not block public API requests.

Responsibilities:

- process `start_market` jobs
- collect financial data
- generate memos
- monitor settlement
- retry failed provider calls
- update persistence and reputation
- emit lifecycle events for frontend streams

Initial queue:

```text
POST /v1/markets
  -> enqueue start_market
  -> worker launches CoralOS market session
  -> GET /v1/market-jobs/:id returns queued/running/completed/failed
```

Run command:

```sh
REDIS_URL=redis://... npm run worker --prefix examples/marketplace/feed
```

Future upgrades should add richer retries, dead-letter inspection, and a formal bridge boundary.
