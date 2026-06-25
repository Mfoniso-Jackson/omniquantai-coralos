# Elevation Plan — From Starter Kit to Competitive Hackathon Infrastructure

**Date:** 2026-06-24  
**Baseline:** Refactored TypeScript monorepo (api-ts + sdk + web + coral-agents)  
**Goal:** A repo where a student forks, fills in one function, and has a live on-chain agentic payment system running on day one.

> **⚠️ Read alongside [`PLAN_VS_REFERENCE.md`](./PLAN_VS_REFERENCE.md).** This plan was first
> written from a docs summary. After cloning the real upstream repos into `ref/`
> (`coral-server`, `solana-pay`, `solana-program-examples`) and reading the source, several
> assumptions changed. The track sections below have been **revised** to reflect the source.
> The headline: **CoralOS is already a Solana-native agent payment marketplace** (CORAL SPL
> token, native x402 proxy, `[[claims]]` monetization, ERC-8004 identity) — so the tracks now
> ride that rail where it exists rather than rebuilding it.

---

## Reference Reconciliation Summary (what the source changed)

| Earlier assumption | Source reality | Effect on tracks |
|---|---|---|
| toml schema "wrong" (edition 3) | Edition 3 valid (min 3, max 5); `spdx` license valid; repo tomls fine as-is | Optional `edition 3→4` bump only |
| `host.docker.internal` is the #1 risk | Already the `DockerConfig.kt` default + repo config already sets it | Dropped from risks |
| MCP tools: 3 names | Confirmed + `coral_wait_for_agent`, `coral_wait_for_message`, thread/participant tools | Buyer drops `setTimeout(4000)` hack |
| Build a hand-rolled HTTP 402 server | CoralOS ships native x402 proxy (`X402ProxyRequest`, budgets, Coinbase standard) | **Track 1 reframed** — native x402 is the headline |
| Solana Pay rail is ours to build | CoralOS payment IS Solana — CORAL SPL mint, Jupiter pricing, Solana wallets, claims | New "CoralOS-native economy" section below |
| `findReference` polling | `watchReference` (subscription) also exists | Track 3 seller wait-loop upgrade |
| (missed entirely) | `[marketplace.identities.erc8004]` on-chain agent identity | New roadmap item |

---

## What the Source (not docs) Reveals

> The original draft of this section claimed the toml schema was "wrong" and that a
> `host.docker.internal` fix was the #1 risk. **Both were overstated** — see the Reconciliation
> Summary table above and `PLAN_VS_REFERENCE.md`. Corrected below.

### coral-agent.toml — already valid

The repo's four `coral-agent.toml` files are **correct as written** (verified against
`ref/coral-server/.../agent/registry/`):
- `edition = 3` is supported (`MINIMUM_SUPPORTED_AGENT_EDITION = 3`, `MAXIMUM = 5`).
- `[agent.license] type = "spdx" expression = "MIT"` is a valid license variant
  (`RegistryAgentLicense.Spdx`).
- Config flows through `[runtimes.docker]` + `[options]` — which the repo already does.

**Only optional change:** bump `edition = 3 → 4` to match the current tested sample. Editions
are not field-gated, so this is a safe, cosmetic alignment — not a correctness fix.

### Windows Docker networking — already handled

`DockerConfig.kt` already defaults `address` to `host.docker.internal` on Windows/Colima, and
the repo's `docs/coral/track-1-config.toml` already sets it explicitly. **No action.** Native
Linux is the only case that might need an override.

### Solana Pay: Transaction Request is the upgrade

The repo currently uses **Transfer Request** (`solana:<pubkey>?amount=X`). This has a limitation: the wallet submits the payment, but the server can't customise what's signed. 

**Transaction Request** (`solana:<HTTPS_URL>`) is architecturally stronger:
- Wallet sends `GET <url>` → server returns `{ label, icon }`
- Wallet sends `POST <url>` with `{ account: "<buyer_pubkey>" }` → server returns `{ transaction: "<base64>" }`
- Wallet signs and broadcasts — the server controls the transaction entirely

