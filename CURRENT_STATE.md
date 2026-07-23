# OmniQuantAI Current State

Status: current as of 2026-07-23.

## Operating Objective

The next phase is not about proving the long-term Financial Intelligence Network vision. The next
phase is about creating product evidence:

- 100 registered users
- 30 weekly active users
- 10 paying customers
- GBP 1,000+ MRR
- 50 completed research markets
- less than 10 minutes to first value
- more than 50% weekly retention

Every product and engineering decision should improve acquisition, activation, retention, or revenue
inside the next 90 days.

## Core Workflow

This is the only workflow that must feel exceptional:

```text
User signs up
-> creates a workspace
-> chooses an asset
-> chooses a research objective
-> launches AI Research
-> agents analyse the request
-> Investment Committee Memo is generated
-> user saves the research
-> user shares the research
-> user returns to create another market
```

Current implementation supports the middle of this flow strongly, but the beginning and end are still
incomplete. The product can generate and persist research, but it does not yet have real self-serve
accounts, billing, analytics, or sharing.

## Completed Functionality

- Working CoralOS market lifecycle:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

- Four bootstrap financial research seller agents:
  - Market Analyst
  - News & Earnings
  - Macro Risk
  - Portfolio Risk
- Buyer-side best-value bid scoring, not cheapest-only selection.
- Structured Investment Committee Memo generation.
- Deterministic report verification before payment release.
- Solana devnet escrow deposit/release with Explorer proof.
- Real-data provider layer with deterministic fallback behavior.
- Provider provenance surfaced in memo payloads.
- Public `omniquantai.com` frontend deployed through GitHub Pages.
- Public Proof Mode when the live runtime is unavailable.
- Render-hosted API/proof surface at `https://omniquantai-private-api.onrender.com`.
- API readiness check that correctly keeps Start Market disabled when CoralOS is unreachable.
- Docker Compose runtime blueprint for CoralOS + API + Redis + worker on a Docker-capable host.
- Saved memo workspace with review status, reviewer, notes, export history, and member roles.
- Organization-level pilot/team workspaces.
- Organization-scoped permissions and membership audit logs.
- API-backed organization dashboard projection.
- JSONL persistence with Supabase read/mirror path where configured.
- Redis-backed asynchronous `POST /v1/markets` job path with retry/dead-letter support.
- Agent registry, SDK foundation, CLI simulation, and sample agents.
- Private quant API boundary for MassifX workflows:
  - backtest
  - signal generation
  - risk evaluation
  - paper order prepare
  - paper order execute
- Documentation, proof assets, deployment notes, and grant/pitch artifacts.

## Incomplete Functionality

- No first-party user signup/login.
- No email, Google, wallet, or passkey auth flow for ordinary users.
- No Stripe Checkout, Billing Portal, invoices, subscription state, or upgrade flow.
- No usage limits tied to plans.
- No onboarding flow optimized for less than two minutes.
- Asset and research-objective selection are not yet the primary product path.
- Start Market still assumes the current NVDA/demo research shape in several places.
- Public site is proof-first; live market launch still requires a Docker-capable runtime host.
- Research Library exists as saved market/workspace state, but product-grade search/filter/tag/share
  flows are incomplete.
- Sharing is not implemented as public/private memo links.
- Feedback, bug reporting, feature requests, and satisfaction survey are not implemented.
- Product analytics are not implemented.
- Time to first value, drop-off, activation, repeat usage, and completion analytics are not captured.
- Full Supabase production source-of-truth mode is not fully operationalized.
- Mainnet settlement is intentionally blocked.

## Technical Debt

- The working product still lives mainly under `examples/marketplace/*`.
- `examples/marketplace/feed/src/server.ts` owns too much:
  - feed polling
  - API routes
  - launcher orchestration
  - persistence reads
  - workspace APIs
  - registry APIs
  - private quant APIs
- Frontend `App.tsx` is large and combines landing, dashboard, workspace, organization admin,
  developer portal, proof mode, and market UI.
- Some product surfaces are investor/developer oriented rather than user-workflow oriented.
- JSONL fallback is useful for development, but multi-user SaaS needs Supabase/Postgres as the
  primary store.
- Current auth is signed-publisher/token based, not human-user identity.
- Settlement reconciliation is not yet a background service.
- Runtime deployment depends on Docker socket access for CoralOS agent spawning.
- Public API readiness and public frontend mode are correct, but the live runtime is not yet hosted.

## Deployment Blockers

- The current Render service hosts the API/proof surface only; it cannot make Start Market live unless
  CoralOS can run beside it with Docker access.
- A live runtime needs:
  - Docker-capable host
  - CoralOS
  - API/feed
  - Redis
  - worker
  - funded devnet buyer wallet
  - server-side secrets
- `api.omniquantai.com` is not yet pointed at a Docker-capable runtime.
- Supabase credentials/schema need to be configured in the live environment.
- Production secrets need a real secret-management posture.
- Mainnet requires contract review, settlement caps, key custody, monitoring, and compliance review.

