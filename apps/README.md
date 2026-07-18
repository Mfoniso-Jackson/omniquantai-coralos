# OmniQuantAI Apps

This directory is the production monorepo entrypoint map. The current working code remains in
`examples/marketplace` while the platform is migrated behind stable app boundaries.

| App | Current backing implementation | Production role |
| --- | --- | --- |
| `frontend` | `examples/marketplace/web` | Stateless Vercel UI for landing, dashboard, history, agents, memos, docs |
| `api` | `examples/marketplace/feed` | Stateless public API at `api.omniquantai.com` |
| `worker` | planned queue consumer | Railway worker for asynchronous market jobs |
| `coral-bridge` | `examples/marketplace/start.ts` plus CoralOS agents | CoralOS session launcher and event normalizer |

Do not move code into this directory until the target service has a compatibility wrapper and tests.
