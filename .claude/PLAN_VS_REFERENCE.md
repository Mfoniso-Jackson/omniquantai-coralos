# Plan vs. Reference Source — Reconciliation

**Date:** 2026-06-24
**Method:** Cloned the real upstream repos into `ref/` and read them against `ELEVATION_PLAN.md`.

```
ref/
  coral-server/            github.com/Coral-Protocol/coral-server  (Kotlin/JVM, the real CoralOS)
  solana-pay/              github.com/anza-xyz/solana-pay          (TS + Rust, current fork)
  solana-program-examples/ github.com/solana-developers/program-examples (Anchor reference)
```

The plan was written from a docs summary. Reading the actual source changes several
load-bearing assumptions. This document records what the plan got right, what it got
wrong, and what it completely missed — with file references into `ref/`.

---

## TL;DR — The Big Three

1. **CoralOS already has a native, Solana-based payment system.** The CORAL token is a
   Solana SPL mint. There is a full x402 implementation, a `[[claims]]` agent-monetization
   model, Jupiter price conversion, and Solana wallet config built in. The plan's premise —
   "bolt a Solana Pay rail onto CoralOS" — is largely **reinventing what exists**.

2. **The repo's `coral-agent.toml` files are valid — but the plan's *prose* about the schema
   was imprecise.** Edition 3 is still supported (`MINIMUM_SUPPORTED_AGENT_EDITION = 3`,
   `MAXIMUM = 5`; the test sample uses 4), and `license type="spdx"` is a real variant. The
   files don't *need* changing for correctness. The richer schema (full option type tower,
   `[[claims]]`, `[marketplace.*]`) is real and worth adopting, not a forced migration.

3. **The "critical" Windows Docker fix is already the default — twice over.** `DockerConfig.kt`
   resolves to `host.docker.internal` automatically, AND the repo's `track-1-config.toml`
   already sets it explicitly. The plan flagged a non-issue as the #1 risk.

---

## Section 1 — coral-agent.toml Schema (plan Phase 0a)

**Plan said:** edition 3, `[agent.license] type="spdx" expression="MIT"`, option types
"`string`, `i64`, `f64` — not `number`", env via `[docker] environment=[...]`.

**Reference:**
- `ref/coral-server/src/test/resources/agent/coral-agent.toml` (asserted in tests)
- `ref/coral-server/src/main/kotlin/.../agent/registry/RegistryAgent.kt`
- `ref/coral-server/src/main/kotlin/.../agent/registry/RegistryAgentLicense.kt`

**Correction to an earlier overstatement:** the repo's existing toml files are **valid as-is**.
The plan's *prose* was imprecise, but nothing is broken.

| Plan/prose claim | Reality |
|---|---|
| "edition 3 is wrong, must be 4" | **Edition 3 is valid** — `MINIMUM_SUPPORTED_AGENT_EDITION = 3`, `MAXIMUM = 5`, sample uses 4. No edition-gated required fields exist. Bumping is *alignment*, not a fix. |
| "license must be `text`" | **`type="spdx"` is valid** — `RegistryAgentLicense.Spdx(expression)` with `@SerialName("spdx")`. The existing `type="spdx", expression="MIT"` files are correct. `text` is just the other variant. |
| options: string / i64 / f64 only | **full numeric tower:** `i8 i16 i32 i64`, `u8 u16 u32 u64`, `f32 f64`, `bool`, `string`, `blob`, and `list[...]` of every one (the repo already uses `string`/`f64` correctly) |
| `[docker] image=...` + `environment=[...]` | repo already uses the correct **`[runtimes.docker]`** form with config via **`[options]`** — not an env array |
| (not mentioned) | richer schema also offers `capabilities`, `keywords`, `[[llm.proxies]]`, `[[dependencies]]`, `[[claims]]`, `[marketplace.pricing]`, `[marketplace.identities.erc8004]` |

**Action:** No correctness fix needed. Optional low-risk alignment: bump `edition = 3 → 4`
across all four agent tomls to match the current tested sample (editions are not field-gated,
so this is safe). Keep `type = "spdx"`. The repo's tomls were already in good shape — the plan
just described them inaccurately.

---

## Section 2 — Docker Networking (plan Phase 0c, flagged as #1 risk)

**Plan said:** "Add `[docker] address = "host.docker.internal"` to all config.toml files…
the single most common failure mode in hackathon settings."

**Reference:** `ref/coral-server/src/main/kotlin/.../config/DockerConfig.kt`

```kotlin
private fun defaultDockerAddress(): String {
    // host.docker.internal works on Docker for Windows and Colima
    return "host.docker.internal"
}
...
val address: String = defaultDockerAddress(),
```
and `RootConfig.kt`: `AddressConsumer.CONTAINER -> dockerConfig.address`.

**Reality:** This is **already the default** on Windows/Colima. The `CORAL_CONNECTION_URL`
injected into containers is built from this. The plan's "critical fix" is a no-op.