## Architecture Issues

Current working path:

```text
React dashboard
-> marketplace feed/API
-> CoralOS
-> buyer/seller Docker agents
-> Solana devnet escrow
-> JSONL/Supabase persistence
-> dashboard/workspace
```

Target product path:

```text
Authenticated user
-> workspace
-> research request
-> API
-> queued market job
-> worker
-> CoralOS runtime
-> memo + settlement
-> Research Library
-> billing/usage/analytics
```

Main architectural gap: user, billing, and analytics layers do not yet wrap the market lifecycle. The
market engine exists, but the SaaS product shell is incomplete.

## Revenue Blockers

- No self-serve paid conversion.
- No Stripe products:
  - Free
  - Professional at GBP 99/month
  - Team at GBP 999/month
- No subscription enforcement or usage limits.
- No upgrade prompts at natural moments:
  - after free market limit
  - before export/share
  - before team workspace invite
  - before advanced data/provenance features
- No customer identity system to connect usage, workspace, and billing.
- No shareable memo artifact for sales-led referrals.
- No product analytics to identify who is activating or returning.

## Product Blockers

- The first screen still communicates platform breadth before fully optimizing the customer workflow.
- New users need a simpler path:

```text
Create workspace -> choose asset -> choose objective -> launch research
```

- Developer portal, token content, registry/admin surfaces, architecture, roadmap, and proof content are
  useful, but should not compete with the main research workflow for new users.
- The dashboard needs stronger completion feedback:
  - memo ready
  - saved to library
  - share link created
  - export ready
  - next recommended research
- Research Library needs to become the return loop.
- Feedback capture should be present immediately after memo completion.

## Feature Categorization

### Critical

- Signup/login.
- Workspace creation.
- Asset and research objective picker.
- Reliable Start Research flow.
- Clear market progress states.
- Professional memo output.
- Save to Research Library.
- Share memo.
- Feedback capture after memo completion.
- Usage analytics.
- Stripe Checkout and subscription state.
- Usage limits and upgrade prompts.
- Live runtime hosting for Start Market.

### Useful

- Organization dashboard.
- Reviewer assignment.
- Export history.
- Member roles.
- Membership audit log.
- Provider provenance.
- Supabase persistence.
- Agent registry.
- Private quant API.
- Public proof mode.
- Demo/proof video.

### Future

- Token strategy.
- Open third-party marketplace at scale.
- Dynamic untrusted agent sandboxing.
- Full Financial Intelligence Graph query UI.
- Mainnet settlement.
- On-chain registry/reputation.
- Broad developer ecosystem portal.
- Complex portfolio management.
- Live trading.

## Recommended Simplification

For the public product, hide or de-emphasize:

- token content
- developer portal
- agent registry admin
- architecture-heavy sections
- hackathon proof framing
- broad roadmap sections

Keep them accessible from docs or footer links, but make the main app about one job:

```text
Generate and save an Investment Committee Memo for an asset.
```

## Highest-Priority Shippable Milestone

Milestone: **Self-Serve Research Activation Slice**.

Outcome:

```text
Visitor -> workspace -> asset/objective -> launch research -> memo saved -> feedback captured
```

Why this is highest priority:

- It directly improves time to first value.
- It creates activation and completion evidence.
- It makes customer demos less technical.
- It prepares the product for Stripe limits and paid conversion.
- It improves retention by making saved research the reason to return.

Scope:

- Add a focused onboarding/research launcher UI.
- Use existing organization workspace creation.
- Add asset/objective inputs with NVDA/BTC/ETH/SOL defaults.
- Map those inputs into the existing market request path.
- Save completed memos into the Research Library automatically.
- Add a lightweight feedback widget after memo completion.
- Add local/API-backed analytics events for:
  - workspace_created
  - research_started
  - memo_completed
  - memo_saved
  - feedback_submitted

Non-scope:

- Stripe billing.
- Full auth.
- Mainnet.
- New agent types.
- Token features.
- Live trading.

## Next Three Execution Slices

1. **Research Activation UI**
   - Make the first product action: create/select workspace, choose asset, choose objective, launch.
   - Hide developer/proof clutter below the fold.
   - Success metric: a new visitor understands the next action in under 10 seconds.

2. **Customer Evidence System**
   - Add feedback widget, bug report, feature request, satisfaction score, and minimal analytics records.
   - Success metric: every completed memo can produce a customer signal.

3. **Billing Foundation**
   - Add Stripe Checkout, Billing Portal, plan records, and usage limits.
   - Success metric: a user can upgrade to Professional without manual intervention.

## Current Recommendation

Do not build more marketplace infrastructure until the activation loop is sharper. The engine is strong
enough for pilots. The business now needs product evidence: users creating research, saving memos,
sharing output, giving feedback, and eventually paying.
