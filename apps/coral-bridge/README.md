# CoralOS Bridge App

Target host: Railway service `omniquant-coral-bridge` or a dedicated Docker host.

Current implementation:

```text
examples/marketplace/start.ts
coral-agents/*
docker-compose.yml
```

Responsibilities:

- launch CoralOS sessions
- connect buyer agents
- connect seller agents
- normalize CoralOS messages into OmniQuantAI lifecycle events
- persist lifecycle transitions
- hide CoralOS runtime details from the frontend

The frontend must never connect directly to CoralOS. The API and worker communicate with this service
over private network or authenticated internal HTTP in production.
