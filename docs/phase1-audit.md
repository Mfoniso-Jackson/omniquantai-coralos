# OmniQuantAI Phase 1 Audit

Status: current as of 2026-07-20.

## Completed Work

- Working agent-market lifecycle for the protected loop:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

- CoralOS-coordinated buyer and seller agents.
- Four bootstrap financial research specialist sellers.
- Buyer-side best-value bid scoring.
- Structured Investment Committee Memo generation with provider provenance.
- Deterministic verification gate before settlement release.
- Solana devnet settlement proof with Explorer links.
- Start Market UX with no manual session paste for normal usage.
- Saved memo workspace with review status, reviewer assignment, notes, export history, and member roles.
- Organization-level pilot/team workspaces with inherited permissions.
- Redis-backed asynchronous `POST /v1/markets` start-market jobs.
- Supabase mirroring and read fallback for market, memo, workspace, membership, audit, organization, and organization-session records.
- SDK and CLI foundation for agent registration and simulation.
- Public proof mode and proof artifacts for demos when live API hosting is unavailable.

## Incomplete Work

- User account creation and first-party email/Google authentication are not implemented.
- Wallet connection exists as a product requirement, but the current flow still uses server-side/devnet demo wallets.
- Billing and Stripe subscription management are not implemented.
- The production `apps/*` boundaries are documented/scaffolded, but the working implementation remains in `examples/marketplace/*`.
- Research Library search, tags, favorites, pinned markets, sharing, and saved filters are not complete.
- Financial Intelligence Graph exists as persisted graph records and docs, not a full queryable product surface.
- CoralOS runtime is still Docker/local-host oriented and needs a dedicated hosted runtime boundary.
- Mainnet settlement remains intentionally blocked.

## Architecture

Current working path:

```text
Dashboard -> Feed API -> CoralOS -> Buyer/Seller Agents -> Solana Devnet -> Persistence -> Dashboard
```

Production target:

```text
Frontend -> API -> Redis -> Worker -> Coral Runtime -> Solana
                 \-> Supabase -> Workspace Dashboard / Research Library
```

The architecture is moving from a demo-shaped feed server toward production service boundaries. The safest strategy remains wrapper-first: keep the working lifecycle stable while promoting API, worker, persistence, and dashboard surfaces into durable boundaries.

## Technical Debt

- `examples/marketplace/feed` still owns API, feed folding, persistence reads, and local launch orchestration.
- `examples/marketplace/web` still computes some workspace projections locally as fallbacks.
- JSONL fallback is useful, but multi-instance deployments must treat Supabase as the source of truth.
- Auth is currently signed-publisher/workspace-token based, not full user identity.
- Settlement reconciliation is not yet a background job.
- Some generated `dist/` and local package artifacts exist in source control, which should be reviewed before long-term package publishing.

## Missing Infrastructure

- Supabase project with `docs/supabase_migration.sql` applied.
- Hosted API, Redis, worker, and CoralOS Docker runtime.
- Dedicated secret storage for provider keys and Solana key material.
- Stripe account/products/webhooks for billing.
- Error tracking and structured production metrics.
- CI deployment pipeline for frontend/API/worker.

## Deployment Blockers

- CoralOS and Docker agent orchestration cannot run on static hosting.
- Free frontend hosting can serve proof mode, but live Start Market requires a Docker-capable API/runtime host.
- Supabase credentials must be configured server-side before durable production reads are enabled.
- Mainnet requires contract review, new program IDs, capped settlement controls, key custody, and legal/compliance review.

## Scalability Risks

- Single-process API and CoralOS runtime are bottlenecks for concurrent market launches.
- Long-running agent execution should stay in the worker, not request handlers.
- Solana RPC failures need reconciliation and retry strategy.
- Dynamic agent participation needs sandboxing, capability filtering, and stronger reputation enforcement before untrusted agents can run.
- Workspace and organization permissions need real user identity to become enterprise-grade.

## Highest-Priority Shippable Milestone

Milestone: **API-backed Pilot Workspace Dashboard**.

Why this milestone:

- It supports paid pilots and team SaaS directly.
- It proves completed markets become permanent workspace memory.
- It shifts important state from browser computation to backend/Supabase-ready projection.
- It does not disturb CoralOS coordination or Solana settlement.

This slice is now implemented by wiring the dashboard to `GET /api/organizations/:id/dashboard` with local projection fallback.