This is Track 3's correct protocol. It also unlocks composability: the server can embed Anchor instructions, SPL token transfers, or multi-instruction batches in the returned transaction.

### Reference keys over memo for payment tracking

Current code tracks payments by `memo`. The Solana Pay spec's `reference` field (one or more public keys in the URL query) is more reliable — wallets write them as `ReadOnly` account keys on the transaction, making them indexable by any RPC without string parsing. Use `findReference()` from `@solana/pay` to confirm payment server-side.

---

## Three Tracks — What Each Actually Needs

### Track 1 — Pay-Per-Call API (x402)

**Thesis:** Any endpoint can gate itself behind a micropayment. The payment proof IS the auth token. No accounts, no subscriptions.

> **REVISED per source.** CoralOS ships a **native x402 implementation** (`ref/coral-server/.../x402/`):
> `X402PaymentRequired`, `X402PaymentRequirement`, `X402ProxyRequest`, `X402BudgetedResource`,
> following the Coinbase x402 standard with a **server-side payment proxy** and budget
> enforcement (`withinBudget()`). An agent sends `X402ProxyRequest { endpoint, method, body }`
> and CoralOS negotiates payment on its behalf — agents do **not** hand-parse 402 headers.
> Settlement is in the **CORAL SPL token** (mint `CoRAitPvr9...`), priced to USD via Jupiter.

**Two layers, ship both:**

| Layer | What it is | When to use |
|---|---|---|
| **Headline — native x402** | Buyer sends `X402ProxyRequest` to coral-server; service registered as a `[[claims]]` resource with a USD price | The impressive demo: real agent economy on the CORAL rail |
| **Fallback — bare-metal 402** | Hand-rolled Express `server.ts` emitting `402` + `WWW-Authenticate`, `verify.ts` confirming a SOL transfer | Teaching the mechanism; runs on devnet SOL with **zero CoralOS coupling** |

**What exists:** `PaymentStrategy` parses 402 headers (powers the fallback). `TransferStrategy` generates Solana Pay URLs.  
**What's missing:** the `X402ProxyRequest` buyer wiring (headline); the bare-metal `server.ts`/`verify.ts` (fallback); the LLM buyer loop. Anchor escrow is now the **third** option (trustless-without-CoralOS), not the differentiator.

**Architecture:**
```
Buyer (LLM agent)              Seller (Express server)
─────────────────              ───────────────────────
GET /api/data              →   402 + x-payment-required:
                               { recipient, amountSol, memo, reference }
parse challenge            ←
sign SOL transfer
  (SystemProgram.transfer)
GET /api/data              →   x-payment-proof: <txSig>
  with proof header             verify txSig on-chain
                               findReference(reference[]) → confirm
                           ←   200 { data: "..." }
```

**Files to build:**
```
examples/track-1-pay-per-call/
  server.ts          Express seller: GET /data → 402 → verify → serve
  buyer.ts           LLMBuyerStrategy: Claude Haiku drives the 402 loop
  verify.ts          findReference() + confirmTransaction wrapper
  README.md
  .env.example

  anchor-escrow/     (optional upgrade submodule)
    programs/escrow/src/lib.rs    3 instructions: initialize, claim, refund
    client/escrow_client.ts       typed TS client from IDL
    tests/escrow.ts               LiteSVM localnet tests
```

**`LLMBuyerStrategy`** goes in `sdk/agent-core-ts/src/strategies/llm_buyer.ts` after the standalone buyer.ts is proven. Claude Haiku uses two tools: `fetch_data` (detects 402, returns challenge) and `pay_and_retry` (signs transfer, re-fetches). Tool loop terminates when fetch returns 200.