**Action:** Demote Phase 0c. Keep one sentence: "On native Linux you may need to override
`[docker] address`; on Windows/macOS the default already works." Remove it from the risk list.

---

## Section 3 — MCP Tools (plan's gate, Phase 1)

**Plan said:** tools `coral_wait_for_mention`, `coral_send_message`, `coral_create_thread`.

**Reference:** `ref/coral-server/src/main/kotlin/.../mcp/McpToolName.kt` — **confirmed**, plus more:

```
coral_create_thread      coral_close_thread
coral_add_participant    coral_remove_participant
coral_send_message       coral_wait_for_message
coral_wait_for_mention   coral_wait_for_agent
coral_close_session
```

Tool implementations: `mcp/tools/SendMessageTool.kt`, `mcp/tools/WaitForMessageTools.kt`.

**Reality:** The plan's three tool names are correct (singular `mention`, matching the repo's
existing `coral_mcp.ts`). The gate (Phase 1: prove a TS container joins and replies) remains
the right first step — and the transport is confirmed `streamable_http` for docker agents,
which is what `coral_mcp.ts` already uses (`StreamableHTTPClientTransport`). **No change** to
the gate, but note the extra tools (`wait_for_agent` is useful for the buyer to block until
the seller is present, avoiding the plan's `setTimeout(4000)` hack in buyer-agent).

---

## Section 4 — The Payment Model (plan Tracks 1 & 2) — BIGGEST DIVERGENCE

**Plan said:** Build a hand-rolled HTTP 402 seller (`server.ts` + `verify.ts`), parse
`WWW-Authenticate: x402=<base64>` headers, verify SOL transfers with `findReference`.

**Reference:** CoralOS ships a **native x402 implementation** plus a **CORAL-token claims economy**.

### 4a. Native x402 (`ref/coral-server/src/main/kotlin/.../x402/`)

```
X402PaymentRequired.kt     { x402Version, accepts: [X402PaymentRequirement], error }
X402PaymentRequirement.kt  { scheme, network, maxAmountRequired, resource, payTo,
                             asset (ERC20), maxTimeoutSeconds, extra (EIP-712) }
X402PaymentPayload.kt      X402ProxyRequest.kt  X402ProxiedResponse.kt  X402BudgetedResource.kt
```

This is the **Coinbase x402 standard** (EIP-3009 / ERC20 schema). The flow is a **server-side
proxy**: an agent sends an `X402ProxyRequest { endpoint, method, body }` to coral-server, and
coral-server negotiates the 402 payment on the agent's behalf, enforcing a budget
(`X402BudgetedResource.withinBudget()`). Agents do **not** parse 402 headers themselves.

### 4b. CORAL token = Solana SPL (`ref/coral-server/src/main/kotlin/.../config/`)

```kotlin
// PaymentConfig.kt
const val CORAL_MAINNET_MINT = "CoRAitPvr9seu5F9Hk39vbjqA1o1XuoryHjSk1Z1q2mo"
const val CORAL_DEV_NET_MINT = "FBrR4v7NSoEdEE9sdRN1aE5yDeop2cseaBbfPVbJmPhf"

// Wallet.kt — sealed Wallet: Solana | CrossmintSolana, SolanaCluster {MAIN,DEV,TEST}_NET
// depends on org.coralprotocol.payment.blockchain (a real on-chain payment SDK)
```

`JupiterService.kt` converts CORAL↔USD via `https://lite-api.jup.ag/price/v3`.

### 4c. Agent claims/monetization (`ref/coral-server/src/main/kotlin/.../agent/payment/`)

```
PaidAgent.kt  AgentClaimRequest.kt  AgentClaimResult.kt  AgentClaimAmount.kt
AgentGraphPayment.kt  AgentBudgetUnit.kt
```
plus `[[claims]]` in the toml: `{ name, description, dependency, cost = 100_000_000 # 1 dollar }`.

**Reality:** CoralOS is **already** an agent payment marketplace with on-chain Solana
settlement, budgets, and USD-denominated claims. The plan's Track 1/2 build a parallel,
weaker version of this.

**Action — two honest options:**

- **Option A (align with CoralOS):** Tracks become "register a paid CoralOS resource/claim"
  and "drive an x402-budgeted purchase via the proxy." Differentiator = the agent's service,
  exactly as the plan wanted, but riding the native rail. Higher ceiling, more impressive to
  judges, but couples you to CoralOS's payment SDK and CORAL token.
- **Option B (keep it standalone, position honestly):** Keep the hand-rolled Solana Pay
  SOL-transfer flow as a **teaching-grade, dependency-light** alternative — explicitly framed
  as "the bare-metal version of what CoralOS does natively." Lower ceiling, but zero coupling,
  runs without the CORAL token, easier for students on devnet.

Recommended: **B for Tracks 2 & 3** (self-contained, devnet, SOL), **A as the Track 1
"advanced" upgrade** (`X402ProxyRequest` against coral-server) replacing the Anchor-escrow
upgrade as the headline differentiator. The Anchor escrow is still valid but it is now the
*third* option behind "use CoralOS native x402," not the primary one.

---

## Section 5 — Solana Pay TS Surface (plan Tracks 1 & 3)

**Plan said:** Use `encodeURL`, `findReference`, Transaction Request (server builds tx).

**Reference:** `ref/solana-pay/typescript/packages/solana-pay/core/src/`

```
encodeURL.ts  parseURL.ts  findReference.ts  watchReference.ts
fetchTransaction.ts  client.ts  plugins/merchant.ts  plugins/wallet.ts
```

**Reality:** All confirmed. The plan is correct here. Two upgrades the plan didn't know about:
- **`watchReference.ts`** — a subscription-based alternative to polling `findReference`; better
  for the seller's "wait for payment" loop than a poll.
- **`plugins/merchant.ts` / `plugins/wallet.ts` + `client.ts`** — the anza fork has a newer
  plugin architecture. Track 3's Transaction Request can use `fetchTransaction` + the merchant
  plugin instead of hand-building the POST handler.

**Action:** Keep Track 3's Transaction Request design. Swap `findReference` polling for
`watchReference` in the seller wait-loop. Reference the merchant plugin in the Track 3 README.

---

## Section 6 — Anchor Escrow (plan Phase 7)

**Reference:** `ref/solana-program-examples/basics/` and the broader repo hold canonical
Anchor patterns (escrow, PDA, transfer-sol). The plan's `lib.rs` (initialize/claim/refund,
PDA seeds `["escrow", buyer, memo]`) is consistent with these patterns.

