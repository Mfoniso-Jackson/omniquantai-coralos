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

## Live Market Runtime

The full Start Market flow needs CoralOS beside the API, plus Redis and the worker:

```text
frontend -> API/feed -> Redis start_market job -> worker -> CoralOS -> buyer/seller containers
```

The repository now includes a Docker Compose runtime for any Docker-capable host:

```sh
npm run runtime:up
npm run runtime:ready
```

This starts:

- CoralOS on `:5555`
- marketplace API/feed on `:4000`
- Redis on `:6379`
- `start_market` worker

Before running it, make sure `.env` includes at least:

```ini
WALLET=
BUYER_KEYPAIR_B58=
ARBITER_KEYPAIR_B58=
SOLANA_RPC_URL=https://api.devnet.solana.com
SETTLEMENT_MODE=arbiter
```

CoralOS launches agents as Docker containers, so the host must allow mounting `/var/run/docker.sock`.
This is the key production constraint. The current free Render Node service can host the API/proof
surface, but it should remain Public Proof Mode until the hosted runtime can provide Docker access
for CoralOS agent spawning.

When the runtime is healthy, this should return `ok: true`:

```sh
curl -fsS http://127.0.0.1:4000/api/ready
```

Then set the frontend build/runtime API URL to the public API origin for that host.
