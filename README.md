# World Cup Oracle — verified sports data, settled on Solana

> An **LLM agent** that sells a **verified TxODDS World Cup fair line** — live, de-margined odds turned
> into fair (break-even) prices + a one-line read — and settles every delivery through a **Solana escrow
> contract** on devnet. Reason · deliver · settle on-chain.

The agent fetches verified de-margined World Cup odds on **devnet**, turns each probability into its
fair (break-even) decimal odds plus a one-line read, and on delivery the buyer escrow **settles
automatically** — a real deposit→release you can open on the Solana Explorer. Everything runs on devnet:
free play money, real on-chain settlement. A forkable React dashboard renders the live board.

> **Two settlement modes.** The base escrow is **buyer-released** — the buyer deposits, releases on
> delivery, refunds after a deadline. That protects the *buyer*, but not the seller (a buyer could take
> delivery and refund). So the demo settles through the **arbiter** instead: a deployed wrapper program
> (`FJtuVXsy…ktXd`) where the buyer funds a vault it can't claw back, and a **neutral arbiter** releases
> to the seller on verified delivery — so neither side can cheat. The escrow `reference` is **bound to
> the read** (`sha256(fixtureId·favourite·fairOdds·nonce)`), so the on-chain order provably *is* the data
> bought. It's still a trusted-third-party arbiter (a production system would stake/decentralise it).

## The three pillars

Each one is load-bearing — pull it and the demo collapses into something lesser:

| Pillar | Its job | Remove it → |
|--------|---------|-------------|
| **Verified data (TxODDS)** | the proxy subscribes a devnet wallet to the free World Cup tier and fetches live, de-margined 1X2 odds | unverifiable numbers |
| **LLM** | turns the verified fair line into fair (break-even) odds + a one-line read — the sellable product | a static odds board |
| **Solana escrow** | a `reference` binds the deal; on delivery the buyer deposits and releases SOL to the seller (refundable after a deadline) | trust-me play money |

The product is the [`analyzeEdge()`](examples/txodds/agent/edge.ts) transform — verified odds → the fair
line + a read — shared between the proxy and the agent. That, and [`deliverService()`](examples/txodds/agent/service.ts),
are where you'd add your own.

## Prerequisites

Everything runs on **devnet** — free play money, real on-chain settlement. Keys live in a local `.env` (none in the repo). **No Docker required.**

