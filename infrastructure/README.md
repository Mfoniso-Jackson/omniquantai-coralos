# OmniQuantAI Infrastructure

Production target:

```text
omniquantai.com
  -> Vercel frontend
  -> api.omniquantai.com Railway API
  -> Supabase PostgreSQL
  -> Redis queue
  -> Railway worker
  -> CoralOS bridge
  -> Docker CoralOS runtime
  -> Solana devnet, later mainnet
```

This directory stores deployment descriptors and runbooks. Terraform is intentionally future work until
the service boundaries are stable.
