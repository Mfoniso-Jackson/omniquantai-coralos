# Building an Agent Swarm with CoralOS

The base track is one buyer ↔ one seller. A **swarm** is the upgrade: *many* agents that discover,
negotiate, and **pay each other** — money flowing through a graph, not a single hop. This is the
"agent economy" headline (Tier 3 in `docs/HACKATHON.md`).

This guide shows what a swarm looks like on this kit, with a worked **broker** example.

> Status: this is a **blueprint** (like the escrow add-on) — a design + code shape you build out, not a
> drop-in. The base buyer/seller agents it composes are real and runnable.

---

## 1. What makes it a swarm — CoralOS

A swarm is possible because of one CoralOS fact: **a session can name as many agents as you want, and
every agent in it can open threads with and @mention every other agent.**

```
single track:   buyer-agent ──┄ CoralOS ┄── seller-agent

swarm:          buyer-agent ──┐
                              ├─┄ CoralOS ┄──┬── seller-cheap
                broker-agent ─┘              └── seller-premium
```

CoralOS doesn't "do" the swarm — it's the switchboard. **You** define the topology by (a) which agents
you put in the session graph and (b) who each agent talks to. Money still settles agent-to-agent on
Solana; CoralOS only carries the conversation.

Two surfaces to build a swarm on:

| Surface | Use when | Primitive |
|---|---|---|
| **CoralOS** (cross-container) | agents are separate programs/containers | a session graph of N agents, threads, `@mentions` |
| **The runtime** (in-process) | many agents in one Node process | `AgentManager` + `MessageBus` + `SharedState` + `WorkflowEngine` |

Most hackathon swarms use **CoralOS** (each agent is its own container, exactly like the seller/buyer).

---

## 2. Swarm patterns

| Pattern | Shape | Money flow |
|---|---|---|
| **Broker / router** | buyer → broker → N sellers | buyer pays broker; broker pays the chosen seller |
| **Marketplace** | N sellers advertise; buyers discover + pick | buyer pays the seller it chose |
| **Pipeline** | A → B → C (raw → enriched → report) | money flows down the chain, each hop a payment |
| **Arbiter / judge** | buyer + seller + judge | escrow releases only after the judge verifies delivery |
| **Auction** | buyer posts; sellers bid | buyer pays the winning bid |

We'll build the **broker** — it exercises everything (an agent that is *both* a buyer and a seller).

---

## 3. Worked example — a broker swarm

**Goal:** a buyer asks the broker for a service; the broker shops several sellers, buys from the
cheapest, and resells to the buyer at a small markup. Four agents in one CoralOS session:

```
buyer-agent ──"request jupiter"──▶ broker
                                     ├─ quotes seller-cheap  (0.0001 SOL)
                                     ├─ quotes seller-premium (0.0003 SOL)
                                     ├─ buys from seller-cheap   (broker PAYS on-chain)
                                     └─ resells to buyer at 0.00012 SOL (buyer PAYS the broker)
```

The broker reuses the kit's existing pieces: the **seller's** `payment.ts`
(`generatePaymentUrl` / `verifyPayment`) to charge the buyer, and the **buyer's** `wallet.ts`
(`payFromUrl`) to pay sellers.

### 3a. The broker agent — `coral-agents/broker/src/index.ts`

```ts
import { startCoralAgent } from '@pay/agent-runtime'
import { generatePaymentUrl, verifyPayment } from './payment.js' // copied from seller-agent
import { payFromUrl } from './wallet.js'                          // copied from buyer-agent

const SELLERS = ['seller-cheap', 'seller-premium']
const MARKUP = 1.2

await startCoralAgent({ agentName: 'broker' }, async (ctx) => {
  while (true) {
    // ── act as a SELLER to the buyer ─────────────────────────────────────────
    const ask = await ctx.waitForMention()                 // buyer → broker: "request <service>"
    if (!ask || !/^request/i.test(ask.text)) continue
    const service = ask.text.replace(/^request\s*/i, '').trim()

    // ── act as a BUYER to every seller: collect quotes ───────────────────────
    const quotes = []
    for (const seller of SELLERS) {
      const thread = await ctx.createThread([seller])
      await ctx.send(thread, `request ${service}`, [seller])
      const reply = await ctx.waitForMentionInThread(thread) // seller → broker: PAYMENT_REQUIRED
      const q = parsePaymentRequired(reply.text)             // { amount, url, reference }
      if (q) quotes.push({ seller, thread, ...q })
    }
    const best = quotes.sort((a, b) => a.amount - b.amount)[0]
    if (!best) { await ctx.reply(ask, 'NO_SELLERS_AVAILABLE'); continue }

    // ── buy from the cheapest seller (broker pays ON-CHAIN) ───────────────────
    const sig = await payFromUrl(best.url)                  // broker's keypair signs
    await ctx.send(best.thread, `paid ${sig} reference=${best.reference}`, [best.seller])
    const delivered = await ctx.waitForMentionInThread(best.thread)
    const data = delivered.text.replace(/^.*DELIVERED\s*/i, '')

    // ── resell to the buyer at a markup (broker is now the SELLER) ────────────
    const price = +(best.amount * MARKUP).toFixed(6)
    const { url, reference } = generatePaymentUrl(service, price)
    await ctx.reply(ask, `PAYMENT_REQUIRED reference=${reference} amount=${price} url=${url}`)

    const proof = await ctx.waitForMention()               // buyer → broker: "paid <sig> ..."
    const buyerSig = proof.text.match(/paid\s+(\S+)/)?.[1]
    if (await verifyPayment(buyerSig, reference))
      await ctx.reply(proof, `DELIVERED ${data}`)          // hand over the data it bought
  }
})
```

