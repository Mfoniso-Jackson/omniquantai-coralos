# CORAL.md — how CoralOS is wired in, source → agents → example

This is the deep dive on **CoralOS** in this kit: what it is, exactly where it's used (from the runtime
source to the running examples), and — the part that matters — **what CoralOS does that nothing else in
the kit does**. If you want the LLM equivalent of this doc, see [LLM.md](LLM.md).

> **Authoritative reference:** the official CoralOS docs — **https://docs.coralos.ai/welcome**. This
> doc links the exact page for each point, and the source files themselves carry the same links inline
> (`@see https://docs.coralos.ai/...`). The full page index is in §10.

---

## 0. TL;DR

- **CoralOS = `coral-server`**, a stock, pinned container ([docker-compose.yml](docker-compose.yml)) that
  plays **two roles**: (1) an **orchestrator** that launches your agents as Docker containers per session
  from a declarative graph, and (2) the **message bus** those agents coordinate over — threads,
  `@mentions`, and blocking waits, all exposed as **MCP tools**.
- **It holds no key.** coral-server runs **wallet-free** ([coral.toml](examples/txodds/coral/coral.toml)
  has no `[wallet]`); every payment is agent-side on Solana. Coral coordinates; agents settle.
- **Two worlds in this repo:**
  - `npm run dev` — the **single-agent** World Cup oracle — **does not touch Coral at all** (it's a proxy
    + a React page). Coral is not a dependency of the headline demo.
  - The **multi-agent** stories — the marketplace, the agent-economy front doors, and the TxODDS coral
    round — **run on Coral**. That's where every capability below is exercised.
- **The one-liner:** *Coral is what turns a folder of independent agent programs into a live, addressable,
  multi-party session — spawned on demand, talking over a shared bus, in any language — without any of
  them knowing where the others run or holding a wallet between them.*

---

## 1. The three layers

