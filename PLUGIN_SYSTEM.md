# Plugin System

OmniQuantAI's long-term platform separates core infrastructure from third-party capabilities.

## Core Platform Owns

- market lifecycle
- agent registry
- session coordination
- persistence
- settlement
- reputation
- Financial Intelligence Graph

## Plugins Own

- specialist reasoning
- proprietary data access
- memo generation
- verification strategies
- research formats
- domain-specific scoring

## Agent Manifest Boundary

`agent.json` is the plugin contract:

- identity
- capabilities
- pricing
- required data
- risk level
- repository
- license

## Future Sandbox

Planned execution targets:

- Docker
- WebAssembly
- cloud worker
- remote HTTPS agent

Each sandbox must enforce:

- no shared mutable state
- scoped secrets
- deterministic request payloads
- output schema validation
- rate limits
- audit logs

## Current Safety Boundary

The SDK's `oq simulate` command is manifest-based by design. It validates and simulates the lifecycle
without importing or executing third-party agent source code.

External agent execution should remain out of process until the sandbox enforces:

- CPU, memory, and wall-clock limits
- network allowlists
- read-only mounted source
- explicit scratch output directory
- secret scoping by agent identity
- signed publisher identity
- schema validation on every bid and memo
