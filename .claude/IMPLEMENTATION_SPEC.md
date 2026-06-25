# Implementation Spec — The Three Hard Things (and what they need)

**Date:** 2026-06-24
**Grounded in:** `ref/coral-server/` source (read, not summarized) + `ref/solana-pay/`.
**Scope:** Make the agent-economy real. Three primitives + the supporting pieces they require.

> Everything in this doc cites the exact source it's built from. Where a shape comes from
> CoralOS, the Kotlin file is named. Build in the order given — **Part A is a hard gate.**

---

## The dependency graph

```
Part A — MCP Gate (standalone TS agent joins CoralOS, replies to a mention)
   │  PREREQUISITE FOR EVERYTHING. If this is red, B and C are theory.
   ▼
Part B — LLMBuyerStrategy (Claude autonomously pays a paywall and retries)
   │  needs: a seller to buy from (bare-metal 402 server, Part D1)
   ▼
Part C — Native x402 end-to-end (buyer pays via CoralOS x402 proxy, CORAL token)
   │  needs: Part A working + coral-server wallet config (Part D2)
   ▼
Part D — Supporting pieces (the "anything else"):
   D1  bare-metal 402 seller server   (B's counterparty)
   D2  coral-server wallet config      (C's prerequisite)
   D3  smoke-test harness              (proves A/B/C without the UI)
   D4  observability / structured logs (debugging the above)
```

---

## Source facts this spec relies on (verified in `ref/coral-server/`)

**MCP connection (`routes/mcp/v1/McpRoutes.kt`, `routes/RouteResources.kt`):**
- Base resource `mcp/v1`. Two transports per agent:
  - Streamable HTTP: `{base}/mcp/v1/{agentSecret}/mcp`
  - SSE: `{base}/mcp/v1/{agentSecret}/sse/` **(trailing slash required — comment in source warns the MCP Kotlin SDK strips it otherwise)**
- Streamable HTTP uses the `mcp-session-id` header (`MCP_SESSION_ID_HEADER_NAME`) for continuity.
- `{agentSecret}` is injected by CoralOS into the agent's `CORAL_CONNECTION_URL` at container start.

**MCP tools (`mcp/McpToolName.kt`, `mcp/tools/*.kt`):**
| Tool (`SerialName`) | Input | Output |
|---|---|---|
| `coral_send_message` | `{ threadId: string, content: string, mentions: string[] }` | `{ status, message: SessionThreadMessage }` |
| `coral_wait_for_mention` | `{ currentUnixTime: long, maxWaitMs: long }` (capped 60000) | `{ message: SessionThreadMessage?, status: "Message received" \| "Timeout reached" }` |
| `coral_wait_for_message` | `{ currentUnixTime, maxWaitMs }` | same |
| `coral_wait_for_agent` | `{ currentUnixTime, agentName: string, maxWaitMs }` | same |
| `coral_create_thread` | `{ threadName, participantNames }` | thread |
| also: `coral_close_thread`, `coral_add_participant`, `coral_remove_participant`, `coral_close_session` | | |

> The repo's existing `sdk/agent-core-ts/src/coral_mcp.ts` already calls these with the right
> names and args (`{ maxWaitMs, currentUnixTime: Date.now() }`, parses `"Timeout reached"`).
> **It is closer to correct than the plan assumed.** Part A is mostly proving it end-to-end.

**Session creation (`routes/api/v1/SessionApi.kt`):**
- `POST {base}/api/v1/.../session` with body `SessionRequest { agentGraphRequest, namespaceProvider, execution }` → `SessionIdentifier`.
- `agentGraphRequest.toAgentGraph()` validates the graph; bad graph → 400.

**x402 proxy (`routes/api/v1/AgentRpcApi.kt`, `x402/*.kt`):**
- `POST {base}/api/v1/{agentSecret}/x402` with body `X402ProxyRequest { endpoint, method, body }` → `X402ProxiedResponse`.
- Server-side flow (lines 119-139): POST to `endpoint` → if `402` → decode `X402PaymentRequired { x402Version, accepts: [X402PaymentRequirement], error }` → pay → retry.
- **Hard requirement:** if `x402Service is BlankX402Service`, returns `500 "x402 proxying is not configured on this server"`. → Part D2 (wallet config) is mandatory for Part C.
- Settlement token: CORAL SPL (`config/PaymentConfig.kt`: `CORAL_MAINNET_MINT`, `CORAL_DEV_NET_MINT`); USD pricing via `JupiterService`.

