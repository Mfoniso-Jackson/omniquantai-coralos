# To-Build Completion Plan — Two-Track SOL Kit (revised)

**Date:** 2026-06-25 (revised after the Gate-C investigation)
**Goal:** A clean **two-track**, SOL-path kit where every example runs end-to-end, the proven work
is committed, and the native-x402/CORAL dead end is removed (documented, not shipped).
**Companion docs:** [`IMPLEMENTATION_SPEC.md`](./IMPLEMENTATION_SPEC.md),
[`ELEVATION_PLAN.md`](./ELEVATION_PLAN.md), [`PLAN_VS_REFERENCE.md`](./PLAN_VS_REFERENCE.md).

> **What changed from the first draft.** Three things we *proved* by testing this session:
> 1. **Native x402 settlement is not completable** in the published coral-server — the feature is
>    half-built upstream (the session's `x402Budgets` never wires to `SessionAgent`, the handler is
>    TODO-laden, the funding path is commented out). Fixing the wallet-load crash got the native
>    engine *live* on devnet, but settlement can't complete. So x402/CORAL is **dropped from the
>    product** and kept only as a documented finding. See `IMPLEMENTATION_SPEC.md` Gate C.
> 2. **Going to two tracks** (decided): keep **Track 1 (agent pays)** and **consumer checkout
>    (human pays)**; **drop agent-to-agent trading** (overlaps Track 1's thesis and is fully unbuilt).
> 3. **CoralOS still earns its place** for *coordination* (Gate A — agents joining sessions over MCP
>    — is proven live). Only the CoralOS *native payment* layer (x402/CORAL) is removed. Agents
>    coordinate via CoralOS and pay in **SOL** (Gate B), which is proven on-chain.

---

## The two tracks we keep

| Track | Who pays | How | Status |
|-------|----------|-----|--------|
| **Track 1 — Pay-Per-Call** | an agent | hits HTTP 402, pays SOL, gets data; LLM buyer decides to pay | ✅ settlement proven on devnet (Gate B) |
| **Track 2 — Consumer Checkout** *(was track-3)* | a human | Phantom one-click, Solana Pay Transaction Request | flow exists in `web/`; needs `checkout.ts` + `index.html` |

**Dropped:** `examples/track-2-agent-trading/` (agent-to-agent) — unbuilt and overlaps Track 1.

---

## 0. PRIORITY 1 — commit the proven work (do this FIRST)

The biggest risk right now isn't an unbuilt track — it's that **everything proven this session is
uncommitted** (Gates A & B, the live settlement, `LLMBuyerStrategy`, the smoke harness, SDK edits,
echo-agent). A fresh clone sees none of it. Land it before changing more, so nothing is lost and a
bisect can isolate any break.

**Pre-flight:** we're on `main` → **branch first** (`git switch -c <branch>`). Confirm `.gitignore`
excludes `node_modules/`, `ref/`, and any keypair before `git add` (a stray `node_modules` commit is
the classic mistake). Commit in themed steps (§5), each typechecking on its own.

---

## 1. Removals — strip the x402/CORAL dead end

Delete (native-x402 product surface — proven non-functional upstream):
- `examples/track-1-pay-per-call/server-x402.ts`
- `examples/track-1-pay-per-call/buy-x402.ts`
- `scripts/smoke/smoke-x402.ts`
- The "Layer A / native x402" sections of `examples/track-1-pay-per-call/README.md`
- Any CORAL/Gate-C "to ship" language in track docs (keep the *finding* in `IMPLEMENTATION_SPEC.md`)

Drop the agent-trading track:
- `rm -rf examples/track-2-agent-trading/`
- Rename `examples/track-3-consumer-checkout/` → `examples/track-2-consumer-checkout/`; fix any
  `track-3` references (web route `web/app/track-3/` → `track-2`, READMEs, compose files).

**Keep** (CoralOS coordination — works): `coral_mcp_server.ts`, `echo-agent`, the buyer/seller MCP
agents, `smoke-mcp.ts`. These pay in SOL, not x402.

> The patched coral-server + `WalletDecoder` fix stays in `ref/` (gitignored) as a reference; it's
> a genuine upstream bug fix worth filing, not a product dependency.

---

## 2. Track 1 — finish (mostly marker hygiene + verify)

1. **Flip stale `[to build]` markers** in `README.md`: `server.ts`, `buyer.ts`, `verify.ts` → ✓.
   Remove the x402 rows (deleted above).
2. **Verify the bare-metal layer** — already proven live this session: `npm run server` +
   on-chain payment settled (devnet tx `3g2wQri9…`, seller received 0.0001 SOL). Note it in the
   README as verified. The LLM-decision leg needs an `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` if we
   make the buyer provider-flexible — open question below).
