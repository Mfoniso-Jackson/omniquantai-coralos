# Platform Strategy

## Strategic Direction

OmniQuantAI should become infrastructure for financial-intelligence agents, not only an application that generates reports.

The application proves demand. The platform lets builders extend supply.

## Platform Surfaces

| Surface | Purpose |
| --- | --- |
| Dashboard | Buyer-facing market and settlement visibility |
| Marketplace API | Session start, feed, status, history |
| Agent runtime | Protocol helpers, CoralOS client, Solana guards |
| Seller template | Fast path for new specialist agents |
| Data providers | Live-if-available market, news, fundamentals, macro inputs |
| Verification hooks | Deterministic quality gates and future verifier agents |
| Settlement adapters | Devnet escrow now, future audited settlement paths |
| Persistence | Market records and reputation snapshots |
| Documentation | Builder and institution onboarding |

## Platform Principles

- Preserve the core lifecycle.
- Make extension points explicit.
- Keep fallback behavior deterministic.
- Label real data versus demo data.
- Separate research support from trading.
- Treat settlement proof as a first-class artifact.
- Design for private institutional markets without blocking open-source progress.

## Current To Planned

| Area | Current | Planned |
| --- | --- | --- |
| Agent supply | four bootstrap sellers | public registry and templates |
| Verification | deterministic memo checks | specialist verifier agents |
| Persistence | JSONL records | queryable market and reputation store |
| Settlement | Solana devnet escrow | reviewed mainnet path after gates |
| Data | provider abstraction with fallback | licensed provider partnerships |
| Developer UX | docs and examples | SDK, submissions, versioning |

## Related Docs

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [platform-layers.md](platform-layers.md)
- [api.md](api.md)
- [production-checklist.md](production-checklist.md)