> **The one real subtlety:** `ctx.waitForMention()` is global, so a broker juggling several seller
> threads must correlate replies by `threadId`. The kit's `CoralMcpAgent` exposes the thread on each
> mention; wrap it as `waitForMentionInThread(thread)` (filter mentions by `threadId`). That's the main
> thing you implement beyond the base agents.

### 3b. Register it — `coral-agent.toml`

```toml
edition = 4
[agent]
name = "broker"
version = "0.1.0"
description = "Routes a request to the cheapest seller and resells at a markup."
[agent.license]
type = "spdx"
expression = "MIT"
[options]
BROKER_KEYPAIR_B58 = { type = "string", description = "Devnet keypair the broker pays sellers with" }
SELLER_WALLET      = { type = "string", description = "Where the broker receives the buyer's payment" }
SOLANA_RPC_URL     = { type = "string", default = "" }
MARKUP             = { type = "f64", default = 1.2 }
[runtimes.docker]
image = "broker:0.1.0"
```

`config/coral.toml` already scans `localAgents = ["/agents/*"]`, so dropping the folder in
`coral-agents/` auto-registers it. Add a `Dockerfile` (copy the seller's) and a `package.json` with
`"@pay/agent-runtime": "file:../../packages/agent-runtime"`.

### 3c. Launch the swarm — one session names all four

This is the *only* place the topology is declared — the agent graph:

```ts
const f64 = (value) => ({ type: 'f64', value })
const str = (value) => ({ type: 'string', value })

await fetch(`${CORAL}/api/v1/local/session`, {
  method: 'POST', headers: AUTH,
  body: JSON.stringify({
    agentGraphRequest: { agents: [
      localAgent('buyer-agent',    { BUYER_KEYPAIR_B58: str(BUYER_KEY), /* goal: "request jupiter" */ }),
      localAgent('broker',         { BROKER_KEYPAIR_B58: str(BROKER_KEY), SELLER_WALLET: str(BROKER_WALLET) }),
      localAgent('seller-cheap',   { SELLER_WALLET: str(WALLET_A), PRICE_SOL: f64(0.0001) }),
      localAgent('seller-premium', { SELLER_WALLET: str(WALLET_B), PRICE_SOL: f64(0.0003) }),
    ]},
    namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: 'default' } },
    execution: { mode: 'immediate' },
  }),
})
```

CoralOS spawns all four containers, connects them, and the broker drives the rest. Point the buyer's
goal at the **broker** instead of a seller, and the swarm runs.

---

## 4. How the money actually moves

Two on-chain settlements per request — that's the swarm being real:

```
1. broker → seller-cheap   0.0001  SOL   (broker buys the data)
2. buyer  → broker         0.00012 SOL   (buyer buys it from the broker; +20% markup)
```

Both are reference-bound `validateTransfer` payments, identical to the base track. The broker's margin
(`0.00002 SOL`) is its profit for routing — a real economic agent.

---

## 5. The in-process alternative (runtime swarm)

If your agents live in one Node process (not separate containers), use the runtime instead of CoralOS:

```ts
import { AgentManager } from '@pay/agent-runtime'

const mgr = new AgentManager()
mgr.createAgent('broker',         new BrokerStrategy())
mgr.createAgent('seller-cheap',   new SellerStrategy(0.0001))
mgr.createAgent('seller-premium', new SellerStrategy(0.0003))

// agents coordinate through the shared bus + blackboard:
mgr.bus.broadcast('broker', 'rfq', 'jupiter')          // request-for-quote to all
mgr.state.set('best-quote', { seller: 'seller-cheap', price: 0.0001 }, 'broker')
```

`MessageBus` (broadcast/direct) replaces CoralOS threads, `SharedState` is the shared blackboard, and
`WorkflowEngine` orders multi-step jobs. Same swarm, no containers — good for tightly-coupled logic or
tests.

---

## 6. What to build from here

- **Reputation** — sellers earn a score in `SharedState` (or an on-chain registry); the broker weights price *and* reliability.
- **Pipelines** — chain three sellers (data → enrichment → report); money flows through each.
- **Auctions** — broker posts a job, sellers bid, lowest bid wins.
- **Arbiter** — pair the swarm with the `escrow/` program: a judge agent releases funds only on verified delivery.
- **Multi-broker competition** — two brokers race to serve the buyer cheapest.

> The thesis, scaled up: **CoralOS coordinates *N* agents; Solana settles every edge of the graph.**
> A swarm is just more nodes and more payments — the primitives don't change.

See also: `docs/HACKATHON.md` (Tier 3), `packages/agent-runtime/README.md` (the runtime),
`examples/agent-economy/escrow/README.md` (trustless settlement for the arbiter pattern).