**Reference-key tracking (replaces memo):**
```typescript
// seller generates a new Keypair per request — its pubkey is the reference key
const reference = Keypair.generate()
const url = encodeURL({
  recipient: sellerPubkey,
  amount: new BigNumber(amountSol),
  reference: [reference.publicKey],  // embedded in tx as ReadOnly account
  label: 'Agent Data Service',
})
// seller stores reference.publicKey → waits for findReference() to succeed
```

---

### Track 2 — Agent-to-Agent Trading

**Thesis:** Two autonomous agents discover each other's price and settle on-chain without any human involvement.

> **REVISED per source.** This is the **dependency-light** track. CoralOS *does* have native
> agent-to-agent payment (claims/budgets), but Track 2 deliberately stays standalone: raw SOL
> transfer, in-process `MessageBus`, no CoralOS required. It runs with just `sdk/agent-core-ts`
> and two funded devnet wallets. One source-driven upgrade: when this runs *under* CoralOS, use
> the real **`coral_wait_for_agent`** MCP tool to block until the seller is present — replacing
> the `setTimeout(4000)` boot-wait hack currently in `buyer-agent/src/index.ts`.

**What exists:** `AgentManager`, `MessageBus`, `SharedState`, `HeliusMonitorStrategy`, `TransferStrategy`. The buyer/seller coral-agents.  
**What's missing:** `AutoBuyerStrategy`. The in-process orchestration script (`run.ts`). The two-panel frontend.

**Architecture (all in one Node.js process):**
```
AgentManager
  ├── seller-agent  (SellerStrategy)
  │     on start: generate Solana Pay URL → SharedState["seller.payUrl"]
  │     on HeliusMonitorStrategy fires: record "payment-received"
  │     handleMessage("request-data") → return data payload
  │
  └── buyer-agent  (AutoBuyerStrategy)
        poll SharedState["seller.payUrl"] until present
        parse URL → extract recipient + amount
        if amount ≤ BUYER_BUDGET: sign SystemProgram.transfer
        await confirmation
        handleMessage("seller", "request-data")
        record data in own action log
```

**Files to build:**
```
examples/track-2-agent-trading/
  run.ts               creates both agents, starts them, wires MessageBus
  seller_strategy.ts   extends TransferStrategy: URL → SharedState → Helius watch
  buyer_strategy.ts    AutoBuyerStrategy: SharedState poll → sign → dispatch
  README.md
  .env.example
```

**Key technical point:** Track 2 has no HTTP 402 and no MCP. Agents communicate via `MessageBus.direct()` inside the same process. The Helius WebSocket fires the delivery. This is the most self-contained track — it works with just `sdk/agent-core-ts` and two Solana wallets.

---

### Track 3 — Consumer Checkout (Transaction Request)

**Thesis:** A human connects Phantom and pays with one click. Zero friction — no wallet address, no copy-paste, no QR scan.

> **REVISED per source.** Largely unchanged — CoralOS x402/claims is for *agent* payment, but
> here a *human* pays, so Solana Pay **Transaction Request** is correct and confirmed against
> `ref/solana-pay/typescript/packages/solana-pay/core/src/` (`fetchTransaction`, `parseURL`,
> `encodeURL`, `plugins/merchant.ts`). Two upgrades the original plan missed: use
> **`watchReference`** (subscription) instead of polling `findReference` in the seller's
> payment wait-loop, and lean on the **merchant plugin** rather than hand-rolling the POST
> handler.

**What exists:** The current `web/` Phantom flow (Transfer Request — buyer builds tx client-side).  
**What's missing:** The Transaction Request server route (server builds tx, Phantom signs). The minimal HTML fallback. `watchReference`-based status confirmation.

**Architecture:**
```
Browser                         api-ts server
───────────────────             ──────────────────────────────
GET /api/v1/checkout/:agentId → { label: "Weather Agent", icon: "..." }
POST /api/v1/checkout/:agentId  body: { account: "<buyer_pubkey>" }
                              → { transaction: "<base64_serialised_tx>" }
Phantom.signAndSendTransaction
poll GET /api/v1/checkout/status/:sig
                              ← { status: "confirmed", result: "..." }
```

