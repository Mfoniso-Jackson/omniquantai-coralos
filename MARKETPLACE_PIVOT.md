# The Pivot — one example: an LLM agent marketplace, escrow-settled, on CoralOS

> **Goal:** collapse the kit to **one headline example** — an open marketplace where **LLM** agents
> compete in a shared **CoralOS** session and settle every trade through the **Solana escrow contract**
> (reference-bound deposit → deliver → release/refund). Remove every other example and all bloat. Make
> the abstraction **transparent**, not a black box.

---

## The thesis (your slide)

> **An open marketplace where LLM agents compete in a shared CoralOS session and settle every deal
> through a Solana escrow contract.** Reason (LLM) · coordinate (CoralOS) · settle trustlessly (Solana).

Three pillars, each load-bearing — and the **contract** deepens the Solana pillar from "pay" to
"conditional settlement between strangers":

| Pillar | Job | Remove it → |
|--------|-----|-------------|
| **LLM** | sellers decide whether/how much to bid; buyer judges best value | static vending bank |
| **CoralOS** | shared market thread; dynamic discovery; multi-party | point-to-point pipes |
| **Solana (Pay + escrow)** | a **reference** binds the deal; the **escrow contract** releases funds only on delivery, refunds after a deadline | trust-me play money |

**The goods** under the pillars: external APIs (Jupiter, Helius, CoinGecko, on-chain reads) are the
*inventory* the agents trade. The theme is **"the Solana Data Market"** — concrete, on-thesis,
open-extensible (`deliverService` still sells anything).

## Decisions baked in (veto any)

1. **One example only.** `examples/marketplace/`. Everything else is deleted (see §Debloat).
2. **Escrow is the settlement spine** — not optional. Every trade deposits → delivers → releases.
3. **Themed Solana Data Market**, open via `deliverService`.
4. **Provider modular, Anthropic default.** `complete()` picks by env; flip the whole market to the
   sponsored `OPENAI_API_KEY` with `LLM_PROVIDER=openai`, zero code change.
