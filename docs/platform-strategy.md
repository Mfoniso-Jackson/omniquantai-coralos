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

## Revenue-Aligned Surfaces

| Revenue Engine | Platform Surface | Product Proof Needed |
| --- | --- | --- |
| Professional SaaS | Dashboard, saved memos, live data | repeat individual research sessions |
| Team SaaS | Workspace, session history, portfolio context | shared memo trail and collaboration |
| Enterprise | Private runtime, audit logs, roles | controlled deployment and compliance story |
| Marketplace fees | Agent registry, bids, reputation, settlement | external agents earn from verified work |
| API platform | `/v1/markets`, job polling, memo and graph APIs | programmable market creation and retrieval |
| Premium intelligence | Financial Intelligence Graph | reusable analytics from completed markets |

## Platform Principles

- Preserve the core lifecycle.
- Tie product slices to recurring revenue, marketplace liquidity, retention, or proprietary data.
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
- [revenue-operating-plan.md](revenue-operating-plan.md)
- [production-checklist.md](production-checklist.md)
