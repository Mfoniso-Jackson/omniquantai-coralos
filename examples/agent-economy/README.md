# Agent Economy on CoralOS

> A seller agent lists a service; buyers — **agent or human** — request it over CoralOS, pay in SOL
> on-chain, and the seller verifies the payment and delivers. **One protocol, one seller, three front
> doors** (autonomous · human checkout · swarm) — each its own tab in the demo UI.

Every payment is a real on-chain **devnet** transaction. CoralOS (coral-server) is the coordination
fabric — a pure MCP message bus. Payments are settled agent-side in SOL, so coral-server runs
**stock and wallet-free** (no patched image, no keypair in the server).

```
                      ┌──────────────────────────┐
                      │   coral-server :5555      │  stock, wallet-free MCP bus
                      └──────────┬───────────────┘
                  launches agents │ per session (Docker socket)
        ┌──────────────────────────┼──────────────────────────┐
   ┌────▼─────┐              ┌─────▼──────┐             ┌──────▼──────┐
   │  seller  │◀──request───▶│   buyer    │             │ user-proxy  │
   │  agent   │   /paid      │ (autonomous│             │  (human's   │
   │          │              │  pays SOL) │             │  stand-in)  │
   └────▲─────┘              └────────────┘             └──────▲──────┘
        │ same request/paid protocol                          │ puppet API
        └──────────────────── bridge :3010 ───────────────────┘
                          (Phantom front door)
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running (coral-server launches the agents)
- [Node.js 20+](https://nodejs.org)
- A funded devnet wallet + an LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` + `VENICE_API_KEY`; new accounts get $50 free via code `IMPERIAL50`), or Anthropic/OpenAI. See [LLM.md](../../LLM.md). Generate the wallet with `node ../../scripts/setup.js`.
- For the human door: [Phantom](https://phantom.com) set to **Devnet**.

## Build the agent images once

coral-server launches `seller-agent` / `buyer-agent` / `user-proxy` as containers, so build them first:

```sh
cd ../..                               # repo root
bash build-agents.sh seller
bash build-agents.sh buyer
docker build -t user-proxy:0.1.0 coral-agents/user_proxy
```

## Start coral-server

```sh
docker compose up -d coral             # stock coral-server, wallet-free config
```

---

## Front door 1 — autonomous (agent buys from agent)

```sh
cd examples/agent-economy/autonomous && npm install && npm start
```

Creates a session naming `[buyer-agent, seller-agent]` (passing each agent's required options from
`.env`). coral spawns both; the buyer opens a thread and runs the loop. Watch it settle:

```sh
docker logs -f buyer-agent     # "paying reference=…" → "received data"
docker logs -f seller-agent    # "payment verified — delivering service"
```

Each cycle is a real devnet tx — paste the sig into [explorer](https://explorer.solana.com/?cluster=devnet).

## Front door 2 — human checkout (wallet)

```sh
docker compose up -d coral bridge      # bridge builds + serves the React UI on :3010
# open http://localhost:3010  (Phantom or Solflare on Devnet) → Checkout tab
```

Connect a wallet, pick a service (Jupiter / CoinGecko / news / AI completion), click **Buy**. The
bridge injects your order into a CoralOS session *as* `user-proxy`, the seller replies with a Solana
Pay URL, your wallet signs the transfer, the seller verifies on-chain and delivers — the same seller
the autonomous buyer uses.

> The UI is the React app in [`web/`](web/), baked into the bridge image. For live UI edits run
> `just ui` (Vite hot-reload on :5173, proxied to the bridge). Headless check (no browser):
> `cd bridge && npm install && npm run smoke`.

## Front door 3 — swarm (broker + multiple sellers)

```sh
node ../../scripts/provision-swarm.js  # creates a broker wallet + two seller wallets → .env
# then fund the broker at https://faucet.solana.com (it pays the upstream sellers)
# open http://localhost:3010 → Swarm tab → Run the swarm demo
```

A **broker** agent shops two priced sellers (`seller-cheap` / `seller-premium`), buys from the cheaper
on-chain, and resells to the buyer at a markup — **two on-chain settlements per request**, money
flowing through a graph of agents. The broker reuses the kit's payment/wallet code; the two sellers
are thin manifests reusing the seller image. See [`coral-agents/broker/README.md`](../../coral-agents/broker/README.md).

## No Docker? — the quickstart

[`quickstart/`](quickstart/) is the same pay-per-call loop as two bare-metal Node processes over
plain HTTP `402` — no Docker, no CoralOS. The fastest way to understand the payment cycle.

## Want trustless settlement? — the escrow

The base loop is *pay-first* (the buyer trusts the seller to deliver).
[`../txodds/escrow/`](../txodds/escrow/README.md) is the **Anchor escrow contract** (the settlement
spine): the buyer deposits into a per-order PDA, the seller is paid only on release, and the buyer
can refund after a deadline. The escrow contract is already deployed to devnet — the agents call it
via `@coral-xyz/anchor`; no local build needed. The README there covers building/redeploying your own.

---

## The fork points

```
coral-agents/seller-agent/src/service.ts → deliverService(request)
    what gets sold. SERVICE env: jupiter | coingecko | news | inference (a Claude completion)

coral-agents/buyer-agent/src/{goal.ts, llm_buyer.ts}
    what the autonomous buyer wants + how it decides to pay (code-enforced budget)

coral-agents/broker/src/index.ts → the swarm's pick logic (which sellers, how it chooses, the markup)

config/coral.toml  → register a new agent (drop it in coral-agents/, add to localAgents)
bridge/server.ts   → a new human/front-door flow (a new bridge endpoint)
web/src/           → the React UI — add a service, a tab, a widget (see docs/EXPANDING_FRONTEND.md)
```

## How it's wired

| Piece | Role |
|---|---|
| `config/coral.toml` | wallet-free MCP config; registers the agents from `coral-agents/` |
| `autonomous/start.ts` | creates the `[buyer, seller]` session (with typed agent options) |
| `bridge/server.ts` | the hub: serves the React UI + the API (`/order`, `/autonomous/*`, `/swarm/*`); injects human orders as `user-proxy`, reads replies from session state |
| `web/` | the React demo UI — three tabs (Autonomous · Checkout · Swarm), built into the bridge image |
| `quickstart/` | no-Docker bare-metal 402 version |
| [`../txodds/escrow/`](../txodds/escrow/README.md) | the Anchor escrow contract (settlement spine) — deployed to devnet |
| `../../docker-compose.yml` | coral-server + bridge (run from repo root) |

Devnet only. Never put a funded mainnet keypair in `.env`.