---

# Part A — The MCP Gate (DO THIS FIRST)

**Goal:** A standalone TypeScript process, launched as a CoralOS Docker agent, connects over MCP,
waits for a mention, and replies in-thread. Nothing else. When this prints `connected` and a
round-trip mention works, the entire downstream plan stops being theoretical.

### A1. Standalone entrypoint — `sdk/agent-core-ts/src/coral_mcp_server.ts`

Extract a true process entrypoint from the existing `coral_mcp.ts` client. The class is already
there (`CoralMcpAgent`); this wraps it as a runnable agent with a handler.

```typescript
// CORAL_CONNECTION_URL is injected by CoralOS. It already contains {agentSecret} and ends in /mcp.
// Usage in a container: CMD ["node", "dist/coral_mcp_server.js"]
import { CoralMcpAgent, type CoralMention } from './coral_mcp.js'

export interface AgentContext {
  send(content: string, threadId: string, mentions?: string[]): Promise<void>
  reply(mention: CoralMention, content: string): Promise<void>
  waitForMention(maxWaitMs?: number): Promise<CoralMention | null>
  waitForAgent(agentName: string, maxWaitMs?: number): Promise<CoralMention | null>
  createThread(name: string, participants: string[]): Promise<string>
}

export async function startCoralAgent(
  config: { agentName: string; version?: string },
  handler: (ctx: AgentContext) => Promise<void>,
): Promise<void> {
  const url = process.env.CORAL_CONNECTION_URL
  if (!url) throw new Error('CORAL_CONNECTION_URL not set (CoralOS injects this)')

  const agent = new CoralMcpAgent({ connectionUrl: url, agentName: config.agentName, version: config.version })
  await agent.connect()
  console.error(`[${config.agentName}] connected to CoralOS`)   // ← the gate signal

  const ctx: AgentContext = {
    send: (c, t, m = []) => agent.sendMessage(c, t, m),
    reply: (mention, c) => agent.sendMessage(c, mention.threadId!, mention.sender ? [mention.sender] : []),
    waitForMention: (ms) => agent.waitForMention(ms),
    waitForAgent: (name, ms) => agent.waitForAgent(name, ms),   // ← add to CoralMcpAgent (coral_wait_for_agent)
    createThread: (n, p) => agent.createThread(n, p),
  }
  await handler(ctx)
}
```

**Required edit to `coral_mcp.ts`:** add a `waitForAgent(agentName, maxWaitMs)` method calling the
`coral_wait_for_agent` tool with `{ agentName, maxWaitMs, currentUnixTime: Date.now() }`. The tool
exists (`McpToolName.WAIT_FOR_AGENT`) and replaces the buyer's `setTimeout(4000)` boot-wait hack.

### A2. The smoke agent — `coral-agents/echo-agent/`

The smallest possible agent. No payment, no LLM. Just proves the loop.

```typescript
// coral-agents/echo-agent/src/index.ts
import { startCoralAgent } from '@pay/agent-core-ts'

await startCoralAgent({ agentName: 'echo-agent' }, async (ctx) => {
  console.error('[echo-agent] waiting for mentions')
  while (true) {
    const m = await ctx.waitForMention(30_000)
    if (!m) continue
    console.error(`[echo-agent] got: ${m.text} from ${m.sender}`)
    await ctx.reply(m, `echo: ${m.text}`)
  }
})
```