**Files to build:**
```
api-ts/src/checkout.ts      two routes: GET (label) + POST (build tx) + GET status
examples/track-3-consumer-checkout/
  web/index.html            single HTML file, wallet-adapter CDN, no framework
  README.md
  .env.example
```

**Why Transaction Request > Transfer Request for Track 3:**
With Transfer Request, the client builds the transaction — so the server can't enforce the exact recipient, amount, or memo. With Transaction Request, the server builds it. Students can embed any instruction (including Anchor calls) inside the returned transaction. Phantom just signs what the server hands it.

---

## The Three Tracks as One Spectrum (post-reconciliation)

The source findings turn three separate demos into a coherent progression — a stronger story:

| Track | Payer → Payee | Rail | Coupling | Positioning |
|---|---|---|---|---|
| **2** | agent → agent | raw SOL transfer, in-process `MessageBus` | none (just the SDK) | runs anywhere, devnet, dependency-light |
| **1** | agent → agent | **CoralOS native x402 + CORAL token** | CoralOS payment SDK | the real agent economy (headline); bare-metal 402 fallback for portability |
| **3** | human → agent | Solana Pay Transaction Request | Phantom + RPC | consumer checkout |

You are no longer "building a payment system." You are demonstrating the same agent-economy
idea at three integration levels: bare SOL → native CoralOS x402 → human checkout.

---

## CoralOS-Native Economy (the layer the original plan missed)

Verified in `ref/coral-server/`:

- **CORAL is a Solana SPL token.** `config/PaymentConfig.kt`:
  `CORAL_MAINNET_MINT = "CoRAitPvr9seu5F9Hk39vbjqA1o1XuoryHjSk1Z1q2mo"`,
  `CORAL_DEV_NET_MINT = "FBrR4v7NSoEdEE9sdRN1aE5yDeop2cseaBbfPVbJmPhf"`.
- **Solana wallets are first-class.** `config/Wallet.kt`: sealed `Wallet` = `Solana` |
  `CrossmintSolana`, `SolanaCluster {MAIN,DEV,TEST}_NET`, backed by
  `org.coralprotocol.payment.blockchain` (a real on-chain payment SDK dependency).
- **x402 payment proxy.** `x402/` — Coinbase x402 standard; agents send `X402ProxyRequest`,
  server enforces `X402BudgetedResource.withinBudget()`.
- **Agent claims = monetization.** `agent/payment/` (`PaidAgent`, `AgentClaimRequest/Result`)
  + toml `[[claims]] { name, description, dependency, cost }` priced in atomic CORAL units;
  `JupiterService` converts CORAL ↔ USD.
- **ERC-8004 on-chain identity.** toml `[marketplace.identities.erc8004] { wallet, endpoints }` —
  verifiable agent identity, the trustless-agent standard.

**Decision — MADE (2026-06-24):** **default to standalone, document native x402 as the upgrade.**
Track 1 ships on devnet SOL with zero CoralOS payment coupling out of the box; the native x402 +
CORAL-token path is a documented "advanced layer" students opt into. This keeps day-one friction
low (no CORAL token, no coral-server wallet config required to run) while the README still shows
the real ceiling. Track READMEs reflect this framing.

---

## SDK Upgrades

### New strategy: `LLMBuyerStrategy`

`sdk/agent-core-ts/src/strategies/llm_buyer.ts`

```typescript
export interface LLMBuyerConfig {
  endpoint: string          // seller's data API URL
  budgetLamports: number    // max spend per session
  goal: string              // system prompt for Claude
  model?: string            // defaults to claude-haiku-4-5-20251001
}
```

Two Claude tools exposed to the model:
- `fetch_data({ endpoint })` — fetches endpoint, returns body or `{ status: 402, challenge: {...} }`
- `pay_and_retry({ challenge, keypairB58 })` — signs transfer, re-fetches, returns response body

