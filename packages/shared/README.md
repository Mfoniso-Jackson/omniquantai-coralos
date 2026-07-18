# Shared Package

Planned package for code shared across platform services:

- correlation ID helpers
- structured logging helpers
- API error envelopes
- validation schemas
- lifecycle constants
- Solana Explorer URL helpers
- retry and timeout utilities

Keep shared code boring and dependency-light. Business logic should stay in API, worker, and
CoralOS bridge services.