| Need | Why | Get it |
|------|-----|--------|
| **Node 20+** | the proxy + web UI + runtime | [nodejs.org](https://nodejs.org) |
| **An LLM key** | the agent's one-line read | `ANTHROPIC_API_KEY` (default) — or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`. Full provider/key switching: **[LLM.md](LLM.md)** |
| **A funded devnet wallet** | the buyer signs the escrow deposit→release | generated in step 1; fund at [faucet.solana.com](https://faucet.solana.com) |

> The demo still renders without a key or funding — it shows clearly-labelled sample data and skips the
> on-chain settle. A funded wallet + LLM key turn on **live odds** and **real settlement**.

> **Do I need Docker?** No. The demo is two Node processes (a data/escrow proxy + a static web server),
> and the escrow contract is already deployed to devnet (its client fetches the IDL on-chain). Docker
> and the Anchor toolchain are only needed if you want to *rebuild/redeploy the escrow contract itself*.

## Quick start

### 1. Set up (once)

```sh
git clone https://github.com/trilltino/solana_coralOS.git && cd solana_coralOS
npm install --prefix scripts   # script deps (web3.js, bs58)
node scripts/setup.js          # creates .env + two devnet wallets (also saved to WALLETS.txt)
```

Open the generated `.env`, add your LLM key, then **fund the buyer wallet** at
[faucet.solana.com](https://faucet.solana.com) (GitHub sign-in — the only devnet faucet that works):

```ini
ANTHROPIC_API_KEY=sk-ant-…     # the agent's brain
# …or flip to OpenAI (no code change):
# LLM_PROVIDER=openai
# OPENAI_API_KEY=…
```

Provider/model/key switching is its own short guide — **[LLM.md](LLM.md)** (which provider wins, how to
change it, and the deterministic fallback when there's no key). Re-running `setup.js` re-reads your
`.env`, so it never clobbers the key you just added.

### 2. Run it

```sh
npm run dev        # = node scripts/txodds.js
```

This starts the **proxy** (live TxODDS data + escrow settlement, port 8801) and the **Oracle UI**
(port 3020), and opens the browser. Select a fixture and you'll see:

1. the **verified de-margined 1X2 board** with **fair (break-even) odds** per outcome,
2. the **agent's read** — the LLM's one-line read of the fair line + confidence,
3. the **arbiter settling automatically** on delivery — buyer funds → arbiter releases to the seller —
   open ↗ · release ↗ · escrow PDA ↗, linked on the Solana Explorer.

The board only ever shows fixtures with **verified live odds** (`/api/board`); it never invents
numbers. Without live data it falls back to a clearly-labelled demo board.

## How it works

`npm run dev` runs two processes (both under [`scripts/txodds.js`](scripts/txodds.js)):

- **[`server/proxy.ts`](examples/txodds/server/proxy.ts)** (:8801) — the browser can't hold the TxLINE
  token or sign Solana transactions, so this Node server does both: it subscribes the buyer wallet to
  the free World Cup tier on devnet, then serves live fixtures/odds and, on delivery, runs a real
  escrow `deposit → release`. Endpoints: `/api/board` (fixtures with verified 1X2 odds, inlined),
  `/api/edge` (the agent's call), `/api/settle` (the escrow round).
- **[`web/`](examples/txodds/web)** (:3020) — a no-build React app rendering the board, the agent's
  call, and the settlement links.

## Under the hood — the runtime

> **Two views of the same product.** `npm run dev` is the **single-agent** web oracle (proxy → read →
> arbiter settle). The **multi-agent** version is the **CoralOS round** — `docker compose up -d coral`
> then `npm run coral` (in `examples/txodds`): a buyer agent + a World Cup seller agent trade the same
> edge **over coral-server (MCP)** and settle through the escrow on devnet (a real `WANT → … → RELEASED`
> round). See [`examples/txodds/coral/`](examples/txodds/coral). The web view needs no Docker; the
> CoralOS round needs Docker (coral-server).

The agent imports [`packages/agent-runtime`](packages/agent-runtime) and writes only behaviour. Four
modules, one per concern:

- **`llm/`** — [`complete()`](packages/agent-runtime/src/llm/complete.ts), one provider-agnostic call
  over `fetch` (no SDK). Anthropic by default; `LLM_PROVIDER=openai` flips it with no code change (see
  **[LLM.md](LLM.md)**). The model **proposes**, code **disposes** — callers guard every number.
- **`solana/`** — Solana Pay helpers + [`solanaConnection()`](packages/agent-runtime/src/solana/connection.ts),
  the **devnet guard** that throws on a mainnet RPC unless `ALLOW_MAINNET=1`, so it applies everywhere
  value moves.
- **`coral/`** + **`market/`** — a CoralOS (MCP) client and the WANT/BID/AWARD market protocol. These
  power the **CoralOS round** (`examples/txodds/coral/` + `coral-agents/`): the buyer/seller agents that
  trade the edge over coral-server. The web oracle doesn't need them; the multi-agent round does.

### The escrow contract — the settlement spine

The only Rust in the kit: **two** deployed devnet programs, **called** (not forked) by the agent's TS
client. The base escrow ([`escrow/lib.rs`](examples/txodds/escrow/programs/escrow/src/lib.rs)) is the
settlement spine; the arbiter ([`arbiter/lib.rs`](examples/txodds/escrow/programs/arbiter/src/lib.rs))
is the trustless wrapper the demo settles through.

| Program | Instruction | Does |
|---------|-------------|------|
| **escrow** `R5NWNg9…CeXet` | `initialize(amount, reference, deadline)` | buyer deposits SOL into a PDA seeded by `(buyer, reference)` |
| | `release()` / `refund()` | buyer pays the seller on delivery / reclaims after the deadline |
| **arbiter** `FJtuVXsy…ktXd` | `open(amount, reference, deadline)` | payer funds a **vault PDA** that becomes the escrow's buyer (payer can't claw back) |
| | `arbitrate_release` / `arbitrate_refund` | only the **neutral arbiter** releases to the seller / refunds the payer |

The escrow is written to the Solana security checklist: `init` (never `init_if_needed`), `has_one` on
**both** buyer and seller, `close = buyer`, checked math; the arbiter signs for the vault PDA via CPI,
so no human key gates settlement after funding. **Devnet only** — never put a funded mainnet key in
`.env`. See [`examples/txodds/escrow/README.md`](examples/txodds/escrow/README.md) and
[`contract_extension.md`](examples/txodds/escrow/contract_extension.md).

## Repo layout

| Directory | Purpose |
|-----------|---------|
| `examples/txodds/` | the World Cup Oracle — `agent/` (edge transform + escrow/arbiter clients), `server/` (proxy + mint), `web/` (React board), `coral/` (the CoralOS round launcher), `escrow/` (the two Anchor programs) |
| `coral-agents/` | the agents coral-server launches for the round — `buyer-agent`, `seller-agent` (+ the `seller-worldcup` persona) |
| `packages/agent-runtime/` | the runtime — `llm/`, `solana/`, `coral/`, `market/` |
| `scripts/` | `txodds.js` (`npm run dev`), `setup.js` (devnet wallets) |
| `docker-compose.yml` | coral-server (the MCP coordinator) for the CoralOS round |

## Optional: Claude Code skills

**Solana dev skill** (Anchor, testing, payments):

```sh
npx skills add https://github.com/solana-foundation/solana-dev-skill --global --yes
```

## License

MIT