Claude drives the loop. The strategy calls `anthropic.messages.create()` with the tool definitions and iterates on `tool_use` blocks until it gets a `text` block (the final answer). This is the first strategy in the SDK that uses an LLM — it establishes the pattern for all subsequent Claude-powered strategies.

### New strategy: `SolanaReferenceStrategy`

`sdk/agent-core-ts/src/strategies/reference.ts`

Replaces memo-based payment tracking with reference key tracking:

```typescript
// generateUrl(): creates a new Keypair per payment request, embeds publicKey as reference
// verify(txSig): calls findReference(connection, reference.publicKey) from @solana/pay
// No string matching — on-chain indexed lookup
```

### Fix: `TransferStrategy` reference support

Add `reference?: PublicKey[]` to `TransferConfig`. `@solana/pay`'s `encodeURL` already accepts it. Seller can now use `findReference()` on-chain instead of parsing memo strings.

### New `startCoralAgent` standalone export

`sdk/agent-core-ts/src/coral_mcp_server.ts`

Extracted from `coral_mcp.ts` into a standalone process entrypoint. The key insight from the CoralOS docs: the current `coral_mcp.ts` acts as a *client* embedded in `api-ts`. For Docker-based CoralOS agents, each agent IS its own process. The standalone entrypoint:

```typescript
export async function startCoralAgent(
  config: { agentName: string; version?: string },
  handler: (ctx: AgentContext) => Promise<void>
): Promise<void>
```

Where `AgentContext` exposes `send()`, `waitForMention()`, `createThread()`, `reply()`. The buyer-agent and seller-agent already call `startCoralAgent` — they just need the underlying implementation to work as a true standalone process.

---

## Infrastructure Upgrades

### 1. coral-agent.toml — optional edition bump only

The four tomls are valid as-is. Optional alignment: bump `edition = 3 → 4` across
`helius_monitor`, `user_proxy`, `buyer-agent`, `seller-agent`. Keep `[agent.license] type="spdx"`
and the existing `[options]`. ~~Required `[agent.license]`~~ already present; ~~typed options~~
already correct.

### 2. ~~Docker Windows fix~~ — NOT NEEDED

`DockerConfig.kt` defaults to `host.docker.internal`; `track-1-config.toml` already sets it.
Removed from scope.

### 3. Dockerfile COPY paths

Current Dockerfile in seller/buyer agents tries:
```dockerfile
COPY ../../../sdk/agent-core-ts/ ./sdk/agent-core-ts/
```
Docker `COPY` cannot traverse above the build context. Fix: set the docker build context to the repo root (`context: .`) in `docker-compose.yml` and reference paths from there:
```yaml
build:
  context: ../..
  dockerfile: coral-agents/seller-agent/Dockerfile
```

### 4. `--no-docker` fallback

For students who can't run Docker Desktop (Windows corporate laptops, CI environments):
```sh
npm run dev:track-1    # runs seller + buyer as local Node.js processes
npm run dev:track-2    # runs two agents in same process
npm run dev:track-3    # runs just api-ts with checkout routes
```
Add `dev:track-*` scripts to root `package.json` that call `tsx` directly on each track's `run.ts`.

### 5. Pre-compiled Anchor IDL

Don't make hackathon students run `anchor build`. Ship:
```
examples/track-1-pay-per-call/anchor-escrow/
  target/idl/escrow.json     ← pre-built IDL
  target/deploy/escrow.so    ← pre-built BPF binary
  client/escrow_client.ts    ← generated TS client
```
Only students who modify the Anchor program need the Rust toolchain.

### 6. Web — three track pages

Add to `web/app/`:
```
track-1/page.tsx    Pay-Per-Call dashboard: session feed + escrow PDA status
track-2/page.tsx    Agent Trading terminal: two-panel live action log + settlement bar
track-3/page.tsx    Consumer Checkout: Phantom connect + pay button + result card
```

