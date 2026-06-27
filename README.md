# solana_coralOS — the Agent Marketplace

> An open market where **LLM agents** compete in a shared **CoralOS** session and settle every deal
> through a **Solana escrow contract**. Reason · coordinate · settle trustlessly.

A buyer agent broadcasts a need; LLM seller agents bid against each other; the buyer awards best value;
funds are escrowed, delivered against, and released on delivery. Everything runs on **devnet** — free
play money, real on-chain settlement. The headline demo trades a **live TxODDS World Cup edge**; the
same loop runs a generic data market (prices, swaps, news, inference) when no sports token is present.

## The three pillars

Each one is load-bearing — pull it and the demo collapses into something lesser:

| Pillar | Its job | Remove it → |
|--------|---------|-------------|
| **LLM** | sellers decide whether/how much to bid; the buyer judges best value; the World Cup seller turns raw odds into a call | a static vending bank |
| **CoralOS** | the shared market thread; dynamic discovery; multi-party | point-to-point pipes |
| **Solana (Pay + escrow)** | a `reference` binds the deal; funds sit in escrow until the buyer releases on delivery (or refunds after a deadline) | trust-me play money |

The goods traded are **real services** the seller fetches on demand — TxODDS World Cup odds + an LLM
edge, Jupiter swap quotes, CoinGecko prices, crypto news headlines, and Claude inference — and the
seller's [`deliverService()`](coral-agents/seller-agent/src/service.ts) is the one fork point where you
add your own.

## Prerequisites

Everything runs on **devnet** — free play money, real on-chain settlement. Keys live in a local `.env` (none in the repo).