Plus `coral-agent.toml` (edition 4, copy the seller's shape, minimal options), `Dockerfile`,
`package.json`, `tsconfig.json`.

### A3. The gate test (manual, before any other code)

```sh
# 1. Build the echo agent image
docker build -t echo-agent:0.1.0 -f coral-agents/echo-agent/Dockerfile .

# 2. Start coral-server with a config that registers /agents/*
docker run -p 5555:5555 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./docs/coral/track-1-config.toml:/config/config.toml:ro \
  -v ./coral-agents:/agents:ro \
  ghcr.io/coral-protocol/coral-server:latest

# 3. Create a session containing echo-agent + a user-proxy (POST api/v1/.../session, SessionRequest)
#    -> coral-server launches echo-agent as a sibling container, injects CORAL_CONNECTION_URL

# 4. Inject a mention via the Puppet API (routes/api/v1/PuppetApi.kt) as user-proxy:
#    "@echo-agent hello"

# 5. PASS CRITERIA:
#    - echo-agent logs "connected to CoralOS"
#    - echo-agent logs "got: hello"
#    - the thread shows "echo: hello" back from echo-agent
```

**Do not write Part B, C, or any seller/buyer logic until step 5 passes.** Budget one focused
session for this. The single biggest risk in the whole plan is the MCP transport handshake; an
afternoon proving it is worth more than days of agent logic that can't connect.

### A4. Known failure modes (from source)

| Symptom | Cause | Fix |
|---|---|---|
| 401 on connect | bad/expired `agentSecret` in URL | session not created, or agent not in the graph |
| SSE base URL mangled | missing trailing slash on `/sse/` | use streamable HTTP (`/mcp`), which `coral_mcp.ts` already does |
| connects but never gets mention | mention not addressed `@echo-agent` | `waitForMentioningMessageExecutor` filters on `Mentions(agent.name)` — the @name must match exactly |
| agent never launches | image not built / registry rescan | `localAgentRescanTimer = "5s"`; rebuild image, wait for rescan |

---

# Part B — LLMBuyerStrategy

**Goal:** A Claude-driven agent that, given a goal, hits an endpoint, discovers it needs payment,
decides to pay, signs the transfer, and retries — all as autonomous tool-use. This is *the*
agent-economy primitive.

### B1. The strategy — `sdk/agent-core-ts/src/strategies/llm_buyer.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { BaseStrategy, MutableAgentState, untilAborted } from '../strategy.js'

export interface LLMBuyerConfig {
  endpoint: string            // seller's data API
  goal: string                // system prompt: what the buyer wants
  budgetLamports: number      // hard cap the strategy enforces, NOT the model
  keypairB58: string          // buyer's devnet keypair
  model?: string              // default 'claude-haiku-4-5-20251001'
}

export class LLMBuyerStrategy extends BaseStrategy {
  readonly name = 'llm-buyer'
  constructor(private config: LLMBuyerConfig) { super() }

  async run(state: MutableAgentState, signal: AbortSignal): Promise<void> {
    const result = await this.purchase(state)
    state.recordAction('purchase-complete', result.slice(0, 200))
    await untilAborted(signal)
  }

  // Exposed so handleMessage / a CoralOS mention can trigger a one-shot purchase too.
  async purchase(state: MutableAgentState): Promise<string> {
    const llm = new Anthropic()
    const tools: Anthropic.Tool[] = [
      { name: 'fetch_data', description: 'Fetch the endpoint. Returns data, or a 402 payment challenge.',
        input_schema: { type: 'object', properties: {}, required: [] } },
      { name: 'pay_and_retry', description: 'Pay a Solana Pay challenge, then re-fetch.',
        input_schema: { type: 'object', properties: {
          recipient: { type: 'string' }, amountSol: { type: 'number' }, reference: { type: 'string' },
        }, required: ['recipient', 'amountSol'] } },
    ]
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: this.config.goal }]

    for (let turn = 0; turn < 8; turn++) {                 // bounded loop — never infinite
      const resp = await llm.messages.create({
        model: this.config.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: 1024, system: BUYER_SYSTEM, tools, messages,
      })
      messages.push({ role: 'assistant', content: resp.content })

      const toolUses = resp.content.filter((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
      if (toolUses.length === 0) {                          // model gave a final answer
        return resp.content.filter(c => c.type === 'text').map(c => (c as any).text).join('\n')
      }

      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.name === 'fetch_data') {
          const r = await fetch(this.config.endpoint)
          if (r.status === 402) {
            const challenge = parse402(r.headers)            // { recipient, amountSol, reference }
            state.recordAction('payment-challenge', JSON.stringify(challenge))
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ status: 402, challenge }) })
          } else {
            const body = await r.text()
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: body.slice(0, 2000) })
          }
        } else if (tu.name === 'pay_and_retry') {
          const { amountSol, recipient, reference } = tu.input as any
          // HARD BUDGET ENFORCEMENT — the strategy, not the model, refuses to overspend.
          if (amountSol * 1e9 > this.config.budgetLamports) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true,
              content: `budget exceeded: ${amountSol} SOL > ${this.config.budgetLamports / 1e9} SOL` })
            continue
          }
          const sig = await signTransfer(this.config.keypairB58, recipient, amountSol, reference)
          state.recordAction('payment-sent', `${amountSol} SOL`, sig)
          const retry = await fetch(this.config.endpoint, { headers: { 'x-payment-proof': sig } })
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: (await retry.text()).slice(0, 2000) })
        }
      }
      messages.push({ role: 'user', content: results })
    }
    throw new Error('purchase loop exhausted without a final answer')
  }
}

