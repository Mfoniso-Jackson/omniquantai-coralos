# CoralOS Runtime

## Rule

CoralOS must not be exposed directly to the frontend.

## Current Local Runtime

```sh
docker compose up
```

The local runtime starts CoralOS and agent containers used by the marketplace demo.

## Production Boundary

Production should split:

- `omniquant-api`: public HTTP
- `omniquant-worker`: queue consumer
- `omniquant-coral-bridge`: CoralOS launcher/event normalizer
- CoralOS Docker runtime: dedicated container host

## Bridge Responsibilities

- create namespace/session
- connect buyer and seller agents
- normalize WANT/BID/AWARD/DELIVERED/VERIFIED/RELEASED messages
- publish lifecycle events back to API/worker
- expose diagnostics for stuck sessions

## Future Kubernetes

Kubernetes becomes useful when multiple CoralOS sessions need isolated execution pools. Until then, a
Docker-capable host is enough.