```
┌─ Layer 3 — orchestration + examples ────────────────────────────────────────┐
│  docker-compose.yml  coral-server (pinned)  ── launches containers ──▶       │
│  coral.toml          registry scan of /agents/*, auth, docker host           │
│  examples/txodds/coral/round.ts     POST /api/v1/local/session  (agent graph)│
│  examples/marketplace/start.ts      "  (buyer + persona sellers)             │
│  examples/agent-economy/bridge      "  + the puppet API (human → agent)      │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │ spawns, injects CORAL_CONNECTION_URL
                                   ▼
┌─ Layer 2 — the agents (coral-agents/*) ─────────────────────────────────────┐
│  buyer-agent  seller-agent (+seller-worldcup)  broker  echo-agent  user_proxy│
│  each: a coral-agent.toml manifest + a container image, an MCP participant   │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │ import { startCoralAgent, … }
                                   ▼
┌─ Layer 1 — the runtime (packages/agent-runtime/src) ────────────────────────┐
│  coral/mcp.ts     CoralMcpAgent — MCP client + the 4 primitives + runLoop    │
│  coral/server.ts  startCoralAgent() + CoralAgentContext (the ergonomic API)  │
│  market/protocol.ts  WANT/BID/AWARD… wire format (pure, network-free)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1 — the runtime: the MCP client (`packages/agent-runtime/src/coral/`)

Everything Coral-facing funnels through **one class** and **one entrypoint**.

### 2.1 `CoralMcpAgent` — [coral/mcp.ts](packages/agent-runtime/src/coral/mcp.ts)

A thin wrapper over the official MCP SDK (`@modelcontextprotocol/sdk`). On
[`connect()`](packages/agent-runtime/src/coral/mcp.ts#L41) it opens a **Streamable-HTTP** transport to
`CORAL_CONNECTION_URL`, then **`listTools()`** and *discovers the tool names by substring* rather than
hard-coding them ([mcp.ts:56-71](packages/agent-runtime/src/coral/mcp.ts#L56-L71)) — so it survives
coral-server renaming `coral_wait_for_mention` → `wait_for_mention`, etc.

The four primitives it exposes (each is one MCP `callTool`):

| Method                                                                                      | MCP tool                   | What it does                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`waitForMention(maxWaitMs)`](packages/agent-runtime/src/coral/mcp.ts#L82)                 | `coral_wait_for_mention` | **Blocks server-side** until someone `@mentions` this agent; returns `null` on timeout             |
| [`waitForAgent(name, maxWaitMs)`](packages/agent-runtime/src/coral/mcp.ts#L132)            | `coral_wait_for_agent`   | Blocks until a **specific agent** sends a message — used to wait for a counterparty to come *online* |
| [`sendMessage(content, threadId, mentions)`](packages/agent-runtime/src/coral/mcp.ts#L154) | `coral_send_message`     | Posts into a thread, `@mentioning` recipients                                                               |
| [`createThread(name, participants)`](packages/agent-runtime/src/coral/mcp.ts#L168)         | `coral_create_thread`    | Opens a new thread and returns its id                                                                        |

Plus two things worth calling out:

- [`waitForMentionInThread(threadId, …)`](packages/agent-runtime/src/coral/mcp.ts#L114) — waits but
  **drops mentions from other threads**, so one agent can juggle many concurrent conversations (the
  broker relies on this).
- [`parseMention(raw)`](packages/agent-runtime/src/coral/mcp.ts#L247) — coral-server's message envelope
  has drifted across versions (nested `messages[]`, a `message` key, or flat `text`); this normalizes all
  of them and detects the `"Timeout reached"` status so callers just get `null`.

### 2.2 `startCoralAgent()` — [coral/server.ts](packages/agent-runtime/src/coral/server.ts)

The ergonomic entrypoint every agent's `index.ts` calls. It reads
[`CORAL_CONNECTION_URL`](packages/agent-runtime/src/coral/server.ts#L48) (**injected by coral-server at
container start** — the agent never configures a host), connects, and hands the agent a
[`CoralAgentContext`](packages/agent-runtime/src/coral/server.ts#L25) with `waitForMention` / `reply` /
`send` / `createThread` / `waitForAgent`, plus clean SIGINT/SIGTERM shutdown. The whole agent-side Coral
API is those ~6 methods.

### 2.3 The market protocol — [market/protocol.ts](packages/agent-runtime/src/market/protocol.ts)

Coral moves **opaque strings**; it has no idea what a "bid" is. The market grammar
(`WANT`/`BID`/`AWARD`/`ESCROW_REQUIRED`/`DEPOSITED`) is defined here as **pure format/parse functions**
(so it's unit-tested with no network — see [protocol.test.ts](packages/agent-runtime/src/market/protocol.test.ts)).
The critical design point: **every message carries `round=<n>`**
([protocol.ts:64-67](packages/agent-runtime/src/market/protocol.ts#L64-L67)) because *many* messages from
*many* agents flow through *one* shared thread, and the round tag is how a reply is correlated back to its
request. That is a direct consequence of Coral's model (a shared bus, not point-to-point calls).

---

## 3. Layer 2 — the agents (`coral-agents/`)

Each agent is **a container image + a [`coral-agent.toml`](coral-agents/seller-agent/coral-agent.toml)
manifest** (name, version, and the typed `[options]` coral-server may inject). coral-server discovers
them by scanning `/agents/*` (see §4). They are built into images by
[build-agents.sh](build-agents.sh) via a multi-stage [Dockerfile](coral-agents/seller-agent/Dockerfile)
that bundles `packages/agent-runtime` and ends in `CMD ["node", "dist/index.js"]`.

The universal shape of an agent is the CoralOS loop:

```ts
await startCoralAgent({ agentName }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()   // block on the bus
    if (!m) continue                       // timeout → keep waiting
    /* parse m.text, do work, settle on Solana */
    await ctx.reply(m, response)           // answer in the same thread
  }
})
```

| Agent                                                 | Role                                                                                        | Coral features it leans on                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [buyer-agent](coral-agents/buyer-agent/src/index.ts)   | broadcasts `WANT`, collects bids, awards, settles                                          | `createThread('market', sellers)`, `waitForAgent` (wait for sellers to come online, [index.ts:96-99](coral-agents/buyer-agent/src/index.ts#L96-L99)), a timed `waitForMention` bid window |
| [seller-agent](coral-agents/seller-agent/src/index.ts) | bids on `WANT`s it can serve, delivers on funded escrow                                    | the plain `waitForMention → parse → reply` loop; **self-selection** (only bids on services in its inventory)                                                                          |
| seller-worldcup                                       | the World Cup specialist persona                                                            | **same image**, different `coral-agent.toml` defaults — personas are config, not code                                                                                                 |
| [broker](coral-agents/broker/src/index.ts)             | buys upstream, resells at a markup (two settlements)                                        | **one private thread per seller** + `waitForMentionInThread` to correlate quotes (§5.5)                                                                                               |
| [user_proxy](coral-agents/user_proxy/agent.py)         | a **Python** agent that idles as a named session member so a human can be impersonated | proves polyglot sessions + the puppet API (§5.7)                                                                                                                                              |
| echo-agent                                            | minimal test agent                                                                          | the loop, nothing else                                                                                                                                                                         |

Note the seller loop ([seller-agent/src/index.ts](coral-agents/seller-agent/src/index.ts)): a `WANT`
becomes a `BID`, an `AWARD` becomes `ESCROW_REQUIRED`, a `DEPOSITED` triggers an on-chain funded-escrow
check and then `DELIVERED` — **all reactions to mentions on a Coral thread**, with the money moving
off-Coral on Solana.

---

## 4. Layer 3 — orchestration & examples

### 4.1 coral-server config

- **[docker-compose.yml](docker-compose.yml)** runs `ghcr.io/coral-protocol/coral-server` **pinned by
  digest** (reproducible), exposes `:5555`, and mounts three things:
  `/var/run/docker.sock` (so it can **spawn agent containers**), the config, and the `coral-agents/`
  folder at `/agents`.
- **[coral.toml](examples/txodds/coral/coral.toml)**:
  - `[registry] localAgents = ["/agents/*"]` — **auto-discovery**: every agent folder becomes a launchable,
    name-addressable agent (`localAgentRescanTimer = "5s"` re-scans live).
  - `[auth] keys = ["dev"]` — bearer token the launchers send.
  - `[docker] address = "host.docker.internal"` — how a spawned agent reaches the host.
  - **No `[wallet]`** — the coordinator is deliberately custody-free.

### 4.2 The session API (how a "round" is born)

The launchers are ~150-line scripts that `POST /api/v1/local/session` with a **declarative agent graph**.
From [round.ts](examples/txodds/coral/round.ts#L105-L112):

```jsonc
{
  "agentGraphRequest": { "agents": [ buyer, sellerWorldcup, sellerFast, sellerPremium ] },
  "namespaceProvider": { "type": "create_if_not_exists", "namespaceRequest": { "name": "default" } },
  "execution": { "mode": "immediate" }
}
```

Each `agent` entry is `{ id, name, provider:{runtime:"docker"}, options }`, where `options` are the typed
values from that agent's `coral-agent.toml` (wallets, floor price, LLM keys, the TxLINE token). coral-server
then **starts one container per agent**, injects `CORAL_CONNECTION_URL` into each, and the round runs. The
same pattern drives [marketplace/start.ts](examples/marketplace/start.ts) (a buyer + persona sellers) and
[agent-economy/bridge/server.ts](examples/agent-economy/bridge/server.ts) (a seller + a `user-proxy`).

Two more endpoints the examples use:

- **`GET …/session/{ns}/{sid}/extended`** — the full session transcript/state; the bridge and the
  marketplace feed poll this to render the conversation ([bridge/server.ts:143](examples/agent-economy/bridge/server.ts#L143)).
- **`POST /api/v1/puppet/{ns}/{sid}/user-proxy/thread…`** — the **puppet API**: inject a message *as* an
  agent ([bridge/server.ts:109-112](examples/agent-economy/bridge/server.ts#L109-L112)). This is how a
  human joins (§5.7).

---

## 5. What ONLY CoralOS does here

This is the core of the question. Each item is something the kit **uses**, and which you would otherwise
have to **build yourself**. Each is tied to its authoritative doc:

| #   | Capability                              | CoralOS docs                                                                                                                                                        |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Per-session container orchestration     | [Sessions](https://docs.coralos.ai/concepts/sessions) · [Create session](https://docs.coralos.ai/api-reference/local/create-session)                                 |
| 5.2 | Name-based agent registry / discovery   | [Registry](https://docs.coralos.ai/api-reference/registry/get-registry-agents)                                                                                       |
| 5.3 | Thread messaging with `@mentions`      | [Threads](https://docs.coralos.ai/concepts/threads)                                                                                                                  |
| 5.4 | Server-side blocking coordination       | [Coordination](https://docs.coralos.ai/concepts/coordination)                                                                                                        |
| 5.5 | Multi-thread fan-out & correlation      | [Threads](https://docs.coralos.ai/concepts/threads)                                                                                                                  |
| 5.6 | Polyglot agents in one session          | [MCP](https://docs.coralos.ai/concepts/mcp) · [Writing agents](https://docs.coralos.ai/guides/writing-agents)                                                        |
| 5.7 | Puppet API + session state (human door) | [Puppet: send](https://docs.coralos.ai/api-reference/puppet/send-message) · [Extended state](https://docs.coralos.ai/api-reference/local/get-extended-session-state) |
| 5.8 | Namespaces, auth, execution modes       | [Create namespace](https://docs.coralos.ai/api-reference/local/create-namespace) · [Sessions](https://docs.coralos.ai/concepts/sessions)                             |

### 5.1 Per-session container orchestration from a declarative graph

You hand coral-server a JSON list of agents; it **spawns a Docker container per agent, per session**, wires
them to the bus, and tears them down after. Without Coral you'd write a container orchestrator + lifecycle
manager. *Used by:* every launcher (`round.ts`, `marketplace/start.ts`, the bridge).

### 5.2 A name-based agent registry / discovery

`localAgents = ["/agents/*"]` turns folders into agents addressable **by name**. The buyer `@mentions`
`"seller-worldcup"` with **no host, port, or address** — Coral resolves it. Without Coral: a service
registry + discovery. *Used by:* [coral.toml](examples/txodds/coral/coral.toml), and every `@mention`.

### 5.3 Thread-scoped messaging with `@mentions` (a bus, not sockets)

Agents never open a socket to each other. They post to **threads** and `@mention` recipients; there is no
direct A→B connection anywhere in `coral-agents/`. This is why the market protocol needs a `round` tag —
it's a shared channel. Without Coral: a message broker + routing. *Used by:* `sendMessage`/`reply`
everywhere; the shared `market` thread in [buyer-agent](coral-agents/buyer-agent/src/index.ts#L99).

### 5.4 Server-side blocking coordination (presence + long-poll)

`wait_for_mention` is a **server-held long-poll** (the agent blocks, no busy-loop), and
`wait_for_agent` blocks until a **named counterparty comes online** — so the buyer waits for its sellers
before broadcasting instead of sleeping and hoping
([buyer-agent index.ts:96-99](coral-agents/buyer-agent/src/index.ts#L96-L99)). Without Coral: presence
tracking + long-poll infra. *Used by:* [mcp.ts](packages/agent-runtime/src/coral/mcp.ts#L82).

### 5.5 Multi-thread fan-out & correlation (request/response over a bus)

The **broker** opens a **separate private thread per seller**, sends each a quote request, and uses
[`waitForMentionInThread`](packages/agent-runtime/src/coral/mcp.ts#L114) to correlate the right reply to
the right seller — a clean request/response overlay on top of pub/sub, with concurrent conversations that
don't cross-talk ([broker/src/index.ts:37-54](coral-agents/broker/src/index.ts#L37-L54)). This is the most
distinctly "Coral-only" pattern in the repo.

### 5.6 Polyglot agents in one session

[seller-agent](coral-agents/seller-agent/src/index.ts) is **TypeScript**;
[user_proxy](coral-agents/user_proxy/agent.py) is **Python**. They coexist in the same session and speak the
same MCP contract. Coral makes the language an implementation detail. Without Coral: a cross-language RPC
scheme you maintain.

### 5.7 Session state + the puppet API → a human front door

A person can't be an MCP agent. The bridge launches a real `user-proxy` agent, then **impersonates it**
via the puppet endpoint to inject the human's order, and **reads replies from the session's extended
state** (the puppet API is send-only) — see the file header and
[bridge/server.ts:109-143](examples/agent-economy/bridge/server.ts#L109-L143). That "human ↔ agent
economy" bridge is only possible because Coral exposes **inject-as-agent** and **read-session-state** as
first-class operations.

### 5.8 Namespaces, auth, and execution modes

Sessions are created under a **namespace** (`create_if_not_exists`), gated by a **bearer key**, and run in
`execution.mode = "immediate"` — session-management primitives the kit gets for free
([round.ts:105-112](examples/txodds/coral/round.ts#L105-L112)).

> **In one sentence:** without Coral you'd be hand-building a container orchestrator, a service registry, a
> message broker, presence/long-poll, request/response correlation, a polyglot agent contract, and a
> human-proxy — the kit gets all of that behind one MCP endpoint, and spends its own code on the *value*
> (the read) and the *settlement* (the escrow).

---

## 6. End-to-end: one round, mapped to Coral primitives

```
buyer-agent   createThread("market", [sellers])              → coral_create_thread
buyer-agent   WANT round=1 service=txline arg="edge 187…"    → coral_send_message  @sellers
seller-*      (each blocked in)                                 coral_wait_for_mention
seller-worldcup  BID round=1 price=0.00045 by=seller-worldcup → coral_send_message  @buyer
buyer-agent   (collects bids for a window, LLM picks best)
buyer-agent   AWARD round=1 to=seller-worldcup                → coral_send_message  @winner
seller-worldcup  ESCROW_REQUIRED round=1 reference=<sha256> … → coral_send_message  @buyer
   ── buyer deposits into the Solana arbiter escrow (OFF Coral, on devnet) ──
