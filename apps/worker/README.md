# Worker App

Target host: Railway service `omniquant-worker`

Current status: planned service boundary.

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
  -> create market session row
  -> enqueue start_market
  -> worker launches CoralOS through coral-bridge
```

Use BullMQ or an equivalent Redis-backed worker once the API is split from the current feed server.