3. `anchor-escrow/`: confirm `anchor build` succeeds or note the toolchain requirement. (Optional —
   it's the trustless-without-CoralOS extra, not on the critical path.)

## 3. Track 2 (consumer checkout) — build the two missing pieces

- **`api-ts/src/checkout.ts`** — Express router, three routes, wired into `app.ts`:
  - `GET  /api/v1/checkout/:agentId` → `{ label, icon }`
  - `POST /api/v1/checkout/:agentId` (`{ account }`) → server builds `Transaction`
    (`SystemProgram.transfer` buyer→seller + reference key) → `{ transaction: base64 }`
  - `GET  /api/v1/checkout/status/:sig` → `watchReference()` → `{ status, result }`
  - Fork point: `deliver()` (default: live weather).
- **`web/index.html`** — framework-free, wallet-adapter via CDN: connect Phantom → `POST /checkout`
  → `signAndSendTransaction` → poll status → render. The real entry to run api-ts is
  `cd api-ts && npm run dev` (`src/index.ts`) — README already fixed.

**Acceptance:** `cd api-ts && npm run dev` exposes the 3 routes (curl the GETs); open `web/index.html`
with Phantom on devnet → one-click pay → result renders sub-second via `watchReference`.

---

## 4. Cross-cutting acceptance gate

- [ ] `npm run typecheck` clean in each track dir **and** `api-ts/` + `sdk/agent-core-ts/`.
- [ ] Every README command copy-pastes and runs; every "Files" row exists; markers reflect reality.
- [ ] `.env.example` lists exactly the vars the code reads.
- [ ] No secrets / funded mainnet keypair / `node_modules` / `ref/` staged (devnet only).
- [ ] No remaining `track-3` references after the rename; no remaining x402/CORAL product surface.
- [ ] `scripts/smoke/` (smoke-buyer / smoke-mcp) pass or are documented as manual.

## 5. Commit sequence

On a fresh branch off `main`, in this order (each typechecks on its own; co-author trailer per repo):

1. `chore: planning docs + .gitignore` — `.claude/*.md`, ensure `ref/` and `node_modules/` ignored.
2. `feat(sdk): log util + coral_mcp waitForAgent + standalone entrypoint`.
3. `feat(buyer-agent): LLMBuyerStrategy + signTransfer`.
4. `feat(track-1): bare-metal pay-per-call seller + LLM buyer + on-chain verify`.
5. `feat(coral-agents): echo-agent + edition-4 tomls; remove helius_monitor`.
6. `chore(smoke): smoke-mcp + smoke-buyer`.
7. `refactor: drop agent-trading track + native-x402 surface; rename checkout track-3→2`.
8. `feat(track-2): consumer-checkout routes + framework-free html` (after §3 built).

## 6. Build order

```
Commit proven work  →  Remove x402/CORAL + drop agent-trading + rename  →  Finish Track 1  →  Build Track 2 (checkout)
   (safety first)         (clean to two tracks)                            (markers+verify)     (the one real build left)
```

## 7. Decisions & open questions

**Resolved (2026-06-25):**
1. ✅ **Gate C / native x402:** dropped from product — proven half-built upstream (3 bugs).
   Documented in `IMPLEMENTATION_SPEC.md`; the `WalletDecoder` fix kept in `ref/` for an upstream report.
2. ✅ **Two tracks:** keep Track 1 (agent pays) + consumer checkout (human pays); drop agent-trading.
3. ✅ **api-ts entrypoint:** README points at `cd api-ts && npm run dev` (`src/index.ts`), not a
   redundant `server.ts`. (Track 1's own `server.ts` references are correct — that's the seller file.)
4. ✅ **CoralOS:** kept for coordination (Gate A proven); only its native-payment layer removed.

**Open:**
5. ⏳ **LLM provider for the buyer:** code currently calls Anthropic/Claude. If you only have an
    OpenAI/"Codex" key, make `LLMBuyerStrategy` + the seller's inference example provider-flexible
    (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`). Low-stakes; flag your preference.
6. ⏳ **Track 2 dashboard wiring:** the Next.js `track-2` page polls `api-ts /api/v1/agents`. For
    consumer checkout this is informational only — decide whether to keep the live agent feed or
    simplify the page to just the checkout flow.