buyer-agent   DEPOSITED round=1 reference=<R> vault=<PDA> …   → coral_send_message  @seller
seller-worldcup  verifies funded escrow on-chain, delivers:
                 DELIVERED round=1 {teams, fair line, read}   → coral_send_message  @buyer
   ── buyer (or arbiter) releases escrow to the seller (OFF Coral, on devnet) ──
buyer-agent   ARBITER_RELEASED round=1 sig=<tx>              → coral_send_message  @seller
```

Every line left of the arrow that isn't marked "OFF Coral" is a Coral MCP tool call. The two "OFF Coral"
steps are pure Solana ([escrow](examples/txodds/escrow/README.md)) — the clean seam between
**coordination (Coral)** and **settlement (Solana)**.

---

## 7. Design decisions worth knowing

- **coral-server is wallet-free by design.** It coordinates; it never custodies funds. Every deposit,
  release, and refund is signed by an agent's own keypair against the Solana escrow. The trust boundary is
  small and obvious.
- **The web oracle skips Coral on purpose.** `npm run dev` is the fastest path to "see the rails" and
  needs no Docker; Coral is the *multi-agent* upgrade, not a hard dependency of the headline demo.
- **Personas are config, not code.** `seller-worldcup`, `seller-cheap`, and `seller-premium` all run the
  **one** `seller-agent` image; their behavior comes from `coral-agent.toml` options. Adding a competitor
  is a graph edit, not a new program.
- **Coral moves strings; the kit owns the grammar.** The [market protocol](packages/agent-runtime/src/market/protocol.ts)
  and the sha256-bound escrow `reference` live in *your* code, so you can fork the product without
  touching the transport.

---

## 8. How to expand this — with the CoralOS docs

Almost every extension below is a **config or graph change**, not a rewrite of the transport. Each links
the doc page that shows you how.

- **Add another agent to a round** — write a `coral-agent.toml` + a container image (or reuse an existing
  image with new options), then add it to the `agents:` list in a launcher. Docs:
  [Writing agents](https://docs.coralos.ai/guides/writing-agents),
  [Agent configuration](https://docs.coralos.ai/reference/agent),
  [Create session](https://docs.coralos.ai/api-reference/local/create-session).
- **Add a new seller persona (no code)** — a new `coral-agent.toml` with different `[options]` defaults
  reusing `seller-agent:0.1.0`; add its name to the graph. Docs:
  [Options table](https://docs.coralos.ai/reference/agent/tables/options).
- **Run an agent with a different runtime** — swap the Docker runtime for the executable or prototype
  runtime (e.g. run an agent as a local process while developing). Docs:
  [Docker](https://docs.coralos.ai/reference/agent/tables/runtimes/docker),
  [Executable](https://docs.coralos.ai/reference/agent/tables/runtimes/executable),
  [Prototype](https://docs.coralos.ai/reference/agent/tables/runtimes/prototype).
- **Let CoralOS manage the LLM** — instead of the kit's `complete()` fetch shim, declare an `[[llm]]`
  table in the manifest and let coral provide model access. Docs:
  [[[llm]] table](https://docs.coralos.ai/reference/agent/tables/llm).
- **Build a UI over a live session** — poll or read base/extended session state (the marketplace feed
  and the bridge already do this). Docs:
  [Get extended session state](https://docs.coralos.ai/api-reference/local/get-extended-session-state),
  [Integrating with your app](https://docs.coralos.ai/guides/integrating-with-your-app).
- **Drive agents as a human / another system** — use the puppet API to open threads and post messages as
  an agent (the bridge's exact pattern). Docs:
  [Send message](https://docs.coralos.ai/api-reference/puppet/send-message),
  [Create thread](https://docs.coralos.ai/api-reference/puppet/create-thread),
  [Add participant](https://docs.coralos.ai/api-reference/puppet/add-thread-participant).
- **Go beyond local agents** — pull agents from the registry/marketplace or linked servers instead of
  only `/agents/*`. Docs:
  [Registry](https://docs.coralos.ai/api-reference/registry/get-registry-agents),
  [Inspect marketplace agent](https://docs.coralos.ai/api-reference/registry/inspect-marketplace-registry-agent).
- **Take it to production** — run coral-server for real, incl. Docker-in-Docker for spawning agents,
  telemetry, and the Coral Console. Docs:
  [Running in production](https://docs.coralos.ai/guides/production/running-in-production),
  [Docker-in-Docker](https://docs.coralos.ai/guides/production/docker-in-docker),
  [Telemetry](https://docs.coralos.ai/features/telemetry),
  [Coral Console](https://docs.coralos.ai/concepts/coral-console),
  [Debugging](https://docs.coralos.ai/guides/debugging).
- **Fork the product, keep the transport** — replace [`deliverService()`](examples/txodds/agent/service.ts)
  and the [market grammar](packages/agent-runtime/src/market/protocol.ts); **none of the Coral wiring
  changes**. That seam — value/settlement is yours, coordination is Coral's — is the kit's whole thesis.

## 9. File map (quick reference)

| Path                                                                                                 | What it is                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [packages/agent-runtime/src/coral/mcp.ts](packages/agent-runtime/src/coral/mcp.ts)                    | The MCP client — connect, tool discovery, the 4 primitives, `parseMention` |
| [packages/agent-runtime/src/coral/server.ts](packages/agent-runtime/src/coral/server.ts)              | `startCoralAgent()` + `CoralAgentContext` (the agent-side API)           |
| [packages/agent-runtime/src/market/protocol.ts](packages/agent-runtime/src/market/protocol.ts)        | WANT/BID/AWARD… wire format (pure, round-correlated)                        |
| [coral-agents/*/coral-agent.toml](coral-agents/seller-agent/coral-agent.toml)                         | Per-agent manifest: name + typed `[options]` coral injects                  |
| [coral-agents/*/Dockerfile](coral-agents/seller-agent/Dockerfile) + [build-agents.sh](build-agents.sh) | Agents → container images coral launches                                    |
| [docker-compose.yml](docker-compose.yml)                                                              | Runs the pinned coral-server + mounts docker.sock, config, `/agents`        |
| [examples/txodds/coral/coral.toml](examples/txodds/coral/coral.toml)                                  | coral-server config: registry scan, auth, docker host (no wallet)            |
| [examples/txodds/coral/round.ts](examples/txodds/coral/round.ts)                                      | Launches the TxODDS round via `POST /api/v1/local/session`                  |
| [examples/marketplace/start.ts](examples/marketplace/start.ts)                                        | Launches the competitive market (buyer + persona sellers)                    |
| [examples/agent-economy/bridge/server.ts](examples/agent-economy/bridge/server.ts)                    | Human → agent bridge: the puppet API + extended-state reads                 |

See also: [coral-agents/buyer-agent/README.md](coral-agents/buyer-agent/README.md),
[coral-agents/seller-agent/README.md](coral-agents/seller-agent/README.md),
[coral-agents/broker/README.md](coral-agents/broker/README.md), and the round walkthrough in
[examples/txodds/coral/README.md](examples/txodds/coral/README.md).

---

## 10. Official CoralOS docs

Start at **https://docs.coralos.ai/welcome**. The pages this kit maps onto:

**Concepts**

- [MCP integration](https://docs.coralos.ai/concepts/mcp) — the interface `coral/mcp.ts` speaks
- [Threads](https://docs.coralos.ai/concepts/threads) — messages, `@mentions`, correlation
- [Sessions](https://docs.coralos.ai/concepts/sessions) — the per-round agent graph
- [Multi-agent coordination](https://docs.coralos.ai/concepts/coordination) — `wait_for_mention` / `wait_for_agent`
- [Coral Console](https://docs.coralos.ai/concepts/coral-console) · [Telemetry](https://docs.coralos.ai/features/telemetry)

**API reference**

- Local: [Create session](https://docs.coralos.ai/api-reference/local/create-session) ·
  [Create namespace](https://docs.coralos.ai/api-reference/local/create-namespace) ·
  [Extended session state](https://docs.coralos.ai/api-reference/local/get-extended-session-state) ·
  [Close session](https://docs.coralos.ai/api-reference/local/close-an-active-session)
- Puppet (human-in-the-loop): [Send message](https://docs.coralos.ai/api-reference/puppet/send-message) ·
  [Create thread](https://docs.coralos.ai/api-reference/puppet/create-thread) ·
  [Add participant](https://docs.coralos.ai/api-reference/puppet/add-thread-participant)
- Registry: [Get agents](https://docs.coralos.ai/api-reference/registry/get-registry-agents) ·
  [Agent graph model](https://docs.coralos.ai/api-reference/models/GraphAgentRequest)

**Reference (config)**

- [Agent configuration](https://docs.coralos.ai/reference/agent) ·
  [[agent] table](https://docs.coralos.ai/reference/agent/tables/agent) ·
  [[llm] table](https://docs.coralos.ai/reference/agent/tables/llm) ·
  [Options](https://docs.coralos.ai/reference/agent/tables/options)
- Runtimes: [Docker](https://docs.coralos.ai/reference/agent/tables/runtimes/docker) ·
  [Executable](https://docs.coralos.ai/reference/agent/tables/runtimes/executable) ·
  [Prototype](https://docs.coralos.ai/reference/agent/tables/runtimes/prototype)
- Server: [Server configuration](https://docs.coralos.ai/reference/server) ·
  [Running coral-server (Docker)](https://docs.coralos.ai/reference/server/docker)

**Guides**

- [Writing agents](https://docs.coralos.ai/guides/writing-agents) ·
  [Quickstart](https://docs.coralos.ai/guides/quickstart) ·
  [Integrating with your app](https://docs.coralos.ai/guides/integrating-with-your-app) ·
  [Running in production](https://docs.coralos.ai/guides/production/running-in-production) ·
  [Docker-in-Docker](https://docs.coralos.ai/guides/production/docker-in-docker) ·
  [Debugging](https://docs.coralos.ai/guides/debugging)