**Reality:** The plan's escrow design is sound and matches reference examples. But per
Section 4, escrow is **no longer the primary Track 1 differentiator** — CoralOS native x402 is.
Keep escrow as an optional "trustless without CoralOS" module.

---

## Section 7 — Net Changes to ELEVATION_PLAN.md

| Plan item | Verdict | Change |
|---|---|---|
| Phase 0a: "toml schema is wrong" | ⚠️ overstated | Repo tomls are valid. Optional: bump `edition 3→4`. Keep `spdx`. Drop the "rewrite" framing. |
| Phase 0c: `host.docker.internal` is critical | ❌ already default | Remove from risks entirely; repo config already sets it |
| Phase 1: MCP gate, 3 tool names, streamable_http | ✅ correct | Keep; add `coral_wait_for_agent` to drop the `setTimeout(4000)` hack |
| Track 1: hand-rolled 402 server + verify.ts | ⚠️ reinvents native x402 | Reframe: native `X402ProxyRequest` is the headline; hand-rolled is the teaching fallback |
| Track 1: Anchor escrow as the differentiator | ⚠️ demoted | Now the 3rd option behind CoralOS x402 |
| CORAL token / claims / marketplace pricing | ❌ missed entirely | Add a new section: CoralOS native monetization (claims, CORAL SPL, Jupiter USD, ERC-8004 identity) |
| Track 2: in-process SOL transfer | ✅ valid as standalone | Keep; position as dependency-light |
| Track 3: Transaction Request | ✅ correct | Keep; use `watchReference` + merchant plugin |
| `findReference` for tracking | ✅ correct | Upgrade to `watchReference` for the wait-loop |
| LLMBuyerStrategy | ✅ still novel/valuable | Keep; can target either the native x402 proxy or the standalone seller |

---

## Section 8 — One Thing the Plan Completely Missed: ERC-8004 Identity

`coral-agent.toml` has `[marketplace.identities.erc8004]` with a `wallet` (base58, 32-byte key)
and named `endpoints`. CoralOS is aligning agents with the **ERC-8004 trustless-agent identity
standard**. For a hackathon, demonstrating an agent with a verifiable on-chain identity that
gets paid in CORAL and settles on Solana is a far stronger story than a bespoke SOL transfer.
This should be on the roadmap even if not in the first build.

---

## Verdict

The plan's **architecture instincts are right** (three tracks, LLM buyer, gate-first on MCP,
Transaction Request for checkout). But it was written without seeing that **CoralOS is already
a Solana-native agent payment marketplace**. The highest-leverage revision is to stop
reinventing the payment rail and instead:

1. Leave the tomls (they're valid); optionally bump `edition 3→4` for alignment.
2. Drop the non-issue Docker fix from the risk list.
3. Make Track 1 ride CoralOS native x402; keep the hand-rolled flow only as a teaching fallback.
4. Add the CORAL-token / claims / ERC-8004 monetization story the plan never mentioned.
5. Keep Tracks 2 & 3 as the dependency-light, devnet-SOL, self-contained demos.

The single biggest real finding stands unchanged: **CoralOS is already a Solana-native agent
payment marketplace.** That, not the toml details, is what should reshape the tracks.