Each page polls `GET /api/v1/agents/:id` every 2s for the live action log. Track 3 additionally polls `GET /api/v1/checkout/status/:sig` after payment.

---

## Build Order (strict — gate applies)

```
Phase 0  Infrastructure (quick — most was non-issues)
──────────────────────────────────────────────────────
  0a. (optional) Bump coral-agent.toml edition 3 → 4 for alignment
  0b. Fix Docker build context in all docker-compose.yml files
  0c. (dropped — host.docker.internal is already the default)
  0d. Fix .env.example: add ANTHROPIC_API_KEY, BUYER_KEYPAIR_B58, PRICE_SOL

Phase 1  GATE — prove MCP works (1 day)
──────────────────────────────────────
  1a. Run `docker compose -f examples/track-2-agent-trading/docker-compose.yml up coral`
  1b. Manually POST a session request to CoralOS (HTTP, not via code)
  1c. Manually send a @mention into the thread
  1d. Confirm buyer-agent or seller-agent receives the mention and replies

  DO NOT PROCEED TO PHASE 2 UNTIL A TYPESCRIPT CONTAINER REPLIES TO A MENTION.

Phase 2  Track 1 core — 402 loop (1 day)
─────────────────────────────────────────
  2a. examples/track-1-pay-per-call/verify.ts (findReference + confirmTransaction)
  2b. examples/track-1-pay-per-call/server.ts (Express 402 seller)
  2c. examples/track-1-pay-per-call/buyer.ts  (Claude Haiku tool loop)
  2d. End-to-end test: node server.ts + node buyer.ts → logs show "payment confirmed + data received"

Phase 3  Extract LLMBuyerStrategy (2h)
──────────────────────────────────────
  3a. sdk/agent-core-ts/src/strategies/llm_buyer.ts (extracted from buyer.ts)
  3b. Export from sdk/agent-core-ts/src/index.ts
  3c. Update buyer.ts to use it

Phase 4  Track 2 — in-process agent trading (1 day)
────────────────────────────────────────────────────
  4a. examples/track-2-agent-trading/seller_strategy.ts
  4b. examples/track-2-agent-trading/buyer_strategy.ts
  4c. examples/track-2-agent-trading/run.ts
  4d. End-to-end test: node run.ts → both agents exchange payment + data

Phase 5  Track 3 — Transaction Request (1 day)
───────────────────────────────────────────────
  5a. api-ts/src/checkout.ts (3 routes: GET label, POST build-tx, GET status)
  5b. examples/track-3-consumer-checkout/web/index.html (plain HTML, CDN adapters)
  5c. web/app/track-3/page.tsx (Next.js version)

Phase 6  Track frontends (1 day)
─────────────────────────────────
  6a. web/app/track-1/page.tsx
  6b. web/app/track-2/page.tsx
  6c. web/app/track-3/page.tsx (from 5c)

Phase 7  Anchor escrow — Track 1 upgrade (2 days, optional)
────────────────────────────────────────────────────────────
  7a. programs/escrow/src/lib.rs (initialize, claim, refund instructions)
  7b. anchor build + anchor deploy --provider.cluster devnet
  7c. copy IDL to examples/track-1-pay-per-call/anchor-escrow/target/idl/
  7d. client/escrow_client.ts (generated from IDL)
  7e. Update server.ts to optionally use escrow mode (ESCROW_MODE=true)
  7f. tests/escrow.ts (LiteSVM)
```

---

## Exact Files to Create / Modify

### New files

