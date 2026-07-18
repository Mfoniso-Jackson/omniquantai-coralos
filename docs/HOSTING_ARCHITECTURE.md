# Hosting Architecture

## Domains

| Domain | Host | Purpose |
| --- | --- | --- |
| `omniquantai.com` | Vercel | public website and proof mode |
| `app.omniquantai.com` | Vercel | application dashboard |
| `docs.omniquantai.com` | Vercel or docs host | documentation |
| `api.omniquantai.com` | Railway | public API |
| `agents.omniquantai.com` | future | agent registry and developer portal |
| `research.omniquantai.com` | future | memo library / research graph |

## Hosting Rules

- Vercel hosts only static UI and client-side assets.
- Railway API handles HTTP, auth, reads, and request validation.
- Railway worker handles queue jobs and long-running operations.
- CoralOS runs outside Vercel in a Docker-capable runtime.
- Supabase is the system of record.
- Redis coordinates work.
- Object storage stores videos, screenshots, large memos, and evidence bundles.

## Frontend Contract

The frontend talks only to:

```text
https://api.omniquantai.com
```

It must not contain:

- Supabase service-role keys
- wallet secrets
- CoralOS tokens
- financial provider API keys
- settlement logic

## API Contract

Current production-shaped endpoints:

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