const BUYER_SYSTEM = `You are an autonomous data-buying agent on Solana devnet.
Use fetch_data to get the resource. If it returns a 402 challenge, evaluate whether the price is
reasonable for your goal, then call pay_and_retry with the challenge's recipient/amount/reference.
Never invent a recipient or amount — only use values from a real challenge. When you have the
data, summarize it in one sentence and stop.`
```

**Design rules baked in (these are what make it *not* a toy):**
- **The loop is bounded** (`turn < 8`) — an LLM agent that can loop forever is a liability.
- **Budget is enforced in code, not by the prompt** — the model can *want* to overpay; the
  strategy refuses. This is the single most important safety property of a paying agent.
- **The model may only pay values from a real challenge** — `pay_and_retry` is fed challenge
  fields, and the system prompt forbids inventing them. No hallucinated recipients.
- **`purchase()` is callable from `run()` (autonomous) or a CoralOS mention** (on-demand).

### B2. Wire-up
- Export from `sdk/agent-core-ts/src/index.ts`.
- Register in `api-ts/src/registry.ts`: `'llm-buyer': (c) => new LLMBuyerStrategy(c as LLMBuyerConfig)`.
- `coral-agents/buyer-agent/src/index.ts` can delegate to `purchase()` instead of its hand-rolled loop.

### B3. Counterparty: needs Part D1 (a 402 seller to buy from).

---

# Part C — Native x402, End-to-End

**Goal:** A buyer agent pays for a resource through CoralOS's own x402 proxy, settling in CORAL.
This proves the native rail rather than describing it. **Requires Part A green + Part D2 wallet.**

### C1. The buyer side — call the proxy, don't parse 402

Per `AgentRpcApi.kt`, the agent does *not* implement x402. It asks coral-server to proxy:

```typescript
// Inside a CoralOS agent (it knows its own agentSecret from CORAL_CONNECTION_URL).
// The x402 proxy lives at: {base}/api/v1/{agentSecret}/x402
async function buyViaX402(baseUrl: string, agentSecret: string, target: string) {
  const res = await fetch(`${baseUrl}/api/v1/${agentSecret}/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: target,        // the x402-priced resource
      method: 'GET',
      body: {},
    } satisfies X402ProxyRequest),
  })
  if (res.status === 500) throw new Error('x402 not configured on coral-server — see Part D2')
  return res.json() as Promise<X402ProxiedResponse>   // server already paid + retried
}
```

The server (source lines 119-139) does the POST → `402 X402PaymentRequired` → pay in CORAL →
retry → return the proxied 200. Budget enforcement is server-side
(`X402BudgetedResource.withinBudget()`).

### C2. The seller side — emit a real x402 challenge

A resource that returns the Coinbase-standard `402` so the proxy can satisfy it:

```typescript
// 402 body must match X402PaymentRequired (x402/X402PaymentRequired.kt):
res.status(402).json({
  x402Version: 1,
  accepts: [{
    scheme: 'exact',
    network: 'solana-devnet',
    maxAmountRequired: '100000',              // atomic units (string)
    resource: 'https://.../api/data',
    description: 'Weather data',
    mimeType: 'application/json',
    payTo: process.env.CORAL_RESOURCE_WALLET, // receives CORAL
    maxTimeoutSeconds: 60,
    asset: 0,                                 // SPL/CORAL identifier
  }],
  error: '',
})
```

> **Caveat from source:** `X402PaymentRequirement` is modeled on EVM/EIP-3009 (`asset` is an
> ERC20 contract, `extra` carries EIP-712 name/version). The Solana path rides
> `org.coralprotocol.payment.blockchain`. Treat the Solana scheme/network strings as the thing to
> verify against a live coral-server during the gate — do not assume the exact `scheme`/`network`
> literals without testing. This is the one area where source alone isn't enough; confirm live.

### C3. Gate for Part C
A buyer agent calls the proxy, coral-server settles CORAL on devnet, and the proxied 200 comes
back with data. If `BlankX402Service` (no wallet) → expect the 500 and go fix Part D2 first.

---

# Part D — Supporting Pieces ("anything else")

### D1. Bare-metal 402 seller — `examples/track-1-pay-per-call/server.ts` + `verify.ts`

B's counterparty, and Track 1's portable layer. Express server:
- `GET /api/data` no proof → `402` + headers `x-payment-required: {recipient, amountSol, reference}`
  (generate a fresh `Keypair` per request; its pubkey is the `reference`).
- `GET /api/data` with `x-payment-proof: <sig>` → `verify.ts` confirms and serves.

```typescript
// verify.ts — use watchReference (subscription) over polling findReference.
import { findReference, validateTransfer } from '@solana/pay'   // ref/solana-pay/.../core/src
import { Connection, PublicKey } from '@solana/web3.js'

export async function verifyPayment(conn: Connection, reference: PublicKey,
  recipient: PublicKey, amountSol: number): Promise<boolean> {
  try {
    const sigInfo = await findReference(conn, reference, { finality: 'confirmed' })
    await validateTransfer(conn, sigInfo.signature, {
      recipient, amount: new BigNumber(amountSol), reference,
    })
    return true
  } catch { return false }
}
```

`findReference` / `validateTransfer` are confirmed in `ref/solana-pay/typescript/packages/solana-pay/core/src/`.

### D2. coral-server wallet config (Part C prerequisite)

Per `config/PaymentConfig.kt` + `config/Wallet.kt`, coral-server's `config.toml` needs a wallet
or `x402Service` stays `BlankX402Service` and the proxy 500s. Minimal:

```toml
[[payment.wallets]]
type = "solana"
name = "x402-wallet"
cluster = "dev_net"
keypair_path = "/config/devnet-keypair.json"
address = "<devnet pubkey>"

[payment]
x402WalletName = "x402-wallet"
```

> Field names taken from the Kotlin `@SerialName`s in `Wallet.kt` (`solana`, `keypair_path`,
> `address`, `cluster`) and `PaymentConfig.kt` (`wallets`, `x402WalletName`). Confirm against a
> live coral-server `--help`/config dump during the gate — config DSL details can shift.

### D3. Smoke-test harness — `scripts/smoke/`

Proves A/B/C from the command line, no UI:
- `smoke-mcp.ts` — creates a session with echo-agent + user-proxy, injects a mention via Puppet
  API, asserts the echo round-trips. **This is Part A's gate, automated.**
- `smoke-buyer.ts` — starts the bare-metal seller (D1), runs `LLMBuyerStrategy.purchase()`,
  asserts a devnet txSig was produced and data returned.
- `smoke-x402.ts` — calls the x402 proxy, asserts a proxied 200 (or a clean "not configured" if D2 absent).

### D4. Observability

Every agent already uses `console.error` with `[agent-name]` prefixes (good for Docker logs).
Add one thing: a `--json-logs` mode that emits structured `{ ts, agent, event, data }` lines so
the smoke harness and the web dashboards can parse a single stream instead of scraping prose.

---

## Build order (with gates)

```
1. Part A    coral_mcp_server.ts + echo-agent + manual gate test     ← HARD GATE
             (add coral_wait_for_agent to coral_mcp.ts)
   ─ gate ─  echo round-trips a mention. Stop here until green.
2. Part D1   bare-metal 402 server.ts + verify.ts                    (B's counterparty)
3. Part B    LLMBuyerStrategy + register + smoke-buyer.ts
   ─ gate ─  Claude pays the D1 seller on devnet, returns data
4. Part D2   coral-server wallet config
5. Part C    x402 proxy buyer call + x402 seller resource
   ─ gate ─  proxied 200 with CORAL settled on devnet (confirm scheme/network live)
6. Part D3   automate all three gates as smoke scripts
7. Part D4   structured logging for dashboards
```

## What stays explicitly out of scope (and why)

| Deferred | Reason |
|---|---|
| Mainnet anything | Devnet only; CORAL mainnet mint is referenced but never funded |
| The exact x402 Solana scheme literals | Source is EVM-shaped; must be confirmed against a live server, not guessed |
| Anchor escrow | Already specced in `examples/track-1-.../anchor-escrow/`; it's the trustless-without-CoralOS option, not on this critical path |
| USDC / token-2022 | All flows are SOL (bare-metal) or CORAL (native); SPL-other is a later fork |

---

## Definition of done

The repo crosses from "well-architected intermediate" to "advanced agent-economy infrastructure"
when all three gates are green:

1. **A:** a TypeScript container joins a live CoralOS session and replies to a mention.
2. **B:** `LLMBuyerStrategy` autonomously pays a paywall on devnet and returns the data, with the
   budget enforced in code and the loop bounded.
3. **C:** a buyer pays for a resource through CoralOS's native x402 proxy, settling CORAL on devnet.

At that point the "agent economy" is demonstrable, not described — which is the whole difference.

---

## BUILD STATUS (2026-06-24) — code complete, gates pending live infra

All code artifacts are written and **typecheck clean**. What remains is running the three gates,
which need external infrastructure I cannot stand up here (a live CoralOS Docker server, funded
devnet wallets, Anthropic + Helius keys).

| Part | Artifact | Status |
|------|----------|--------|
| A1 | `coral_mcp.ts` `waitForAgent` + `coral_mcp_server.ts` context | ✅ built, typechecks |
| A2 | `coral-agents/echo-agent/` (index, toml ed.4, Dockerfile, pkg, tsconfig) | ✅ built, typechecks |
| B | `coral-agents/buyer-agent/src/llm_buyer.ts` (`LLMBuyerStrategy`) + `signTransfer` | ✅ built, typechecks |
| D1 | `examples/track-1/{server,verify,buyer}.ts` (bare-metal 402) | ✅ built, typechecks |
| C | `examples/track-1/{server-x402,buy-x402}.ts` (native x402) | ✅ built, typechecks |
| D3 | `scripts/smoke/{smoke-mcp,smoke-buyer,smoke-x402}.ts` | ✅ built, typechecks |
| D4 | `sdk/agent-core-ts/src/log.ts` (structured logging) | ✅ built, exported |

**Verified:** `sdk/agent-core-ts` (typecheck + build), `buyer-agent`, `echo-agent`, `track-1`,
`scripts/smoke` all typecheck with exit 0. `api-ts` unaffected (only its pre-existing
vitest/supertest test-dep errors remain).

**Gate status:**
1. **A — ✅ GREEN (verified live 2026-06-24).** Built echo-agent image, booted
   `coral-server:latest`, created a session, injected a mention via the Puppet API. The
   standalone TS container connected over MCP and replied in-thread:
   ```
   [echo-agent] connecting to http://host.docker.internal:5555/mcp/v1/<secret>/mcp
   [echo-agent] connected → waiting for mentions
   [echo-agent] got: @echo-agent hello (from user-proxy)
   [echo-agent] sent message "echo: @echo-agent hello" into thread <id>, mentioning: user-proxy
   ```
   Also confirmed live: all 5 edition-4 tomls register; `coral_wait_for_agent` is exposed;
   `host.docker.internal` is the working default (the "non-issue" Docker fix, vindicated); the
   MCP tool set matches `McpToolName.kt` exactly. `smoke-mcp.ts` now carries the verified
   routes/shapes (no longer confirm-live).
2. **B — ✅ GREEN for on-chain settlement (verified live 2026-06-25).** Ran the full pay-per-call
   loop against a funded devnet wallet end to end:
   ```
   STEP1  GET /api/data            → 402 + x-payment-required {recipient, amountSol, reference}
   STEP2  SystemProgram.transfer   → confirmed on devnet, sig 3g2wQri9…
   STEP3  GET /api/data (+proof)    → verify.ts findReference/validateTransfer OK → 200 {paidWith}
   ```
   On-chain confirmation: seller `7jwB…` received 0.0001 SOL, tx SUCCESS
   (explorer.solana.com/tx/3g2wQri9…?cluster=devnet). The `data` payload showed a delivery error
   only because Jupiter's API is unreachable in the sandbox — the **payment rail + on-chain
   verification + response** are proven. **Robustness fix applied:** `server.ts` now wraps
   `deliverData()` in try/catch so a verified payment always returns 200 (previously an upstream
   data failure crashed the seller via unhandled rejection). The only unexercised piece is the LLM
   *deciding* to pay — gated on `ANTHROPIC_API_KEY` (absent here), which is orchestration atop the
   now-proven settlement.
3. **C — closable on devnet via CoralOS's own minting (corrected after deep research).**
   `server-x402.ts` emits a spec-correct `X402PaymentRequired` body (verified live).
   An earlier note here claimed this was "blocked on CORAL tokens we can't mint" — that was
   **wrong**. Source review of `modules/BlockchainModule.kt` + `payment/BlankBlockchainService.kt`
   shows:
   - Configuring a `Wallet.Solana` (`config.x402Wallet` / `remoteAgentWallet`) swaps the no-op
     `BlankX402Service`/`BlankBlockchainService` for the real `X402ServiceImpl`/`BlockchainServiceImpl`
     (impl = published artifact `org.coralprotocol.payment:blockchain:0.1.1`, already in the
     `coral-server:latest` image).
   - The real `BlockchainService` exposes **`createDevnetMint()`** and
     **`mintDevnetTokensTo(mint, dest, amount)`** — CoralOS self-provisions devnet test tokens.
     You do **not** need Coral to hand you CORAL; the official devnet CORAL mint (`FBrR4v7N…`)
     is for their own testing, but a self-contained run can mint its own devnet token.
   - The web's "use Circle USDC faucet" is generic x402 advice and does **not** apply — there is
     no USDC anywhere in the coral-server source; its economy is CORAL-denominated.

   **ATTEMPTED LIVE (2026-06-25) — hit a hard wall in coral-server itself.** I generated a devnet
   wallet, funded it (0.3 SOL via transfer, faucet was rate-limited), derived the exact wallet DSL
   from source (`ConfigModule.kt` uses `.withExplicitSealedTypes("type")`, so the discriminator is
   `type = "Solana"` — the subclass *simple name*, not the kotlinx `@SerialName("solana")`), and
   added a `[[payment.wallets]]` block to `config.toml`. Hoplite then failed with:
   ```
   Could not instantiate Wallet.Solana because:
     'serializationConstructorMarker': Unable to locate a decoder for
      class kotlinx.serialization.internal.SerializationConstructorMarker
   ```
   **Root cause = a bug in coral-server, not in our config.** `Wallet.Solana` is a kotlinx
   `@Serializable` data class with a defaulted field (`cluster`); kotlinx emits a synthetic
   constructor carrying a `SerializationConstructorMarker`, and hoplite selects that constructor and
   can't construct it from config. No config value can satisfy a synthetic JVM marker — it is
   uninstantiable from the outside. Confirmed by isolation: the identical server boots clean and
   registers all 5 agents with the wallet block removed.

   **UPDATE (2026-06-25) — WALL BROKEN. The native payment engine is live on devnet.**
   The blocker was a **two-part bug in coral-server**, both now fixed in a patched image
   (`coral-server:patched`):
   1. `Wallet` is the only `@Serializable` config class. kotlinx emits a synthetic constructor
      (`SerializationConstructorMarker`) for it regardless of defaults (proven: dropping the
      `cluster` default and rebuilding produced the identical error). Hoplite's reflective decoder
      picks that constructor and dies. **Fix:** a custom `WalletDecoder : Decoder<Wallet>`
      (modeled on coral-server's own `ByteSizeDecoder`) that builds the wallet via its normal
      Kotlin constructor, registered in `ConfigModule` with `.addDecoder(WalletDecoder())`.
   2. Hoplite normalizes config keys, so `keypair_path` wasn't found by a literal lookup.
      **Fix:** the decoder normalizes every key (lowercase, strip `_`/`-`) before matching.

   Patch lives in `ref/coral-server/src/main/kotlin/.../config/WalletDecoder.kt` +
   `modules/ConfigModule.kt`. Build: `docker build -t coral-server:patched ref/coral-server`.

   Verified live: with a devnet wallet (`[[payment.wallets]]` type=Solana, cluster=DEV_NET,
   keypair_path, address) the patched server boots clean and logs
   `BlockchainService initialized with RPC … https://api.devnet.solana.com` — the **real**
   `BlockchainServiceImpl`/`X402ServiceImpl`, not the Blank stubs. No "not configured" / "disabled"
   warnings; `Bearer dev /registry → 200`; all agents register.

   **Then drove the x402 proxy end-to-end (2026-06-25) and mapped exactly how far it gets.**
   Created a session with an agent carrying an `x402Budgets` entry, extracted the agent's bearer
   secret from the spawn logs, stood up an x402 resource at `host.docker.internal:3002`, and called
   `POST /api/v1/agent-rpc/x402` (auth = `Authorization: Bearer <agentSecret>`; the route has **no**
   secret in the path — earlier assumption corrected). Results, layer by layer:
   - ✅ **Route + bearer auth** — works (`SessionAgent` principal resolved from the secret).
   - ✅ **Resource fetch + 402 detection** — works (the proxy always POSTs, ignoring `method`; had
     to make the resource answer POST). Returns a proper `X402ProxiedResponse`.
   - ❌ **Budget match** — fails with `"This agent does not have funds budgeted for this request"`,
     even though the budget resource string and amount match exactly. Root cause (source-proven):
     **`SessionAgent.x402BudgetedResources` (the list the proxy checks) is declared `= listOf()`
     and is never assigned anywhere** — the session's `x402Budgets` reaches `GraphAgent.x402Budgets`
     but is **never propagated to the `SessionAgent`**. So no agent can ever satisfy the budget
     check in this build. This is a third, independent wiring gap.
   - The handler is also full of `// todo`s (`"don't throw"`, `"use actual consumed amount"`,
     `"unpack this function to not send the first request twice"`), and `executeX402Payment` lives
     in the closed `blockchain:0.1.1` artifact and would still need the wallet to hold an SPL
     payment token — for which the OSS funding path (escrow/`reserve`) is **entirely commented out**.

   **Verdict:** native x402 settlement is **not completable in the published `coral-server`** — the
   feature is **half-built upstream** (disconnected budget plumbing + TODO-laden handler + closed
   payment artifact + no token-funding path), independent of our config or CORAL tokens. What IS
   real and proven: we fixed the wallet-load bug, the native `BlockchainService`/`X402Service` run
   live on devnet, the wallet is API-queryable, and the proxy's auth/fetch/402 path works. Going
   further means patching Coral's own unfinished feature (the budget→SessionAgent wiring is the next
   one-line patch) toward a payment step that still can't fund itself in OSS.

   **All of this was found and proven by testing, across many rebuilds — not by planning.**

**Remaining confirm-live item (one, down from several):** the x402 Solana `scheme`/`network`
literals in `server-x402.ts` — still `⚠️ CONFIRM-LIVE`, to be settled when a CORAL wallet is
configured for Gate C. The SessionRequest/Puppet shapes are now **verified** and baked into
`smoke-mcp.ts`.

**Install note:** `examples/track-1` and `scripts/smoke` are new packages — run `npm install` in
each before their scripts. `echo-agent` and `track-1` were already installed during verification.