5. **Pure TypeScript.** The Python `user_proxy` and the human web UI are **cut** (→ #1 re-add).

---

## The settlement spine — escrow, not direct transfer

Every trade in the market is escrow-protected. The Solana Pay **reference** the market mints is the
*same key* that seeds the escrow PDA — so Pay and the contract interlock with no new identifier.

```
buyer    WANT   round=7 service=helius-risk arg=7jw… budget=0.001        (→ market, @sellers)
premium  BID    round=7 price=0.0006 by=seller-premium note="verified"   (self-selects via LLM)
lazy     BID    round=7 price=0.0008 by=seller-lazy    note="full report"
              ⏲ buyer holds a 5s bid window
buyer    AWARD  round=7 to=seller-premium  reason="verified score is better value than a bundled report"
premium  ESCROW_REQUIRED round=7 reference=R amount=0.0006 deadline=600
buyer    ── deposit(program, buyer, premium, R, 0.0006, 600) ──▶  🔒 funds locked in PDA(buyer,R)
buyer    DEPOSITED round=7 reference=R pda=<addr> sig=<deposit>
premium  ── isFunded(program, buyer, premium, R) ✓ on-chain ──▶  delivers
premium  DELIVERED round=7 {riskScore: 41, flags:[…]}
buyer    ── release(program, buyer, premium, R) ──▶  💸 seller paid, escrow closed (rent → buyer)
buyer    RELEASED round=7 sig=<release>
              … or, if no DELIVERED by the deadline:
buyer    ── refund(program, buyer, R) ──▶  ↩ funds returned;  REFUNDED round=7
```

Now **all three pillars are visibly load-bearing in one flow**: LLM bids/justifies, CoralOS routes the
multi-party thread, and the contract makes payment *conditional on delivery* — a stranger-seller can't
take the money without delivering, and the buyer can't stiff a seller who did.

The escrow program is **already deployed to devnet**
([`R5NW…CeXet`](https://explorer.solana.com/address/R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet?cluster=devnet)),
so the demo runs without deploying; forkers redeploy with `anchor deploy`.

---

## Debloat — what gets deleted

**Examples (remove all but the marketplace):**
```
rm -r examples/agent-economy/autonomous     # the old 1:1 demo
rm -r examples/agent-economy/quickstart     # no-Docker 402 tutorial
rm -r examples/agent-economy/bridge         # human front door  → #1 re-add
rm -r examples/agent-economy/web            # multi-tab React app → #1 re-add
```

**Agents (remove what the one example doesn't use):**
```
rm -r coral-agents/echo-agent               # connectivity hello-world — the market proves connectivity
rm -r coral-agents/user_proxy               # Python puppet — only the human bridge needed it
rm -r coral-agents/broker                   # repositioned; lift its pure logic into market.ts
```
Keep: `seller-agent`, `buyer-agent`, `seller-cheap`/`-premium` (+ new `seller-lazy`) configs.

**Scripts & smoke tests for removed paths:**
```
rm scripts/provision-swarm.js scripts/smoke/smoke-mcp.ts scripts/smoke/smoke-buyer.ts
rm examples/agent-economy/bridge/smoke.ts   # (with the bridge)
```
Keep: `setup.js` (wallets), `doctor.js` (trim to the marketplace path).

**Runtime:** drop `payFromUrl` (direct transfer is gone — escrow only). Keep the reference +
connection + verify helpers.

**Result:** one example, five agents (1 buyer + 3 sellers + the shared seller image), the escrow
contract, the runtime. No Python. No unused framework. Nothing the headline doesn't run.

---

## Move 1 — the runtime is the pillars (lift + dedupe)

`packages/agent-runtime` becomes exactly the three primitives a market agent stands on:

- **CoralOS** → `coral_mcp*` + `startCoralAgent` (already there).
- **Solana** → `solana_pay.ts` (lift the duplicated `generatePaymentUrl`/`verifyPayment`/base58 loader
  out of the agents — the audit's duplication finding), + `solana.ts` (the devnet guard).
- **LLM** → `llm.ts`, an SDK-free `fetch` shim:

```ts
function pickProvider(): 'anthropic' | 'openai' {
  const p = process.env.LLM_PROVIDER?.toLowerCase()
  if (p === 'openai' || p === 'anthropic') return p   // explicit wins
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'anthropic'                                  // default — your dev key
}
export async function complete(o: { system: string; user: string; model?: string }): Promise<string>
```

**The escrow contract** stays where it is (`examples/agent-economy/escrow/`, the program + Anchor
client). The buyer & seller agents depend on its client via a `file:` link, so **Anchor stays out of
the runtime** (it stays light). Extend the client with `escrowPda(buyer, ref)` and
`isFunded(program, buyer, seller, ref)` for the seller's funded-check.

---

## Move 2 — the one example: `examples/marketplace/`

```
examples/marketplace/
├─ start.ts     # launches buyer(MARKET=1) + 3 persona sellers as one session graph
├─ README.md    # run steps + "what you'll see" + the trace-mode hint
└─ package.json
```

- **`market.ts` (+ `market.test.ts`)** — pure, testable protocol logic: `parseWant`, `parseBid`,
  `pickWinner` (lifts `broker/logic.ts`'s `pickCheapest`), the bid-window reducer.
- **`seller-agent/bidder.ts`** — LLM decides `{bid, price, note}`; **code enforces** service-match +
  floor + budget (mirrors `llm_buyer.ts`). On `AWARD to=me`: `ESCROW_REQUIRED` → wait for
  `DEPOSITED` → `isFunded` ✓ → `deliverService` → `DELIVERED`.
- **`buyer-agent` `MARKET=1` mode** — `waitForAgent` gate → `WANT` → collect bids (5s) → LLM
  best-value selection (deterministic cheapest fallback) → `AWARD` → `deposit` → on `DELIVERED`,
  `release`; on deadline, `refund`.

### Personas (the competition, one key)

`seller-cheap`/`-premium` are config-only, so personas are a TOML edit:

| Seller | Persona | Floor | Inventory |
|--------|---------|-------|-----------|
| `seller-cheap` | aggressive discounter | 0.0002 | Jupiter quote, CoinGecko price |
| `seller-premium` | premium, verified | 0.0005 | Helius wallet-risk, on-chain reads |
| `seller-lazy` (new) | only big jobs | 0.0004 | LLM report (buys raw + resells) |

Same provider key, different prompt/floor/inventory → real competition; the buyer's one-line reason
makes the LLM visible.

---

## Move 3 — fix the black boxes (deeply)

The risk of `startCoralAgent`/`solana_pay`/`complete` is that a student ships without *understanding*
the pillars. Four concrete defenses:

1. **TRACE mode (`TRACE=1`).** Every primitive logs what it really does:
   - `startCoralAgent` prints each underlying `coral_*` tool call (`→ coral_send_message thread=… mentions=…`).
   - `solana_pay`/escrow print every on-chain action with an **Explorer link** — the deposit sig, the
     release sig, **and the escrow PDA address**. The chain is never hidden; you can click it.
   - `complete` prints provider + model + the raw decision JSON before guards run.
   The box becomes glass with one env var.
2. **"How it really works" in `docs/MARKETPLACE.md`** — a line-by-line map of the transcript: each
   message → the CoralOS tool that carried it; each settlement step → the on-chain instruction +
   what the PDA holds. The demo doubles as the lesson.
3. **"Under the hood" per primitive** — a short doc section for each: `startCoralAgent` → which of the
   four verbs and the MCP transport; `solana_pay` → the Solana Pay reference spec; escrow client →
   the three instructions + PDA seeds; `complete` → the provider HTTP call.
4. **Per-tier "go deeper" pointers** (below) — the docs to read *when* a student outgrows the
   abstraction, not before.

---

## Pillar-theater guardrails (must be *visible* in the demo)

- **LLM:** sellers bid *differently* (persona-driven) and the buyer prints a *reason*. `LLM_PROVIDER`
  flip changes nothing structurally — proof of a real brain.
- **CoralOS:** ≥3 never-introduced agents transact in **one shared thread**; dropping in a 4th seller
  makes it compete next round with **zero buyer edits**.
- **Solana + contract:** `DELIVERED` is gated on `isFunded` (on-chain); the seller is paid only on
  `release`; a no-show triggers `refund`. Explorer links for deposit, release, and the PDA.

---

## Student tiers + "go deeper"

| Tier | Build | Touch | Read when stuck |
|------|-------|-------|-----------------|
| **0** | fork `deliverService` | a return string | — |
| **1** | a seller **persona** + inventory | `coral-agent.toml` | `docs/APIS.md` (the goods) |
| **2** | a new **market role** (reseller, **arbiter**) | the CoralOS verbs + escrow client | CoralOS pages · Solana Pay reference |
| **3** | a new **mechanism** (open-cry, reputation) or fork the **contract** | `market.ts` · `escrow/` (Anchor) | escrow `README` · `solana-dev` skill |

The **arbiter agent** (a third escrow signer that adjudicates disputed deliveries) is the headline
Tier-2/3 build the contract unlocks — a reputation-staked judge in the market.

---

## Execution plan & effort

| Phase | Work | ~hrs |
|-------|------|------|
| 0 | Debloat: delete the examples/agents/scripts above; confirm tree typechecks | 1 |
| 1 | Runtime lifts: `solana_pay.ts` (dedupe), `llm.ts` (modular shim) + tests | 3 |
| 2 | Escrow client: `escrowPda` + `isFunded`; agents depend on it via `file:` | 1.5 |
| 3 | `market.ts` + `market.test.ts` (pure logic) | 1.5 |
| 4 | Seller `bidder.ts` + WANT→BID→AWARD→**escrow** branch (mocked-LLM tests) | 3 |
| 5 | Buyer `MARKET=1`: bids → LLM select → deposit → release/refund | 3 |
| 6 | Personas + `examples/marketplace/` (start.ts, README) | 2 |
| 7 | Black-box fixes: `TRACE=1` across primitives; `docs/MARKETPLACE.md` "how it really works"; README/OVERVIEW re-tier to one example | 2.5 |
| 8 | Verify: typecheck + unit tests; live Docker + escrow e2e | 1 + setup |

**~18.5h.** Debloat (Phase 0) buys back time downstream — there's far less surface to keep green.

## Out of scope (the re-add list, in order)

1. **Human-in-the-market** — a slim single-page Marketplace view + a minimal bridge (re-introduces the
   strongest CoralOS flourish; deliberately cut from v1 for debloat).
2. Open-cry bidding (sellers see + undercut each other).
3. On-chain reputation/registry; the reseller supply-chain as a shipped default.

---

## Verification checklist

```sh
# 1. tree is clean after debloat + lifts (no network)
cd packages/agent-runtime && npm run typecheck && npm test && npm run build
for a in seller-agent buyer-agent; do (cd coral-agents/$a && npm run typecheck && npm test); done

# 2. live e2e — devnet wallets + ANTHROPIC_API_KEY (or LLM_PROVIDER=openai + OPENAI_API_KEY)
bash build-agents.sh && docker compose up -d coral
cd examples/marketplace && npm start
#   expect: ≥2 sellers BID → buyer AWARDs with a reason → DEPOSITED (Explorer link to the PDA)
#           → DELIVERED → RELEASED (Explorer link) — all in one shared thread
#   then TRACE=1 → watch the coral_* calls + every on-chain step inline
#   then add a 4th seller → competes next round, no buyer edits
#   then LLM_PROVIDER=openai → same demo on the sponsor's stack
```

When that runs, the three pillars and the contract are all **load-bearing and demonstrated** — and a
student can flip `TRACE=1` to see exactly what each abstraction is doing. No black boxes.