```
sdk/agent-core-ts/src/strategies/llm_buyer.ts
sdk/agent-core-ts/src/strategies/reference.ts

api-ts/src/checkout.ts

examples/track-1-pay-per-call/
  server.ts
  buyer.ts
  verify.ts
  README.md
  .env.example
  anchor-escrow/
    programs/escrow/src/lib.rs
    programs/escrow/Cargo.toml
    client/escrow_client.ts
    tests/escrow.ts
    target/idl/escrow.json       (pre-built)

examples/track-2-agent-trading/
  run.ts
  seller_strategy.ts
  buyer_strategy.ts
  README.md
  .env.example

examples/track-3-consumer-checkout/
  web/index.html
  README.md
  .env.example

web/app/track-1/page.tsx
web/app/track-2/page.tsx
web/app/track-3/page.tsx

docs/coral/track-1-config.toml
docs/coral/track-2-config.toml
docs/coral/track-3-config.toml
```

### Modified files

```
coral-agents/seller-agent/coral-agent.toml    edition 3 → 4 (optional)
coral-agents/buyer-agent/coral-agent.toml     edition 3 → 4 (optional)
coral-agents/helius_monitor/coral-agent.toml  edition 3 → 4 (optional)
coral-agents/user_proxy/coral-agent.toml      edition 3 → 4 (optional)
coral-agents/seller-agent/Dockerfile          fix build context paths
coral-agents/buyer-agent/Dockerfile           fix build context paths
sdk/agent-core-ts/src/strategies/transfer.ts  add reference[] support
sdk/agent-core-ts/src/index.ts                export LLMBuyerStrategy, ReferenceStrategy
api-ts/src/app.ts                             mount checkout.ts routes
.env.example                                  add ANTHROPIC_API_KEY, BUYER_KEYPAIR_B58, PRICE_SOL
```

---

## What Each Track Becomes as a Real Product

| Track | Swap `service.ts` to deliver | Real product |
|-------|------------------------------|-------------|
| 1 | Claude API inference | "Pay per LLM call, no account" |
| 1 | Proprietary data feed | "Institutional data oracle, per query" |
| 2 | BirdEye trending tokens | "Autonomous alpha-buying agent" |
| 2 | GPU compute | "Agent bidding for inference time" |
| 3 | News API | "Pay-per-article, crypto-native Substack" |
| 3 | AI image | "Pay SOL, get DALL-E output, no signup" |

The payment rail, monitoring, and CoralOS coordination are identical for all of them. Students compete on what they put in one function.

---

## What Students Do on Day One

```sh
# 1. Fork and clone
gh repo fork trilltino/pay --clone && cd pay

# 2. Add credentials
cp .env.example .env
# edit: HELIUS_API_KEY, ANTHROPIC_API_KEY, BUYER_KEYPAIR_B58, SELLER_WALLET

# 3. Pick a track
docker compose -f examples/track-1-pay-per-call/docker-compose.yml up
# OR: npm run dev:track-1   (no Docker needed)

# 4. Open localhost:3000/track-1 — live system running

# 5. Fork the service
code coral-agents/seller-agent/src/service.ts
# replace deliverService() with their idea

# 6. Rebuild
docker compose -f examples/track-1-pay-per-call/docker-compose.yml up --build

# Their hackathon entry is live.
```

---

## What Makes This Genuinely Advanced Infrastructure

When these tracks are built:

- **Real on-chain settlement** — not simulated. Every transfer is a confirmed Solana devnet transaction with an Explorer link.
- **LLM-native payment loop** — Claude Haiku autonomously discovers a payment gate, evaluates the price, decides to pay, and retries. This is the canonical architecture for agent economies.
- **Trustless escrow** — Anchor program prevents either party from cheating. The seller cannot take funds without delivering; the buyer cannot get data without paying.
- **Transaction Request** — the server controls what gets signed. This is the architecture for any agentic checkout, DeFi integration, or NFT mint that needs server-side logic at the point of payment.
- **CoralOS multi-agent coordination** — agents in different Docker containers coordinate via MCP mentions, with Helius WebSocket firing the delivery trigger. This is a real multi-process distributed system.

That combination — LLM autonomy + on-chain settlement + trustless escrow + multi-agent coordination — is advanced. The individual pieces are standard; the integration is what elevates it.