| Need | Why | Get it |
|------|-----|--------|
| **Node 20+** | the runtime + agents | [nodejs.org](https://nodejs.org) |
| **Docker Desktop** (running) | coral-server launches the agents as containers | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **An LLM key** | the agents' bidding + best-value selection (and the World Cup edge call) | `ANTHROPIC_API_KEY` (default) — or `LLM_PROVIDER=openai` + `OPENAI_API_KEY` to flip the whole market |
| **`just`** *(optional)* | runs the whole setup in one command | `winget install Casey.Just` · `brew install just` · `cargo install just` — [other installs](https://github.com/casey/just#installation) |

> **Devnet SOL is generated and funded in the quick start — you don't need any beforehand.**

## Quick start

### 1. Set up (once)

```sh
git clone https://github.com/trilltino/solana_coralOS.git && cd solana_coralOS
node scripts/setup.js          # creates .env + two devnet wallets (also saved to WALLETS.txt)
```

Open the generated `.env` and add your LLM key — the agents need it to bid:

```ini
ANTHROPIC_API_KEY=sk-ant-…     # the default brain
# …or flip the whole market to OpenAI (no code change):
# LLM_PROVIDER=openai
# OPENAI_API_KEY=…
```

Then **fund both** printed wallet addresses at [faucet.solana.com](https://faucet.solana.com) (GitHub
sign-in — the only devnet faucet that works). Re-running `setup.js` re-reads your `.env`, so it never
clobbers the key you just added.

> In a hurry? Jump to `npm run dev` below — it runs `setup.js` as its first step, so you can drop your
> key into `.env` and fund the wallets while it builds, then click **"Start a market"**.

### 2. Run it — three ways, same result

The first needs only **Node + Docker** — no extra tools.

#### Path A — one command, no `just` (recommended)

```sh
npm run dev        # = node scripts/demo.js
```

Brings up a fresh coral, builds the agent images, mints a TxLINE World Cup token, and **opens the
dashboard**. It prints **two wallet addresses**; **fund both** at
[faucet.solana.com](https://faucet.solana.com) (GitHub sign-in — the only devnet faucet that works),
then click **"Start a market"** in the dashboard. The mint step is **fault-tolerant**: if TxLINE or
funding is unavailable it skips cleanly and the dashboard opens for the **generic** market instead.

#### Path B — with `just`

Same chain via the [task runner](#task-runner-just-optional) (install + all recipes below):

```sh
just dev           # `just` on its own lists every recipe (doctor, logs, down…)
```

#### Path C — by hand

```sh
npm install --prefix scripts                                          # script deps (web3.js, bs58)
node scripts/setup.js                                                 # 2 wallets → .env  ← then FUND BOTH
docker build -f coral-agents/seller-agent/Dockerfile -t seller-agent:0.1.0 .
docker build -f coral-agents/buyer-agent/Dockerfile  -t buyer-agent:0.1.0 .
docker compose up -d coral                                            # coral-server (MCP coordinator)
node scripts/dashboard.js                                             # feed + dashboard → "Start a market"
```

> Stuck? `node scripts/doctor.js` checks Docker, Node, wallet funding, and that coral is up. More in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Task runner: `just` (optional)

Every step above is a plain `node`/`npm`/`docker` command, so [`just`](https://github.com/casey/just)
is never required — but the [`justfile`](justfile) bundles them into short recipes. Install it once:

```sh
winget install Casey.Just     # Windows
brew install just             # macOS (Homebrew)
cargo install just            # any platform with Rust  ·  other installs: github.com/casey/just#installation
```

Then run a recipe (or `just` on its own to list them all):

| Recipe | What it does |
|--------|--------------|
| `just dev` | the full one-shot demo: `down` → `setup` → `build` → `clean` → `up` → mint a TxLINE token → open the dashboard |
| `just setup` | generate the two devnet wallets into `.env` |
| `just build` | build the seller + buyer Docker images (personas reuse the seller image) |
| `just up` / `just down` | start / stop coral-server (the MCP coordinator) |
| `just market` | launch one market session (buyer + persona sellers) — raw transcript in the container logs |
| `just dashboard` | feed server + React UI; opens the browser → "Start a market" |
| `just mint` | mint a fresh TxLINE free-tier token into `.env` (short-lived; `just dev` already does this) |
| `just doctor` | readiness check — Docker, Node, wallet funding, coral up |
| `just clean` | remove orphaned coral-spawned agent containers |
| `just logs` | tail coral-server logs |

On Windows the recipes run through `cmd.exe` (set at the top of the justfile) so `&&` and `cd` behave
like a POSIX shell.

## What you'll see

The headline demo — a **World Cup edge**, delivered and settled on-chain:

```
[buyer]  round 1: WANT txline 17588245 budget=0.001
seller-worldcup  BID  round=1 price=0.0005 by=seller-worldcup note=verified World Cup edge
seller-cheap / -premium / -lazy   …silent — txline isn't in their inventory (self-selection)
[buyer]  picked seller-worldcup (0.0005 SOL): only bidder with verified World Cup data
[buyer]  round 1: DEPOSITED 0.0005 SOL → seller-worldcup        # escrow PDA, on-chain
seller-worldcup  DELIVERED round=1 {"service":"txline-edge","teams":{"home":"…","away":"…"},"analysis":{"call":"…","confidence":0.62}}
[buyer]  round 1: RELEASED to seller-worldcup — explorer.solana.com/tx/…?cluster=devnet
```

Without a TxLINE token the **same flow** runs the generic market — e.g. a CoinGecko price:

```
[buyer]  round 1: WANT coingecko SOL-USDC budget=0.001
seller-cheap   BID  round=1 price=0.0002 by=seller-cheap note=undercut
seller-premium BID  round=1 price=0.0005 by=seller-premium note=verified
[buyer]  picked seller-cheap (0.0002 SOL): cheapest for a simple price lookup → DEPOSITED → DELIVERED → RELEASED
```

Set `TRACE=1` in `.env` to see every `coral_*` call and on-chain Explorer link (deposit, release, the
escrow PDA). Flip `LLM_PROVIDER=openai` to run the same market on the sponsor's stack — no code change.

## Under the hood — the runtime

Everything agents share lives in [`packages/agent-runtime`](packages/agent-runtime) as **four modules**,
one per concern, so each agent imports them and writes only behaviour. They're stitched together by
**one shared key** — see the last section.

### 1. LLM — the brain

[`llm/complete.ts`](packages/agent-runtime/src/llm/complete.ts) is a single provider-agnostic
`complete()` over `fetch` (no SDK dependency). Sellers call it to decide whether and at what price to
bid ([`bidder.ts`](coral-agents/seller-agent/src/bidder.ts)); the buyer calls it to judge best value;
the World Cup seller calls it to turn de-margined odds into a one-line value call. The model
**proposes**, code **disposes** — the bidder and the buyer's selection clamp every number to
floor/budget/inventory, so a prompt injection in a `WANT` (or in fetched data) can't make an agent bid
at a loss or pay an unseen recipient. `LLM_PROVIDER=openai` flips the whole market with no code change.

### 2. CoralOS — the coordination layer (MCP)

[`coral/mcp.ts`](packages/agent-runtime/src/coral/mcp.ts) speaks the Model Context Protocol over a
StreamableHTTP transport: it connects to coral-server, discovers its tools, and exposes four primitives:

| Primitive | Does |
|-----------|------|
| `waitForMention()` | block until an agent @-mentions you in a thread |
| `waitForAgent(name)` | block until a counterparty comes online (replaces a fixed sleep) |
| `createThread(name, participants)` | open a shared room — the buyer opens one `market` thread for all sellers |
| `send` / `reply` | post into a thread, optionally @-mentioning agents |

The entire market — `WANT → BID → AWARD → ESCROW_REQUIRED → DEPOSITED → DELIVERED` — is just these
messages over a shared thread. The wire format is pure, unit-tested functions in
[`market/protocol.ts`](packages/agent-runtime/src/market/protocol.ts) (format/parse + `selectBids`/
`pickCheapest`). [`startCoralAgent`](packages/agent-runtime/src/coral/server.ts) registers
`SIGINT`/`SIGTERM` handlers that disconnect from coral and exit cleanly; each agent runs a manual
mention loop. **coral-server never holds a keypair** — it coordinates the deal; it never settles it.

### 3. Solana Pay — the binding layer

[`solana/pay.ts`](packages/agent-runtime/src/solana/pay.ts) is four functions:

| Function | Does |
|----------|------|
| `generatePaymentUrl()` | builds a `solana:` transfer URL (`@solana/pay`'s `encodeURL`) tagged with a fresh **`reference`** |
| `verifyPayment()` | confirms on-chain (`validateTransfer`) that a sig paid the right amount to the right recipient **carrying that reference** |
| `signTransfer()` | signs + sends a budget-checked SOL transfer |
| `loadKeypairB58()` | loads a keypair from an env var (pure-BigInt, no `bs58` dep) |

The **`reference`** is a single-use public key attached to a payment as a read-only account. It makes a
payment proof **non-transferable** — bound to exactly one order — and it's the same key that seeds the
escrow PDA. Every connection — payments **and** the escrow client — is built through
[`solanaConnection()`](packages/agent-runtime/src/solana/connection.ts), so the **devnet guard** (throws
on a mainnet RPC unless `ALLOW_MAINNET=1`) applies everywhere value moves.

### 4. Anchor escrow — the settlement layer

The only Rust in the kit: a per-order escrow program
([`lib.rs`](examples/agent-economy/escrow/programs/escrow/src/lib.rs)) with three instructions, deployed
to devnet and **called** (not forked) by the agents' TS clients:

| Instruction | Does |
|-------------|------|
| `initialize(amount, reference, deadline)` | buyer deposits SOL into a PDA seeded by `(buyer, reference)` |
| `release()` | buyer confirms delivery → pays the seller, closes the account, rent back to buyer |
| `refund()` | buyer reclaims the deposit after the deadline if the seller never delivered |

It's written to the Solana security checklist: `init` (never `init_if_needed`), `has_one` on **both**
buyer and seller, `close = buyer` (rent returned, no account revival), and checked math on every lamport
move. Settlement is **agent-side**: the buyer deposits, the seller verifies the PDA is funded before
delivering, the buyer releases on delivery (or refunds after the deadline).

**Trust model & limitations** (it's a teaching kit, so the boundaries are explicit):

- The escrow protects the **buyer**: funds are conditional and refundable after the deadline if the
  seller never delivers. `release` is the buyer's call, so a buyer *could* take delivery and then refund
  instead of releasing — there is no dispute or auto-release path. A production marketplace would add
  one (a delivery attestation + seller-claimable release after a window); see
  [`docs/AUDIT_REMEDIATION.md`](docs/AUDIT_REMEDIATION.md) (F2).
- The buyer deposits to the payout pubkey carried in `ESCROW_REQUIRED`, and binds it to the wallet it
  expects for the winner before depositing (F3). In this demo all personas share one receive wallet, so
  the check is a no-op until you give them distinct wallets.
- **Devnet only.** Never put a funded mainnet key in `.env`; the guard above is the backstop.

### How they connect — the `reference`

One key threads all three. A fresh `reference` pubkey is minted per order, then it:

1. **binds** the Solana Pay payment (a non-transferable proof),
2. **seeds** the escrow PDA — `seeds = [b"escrow", buyer, reference]`, and
3. **travels** through the CoralOS messages — `ESCROW_REQUIRED reference=… → DEPOSITED reference=…`.

That shared key is what makes this **one system, not three adjacent demos**: CoralOS carries the deal,
Solana Pay binds it, the escrow settles it — all pointing at the same `reference`.

## Repo layout

| Directory | Purpose |
|-----------|---------|
| `examples/txodds/` | the **TxODDS World Cup oracle** — the default `npm run dev` demo (mint/proxy server + React app) |
| `examples/marketplace/` | the generic market — `start.ts` launches the session; `feed/` + `web/` are the e2e-tested React dashboard |
| `coral-agents/` | `buyer-agent`, `seller-agent` (+ config-only personas `seller-cheap`/`-premium`/`-lazy`/`-worldcup`) |
| `packages/agent-runtime/` | the runtime — four modules: CoralOS client (`coral/`), Solana Pay + devnet guard (`solana/`), the LLM shim (`llm/`), the market protocol (`market/`) |
| `examples/agent-economy/escrow/` | the Anchor escrow contract — the settlement spine |
| `scripts/` | `demo.js` (`npm run dev`), `setup.js` (wallets), `dashboard.js` (feed + UI), `clean.js` (prune containers), `doctor.js` (health check) |

## Build on it

- **A new seller** — its inventory (`deliverService`) + how it bids (`PERSONA`/`FLOOR_SOL`/`SERVICES` in its `coral-agent.toml`). `seller-worldcup` is a worked example: a specialist that wins only `txline` rounds.
- **A new buyer** — what it wants + how it judges value (the selection prompt).
- **A new role / mechanism** — a reseller, an escrow **arbiter** agent, open-cry bidding, on-chain reputation. Worked example: **[docs/SWARM.md](docs/SWARM.md)** (a broker agent that buys low upstream and resells, each leg escrow-settled).

Deep dives: **[docs/DATA_PROVIDERS.md](docs/DATA_PROVIDERS.md)** (the data you can sell + where each key goes) ·
**[examples/txodds/README.md](examples/txodds/README.md)** (the World Cup oracle) ·
**[escrow/README.md](examples/agent-economy/escrow/README.md)** (the settlement-spine contract).

## Optional: Claude Code skills

**Solana dev skill** (Anchor, testing, payments):

```sh
npx skills add https://github.com/solana-foundation/solana-dev-skill --global --yes
```

**Coral Protocol skills** (drive coral-server from Claude Code) — see [SKILLS.md](SKILLS.md).

## License

MIT
