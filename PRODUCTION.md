# OmniQuantAI Production v1 Plan

## Current Architecture

OmniQuantAI is a Financial Intelligence Network demo built around a real agent-market loop:

```text
Research Request
-> Specialist Agents Bid
-> Buyer Selects Best Value
-> Investment Committee Memo Delivered
-> Verification
-> Solana Devnet Settlement
-> Reputation / Persistence Update
```

Core paths:

| Layer | Path | Status |
| --- | --- | --- |
| Web app | `examples/marketplace/web` | Production-style dashboard, presentation mode, Start Market UX |
| API/feed | `examples/marketplace/feed` | Health, session start, feed folding, JSONL persistence |
| Marketplace launcher | `examples/marketplace/start.ts` | Creates CoralOS buyer/seller session graph |
| Buyer agent | `coral-agents/buyer-agent` | WANT, bid scoring, award, verification, escrow deposit/release |
| Seller agent | `coral-agents/seller-agent` | Specialist bidding and investment memo delivery |
| Settlement | `coral-agents/*/src/escrow.ts`, `arbiter.ts` | Solana devnet escrow, arbiter-gated release |
| Data | `providers/` under seller/feed | Live-if-available, deterministic fallback |
| Persistence | `examples/marketplace/feed/src/data` | JSONL records for sessions, bids, memos, settlement, reputation |

The current structure is still starter-kit shaped. A full `apps/` migration is deferred because the demo path is working and should not be disturbed before v1.

## What Works

- `npm run judge` starts bootstrap, health checks, CoralOS, agent images, API, and web dashboard.
- Start Market creates a session without manual session paste.
- CoralOS coordinates independent buyer and seller agents.
- Buyer selects best value, not simply cheapest price.
- The seller returns a structured investment committee memo.
- Deterministic verification gates payment release.
- Solana devnet escrow deposit/release is real.
- Explorer links are surfaced when transactions settle.
- Missing market data API keys do not break the demo.
- Token strategy is documented as future network coordination, not a token launch.

## Fragile Areas

- CoralOS session startup is the highest-risk path because it depends on Docker, local networking, and injected connection URLs.
- Devnet RPC/faucet availability can affect escrow timing.
- The API is single-process and file-backed; it is credible for v1 demos, not high-scale production.
- Reputation is derived from folded market events and persisted snapshots; it is not yet a robust scoring system.
- Mainnet readiness is a settlement abstraction goal, not a current capability.

## Security Risks

- Wallet keypairs must remain in `.env` only.
- Frontend must never receive private keys or provider API keys.
- Devnet escrow amounts must remain controlled by env and buyer budget logic.
- Research output must keep financial-advice disclaimers visible.
- Token strategy must avoid promises of returns, revenue rights, equity, or ownership.

## Deployment Blockers

- Full CoralOS + Docker agent orchestration is easiest in Codespaces or a VM-like host.
- Static frontend can deploy separately, but Start Market needs the API/feed and CoralOS environment.
- Render/Railway/Fly deployment needs Docker/socket strategy documented before public one-click hosting.
- Mainnet settlement is intentionally not enabled.

## Production v1 Scope

Production v1 should be credible, not overbuilt:

- public landing and dashboard experience
- stable Start Market UX
- production-shaped API routes
- JSONL persistence
- live-or-fallback data providers
- Solana devnet settlement proof
- reputation snapshots
- clear docs and deployment guide
- basic typecheck/test/health gates

Out of scope:

- live trading
- mainnet settlement by default
- token sale mechanics
- regulated financial advice
- billing
- enterprise auth
- Sui integration
- complex portfolio management

## Implementation Phases

### Phase 1: Stability And Session UX

- Preserve existing `/api/start` and `/api/feed`.
- Add production aliases: `/health`, `/api/sessions/start`, `/api/sessions/:id`, `/api/market/:id/status`.
- Keep manual session reconnect advanced-only.
- Maintain Codespaces-safe API URL handling.

### Phase 2: Landing Page And Dashboard Polish

- Keep the Start Market path as the primary interaction.
- Use the existing premium institutional dashboard as the v1 app shell.
- Keep token coordination as a secondary roadmap card.

### Phase 3: Data Provider And Persistence

- Keep provider fallback deterministic.
- Persist sessions, bids, buyer decisions, memo outputs, settlement references, and reputation snapshots.
- Document data source modes and timestamps.

### Phase 4: Reputation And Settlement Abstraction

- Promote reputation snapshots into a clearer dashboard/API model.
- Define `SettlementProvider` interface for `createEscrow`, `confirmDeposit`, `releasePayment`, `refundPayment`, `getExplorerUrl`, and `getStatus`.
- Keep Solana devnet as the only implemented provider.
- Document Sui as a future adapter only.

### Phase 5: Docs, Tests, Deployment, CI

- Maintain `npm run health`, `npm run typecheck`, `npm test`, `npm run judge`.
- Add `npm run production-check`.
- Keep GitHub Actions secret-free.
- Document local, Codespaces, and deployment paths.

## Testing Strategy

Use the smallest test set that protects the demo:

- feed folding and event parsing
- buyer scoring logic
- seller bid generation
- memo generation
- provider fallback behavior
- session start API shape
- frontend dashboard rendering with fixtures

## Production v1 Acceptance Criteria

- A new user can clone the repo and run the demo.
- A judge can run it in Codespaces.
- Start Market does not require manual session paste.
- A market session can be created.
- Agents bid.
- Buyer selects a winner.
- Memo is generated.
- Solana devnet settlement status is shown.
- No secrets are committed.
- Docs explain what is real, what is mocked, and how to deploy.
