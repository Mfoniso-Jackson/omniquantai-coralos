# OmniQuantAI CoralOS

> A CoralOS-powered marketplace where specialist financial research agents compete to sell investment
> intelligence, with the winning agent paid through Solana devnet escrow.

OmniQuantAI answers one fund-style research question:

```text
Should our fund increase exposure to Nvidia over the next 6 months?
```

The demo turns that question into an agent economy:

```text
Buyer request -> seller bids -> best-value award -> Solana escrow -> research delivery -> escrow release
```

Four seller agents compete:

| Agent | What it sells |
| --- | --- |
| Market Analyst | price action, momentum, valuation snapshot, market structure |
| News & Earnings | news, earnings themes, analyst sentiment, company developments |
| Macro Risk | rates, inflation, liquidity, macro pressure on growth equities |
| Portfolio Risk | concentration risk, downside cases, sizing controls, invalidation triggers |

The buyer does **not** simply pick the cheapest seller. It scores relevance, expected quality,
confidence, domain fit, delivery speed, price, and explanation quality. The winning seller delivers a
structured financial intelligence report in the React dashboard, and the existing Solana devnet escrow
flow shows deposit/release links.

This is research support only. It does not execute trades and is not financial advice.

## Hackathon Submission

- **Repository:** https://github.com/Mfoniso-Jackson/omniquantai-coralos
- **Submission summary:** [SUBMISSION.md](SUBMISSION.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **Demo script:** [docs/demo_script.md](docs/demo_script.md)
- **Remaining checklist:** [docs/remaining_for_submission.md](docs/remaining_for_submission.md)

## Quick Demo Run

```sh
npm run setup
```

Add an LLM key to `.env` for live bid reasoning. The core service output is deterministic for demo
reliability.

Fund the generated buyer wallet with devnet SOL, then run:

```sh
docker compose up -d coral
bash build-agents.sh
npm run marketplace
npm run marketplace:web
```

Open the marketplace web URL and watch:

1. Buyer broadcasts `WANT service=omniquant arg=nvda-6m-exposure`.
2. Four financial research agents bid.
3. Buyer awards the best-value seller.
4. Buyer deposits into Solana devnet escrow.
5. Winning seller delivers the report.
6. Arbiter releases escrow to the seller.
7. Dashboard shows the research and Explorer links.

## What Is Real vs Mocked

| Area | Status |
| --- | --- |
| CoralOS agent coordination | Real starter-kit CoralOS/MCP flow |
| Buyer/seller market protocol | Real WANT/BID/AWARD flow |
| Solana settlement | Real devnet escrow deposit/release flow |
| Seller personas | Real agent configs and market participants |
| Research content | Deterministic mock financial intelligence for reliable judging |
| Trading | Not included by design |
| Mainnet | Not enabled; devnet only |

## Original Starter Kit Context

This project is forked from the Solana x CoralOS starter kit below. OmniQuantAI keeps the agent market,
CoralOS coordination, dashboard, and Solana escrow rails, then replaces the default sports oracle story
with a financial intelligence marketplace.

# Agents that earn — a Solana × CoralOS starter kit

> **Fork-ready rails for autonomous services that get paid on-chain.** An LLM agent sells a service;
> buyers reason about value; sellers compete on price and quality; funds lock in a Solana **devnet**
> escrow; delivery triggers release; no-shows get refunded. The whole loop —
> **WANT → BID → AWARD → DEPOSITED → DELIVERED → RELEASED** — is already wired. Your job is **one
> function**: replace [`deliverService()`](examples/txodds/agent/service.ts) with something an agent can sell.

Don't spend the hackathon wiring up LLMs, agent coordination, bidding, frontend state, Solana Pay, and
escrow. That's all here and running on devnet. **Fork it, ask an LLM how to turn it into your paid agent
idea, and ship a marketplace in hours.** Every team can hand judges a live **Explorer link** proving the
payment settled on-chain.

> **Doing the [TxODDS World Cup hackathon](https://superteam.fun/earn/hackathon/world-cup)** ($50K across
> markets, trading agents, and fan experiences)? This kit already runs on TxODDS' live football API +
> Solana — **[TXODDS.md](TXODDS.md)** maps it to each track and shows the fork point for each.

## What you actually build (it's one function)

This kit turns an agent idea into a **settling economy**. You change three things — everything else (the
payment rails, the escrow, the competitive market, the live board) stays:

1. **The service** — [`deliverService()`](examples/txodds/agent/service.ts): the string a buyer pays for.
2. **The seller persona** — floor price, quality, inventory (a `coral-agent.toml`).
3. **The buyer's criteria** — how it reasons about value and picks a winner.

Some things agents can sell on these exact rails:

| Idea                       | what`deliverService()` returns                          | the buyer is paying for  |
| -------------------------- | --------------------------------------------------------- | ------------------------ |
| **Freelancer agent** | ad copy, a landing section, a tweet thread                | words that convert       |
| **Research agent**   | a sourced brief answering a question                      | a decision-ready summary |
| **Broker agent**     | routes the job to the best sub-agent, resells at a markup | one call instead of ten  |
| **Oracle agent**     | a verified fact / a checked output                        | trust in a number        |
| **Reseller agent**   | packages other agents' services into one                  | a bundle, one payment    |

> **The World Cup oracle is only the default demo — not the product.** It sells a verified, de-margined
> betting line to prove the rails work end-to-end. The invitation isn't "here's a repo about sports
> odds"; it's **"here are the rails for autonomous services with on-chain settlement — fork one function,
> change the persona, change the buyer criteria, and build the thing agents buy."**

## The loop, already wired

The competitive market runs one round as a chain of on-chain-anchored steps. All of it ships working:

```
WANT ─▶ BID ─▶ AWARD ─▶ DEPOSITED ─▶ DELIVERED ─▶ RELEASED
 │       │       │          │            │            │
 buyer   sellers buyer     funds lock   seller       escrow pays
 asks    compete picks    in escrow    delivers     the winner
                 best      (devnet)     the service  (or REFUNDED
                 value                               on a no-show)
```

| You get, prebuilt                                      | Where                                                                     | So you don't have to                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------ |
| **LLM brain** (Venice AI)                        | [`packages/agent-runtime/src/llm`](packages/agent-runtime/src/llm)       | wire an LLM SDK, prompts, JSON-guarding    |
| **Agent coordination** (CoralOS / MCP)           | [`packages/agent-runtime/src/coral`](packages/agent-runtime/src/coral)   | run a message bus, thread state, sessions  |
| **Bidding market** (WANT/BID/AWARD)              | [`packages/agent-runtime/src/market`](packages/agent-runtime/src/market) | invent a negotiation protocol              |
| **Frontend state** (live rounds/bids/settlement) | [`examples/marketplace/web`](examples/marketplace/web)                   | build a React app that streams the market  |
| **Solana Pay** (reference-bound transfers)       | [`packages/agent-runtime/src/solana`](packages/agent-runtime/src/solana) | hand-roll payment URLs + verification      |
| **Escrow** (deposit → release / refund)         | [`examples/txodds/escrow`](examples/txodds/escrow)                       | write, audit, and deploy an Anchor program |

## Prerequisites

Everything runs on **devnet** — free play money, real on-chain settlement. Keys live in a local `.env`
(none in the repo).

| Need                               | Why                                            | Get it                                                                                                                 |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Node 20+**                 | the runtime, the demo, the market              | [nodejs.org](https://nodejs.org)                                                                                        |
| **An LLM key**               | the agent's reasoning + delivery               | **Venice AI** (`VENICE_API_KEY`, **free credits** — see [LLM.md](LLM.md)). Anthropic / OpenAI also work. |
| **A funded devnet wallet**   | the buyer signs the escrow deposit → release  | generated in step 1; fund at[faucet.solana.com](https://faucet.solana.com)                                              |
| **Docker** *(market only)* | coral-server coordinates the multi-agent round | [docker.com](https://www.docker.com) — the single-agent demo needs none                                                |

## Quick start

### 1. Fork & set up (once)

```sh
git clone https://github.com/Mfoniso-Jackson/omniquantai-coralos.git && cd omniquantai-coralos
npm install --prefix scripts   # script deps (web3.js, bs58)
node scripts/setup.js          # creates .env + two devnet wallets (also saved to WALLETS.txt)
```

Open the generated `.env`, add your **Venice AI** key, then **fund the buyer wallet** at
[faucet.solana.com](https://faucet.solana.com) (GitHub sign-in — the only devnet faucet that works):

```ini
# This kit's LLM is Venice AI — OpenAI-compatible, with free credits for the hackathon.
LLM_PROVIDER=venice
VENICE_API_KEY=...
# Anthropic / OpenAI also work — see LLM.md
```

> **Free credits via Venice AI.** New accounts can redeem **$50 in credits**: sign up at
> [venice.ai](https://venice.ai), create a key at [venice.ai/settings/api](https://venice.ai/settings/api),
> and paste the redeem code **`IMPERIAL50`** into the box at the bottom of that API page. Default model
> `llama-3.3-70b` (override with `LLM_MODEL`). The code is a public referral — it may be per-account,
> rate-limited, or expire. Full provider/key/model switching (env **or** in code): **[LLM.md](LLM.md)**.

### 2. See the rails — pick a view

**Fastest (no Docker) — the single-agent demo.** One agent sells the default service and auto-settles:

```sh
npm run dev        # proxy (:8801) + demo UI (:3020), opens the browser
```

Select a fixture and watch the agent's read get delivered and the escrow settle **automatically** on
delivery — buyer funds → arbiter releases to the seller, each step linked on the Solana Explorer.

**The full market (Docker) — buyers + competing sellers.** The complete WANT → … → RELEASED loop:

```sh
docker compose up -d coral        # coral-server (the MCP coordinator)
bash build-agents.sh              # build the agent images (buyer + sellers)
npm run marketplace               # launch the auction (installs deps on first run)
npm run marketplace:web           # (optional, 2nd terminal) the React visualizer
```

A buyer broadcasts a WANT; LLM sellers compete with bids; the winner is escrowed, delivers, and gets
released — with a React visualizer of live rounds, bids, and settlement badges.

## Run the examples

One `npm run` per example, from the repo root. **Each command installs that example's deps on first run
(and builds the runtime if it needs it)** — no manual `npm install`. First do `npm run setup` once (wallets
→ `.env`) and add your Venice key.

| Command | Runs | Needs |
|---|---|---|
| `npm run dev` | **the default demo** — the oracle proxy + UI, auto-settles on delivery | funded wallet + LLM key (renders demo data without) |
| `npm run demo:coral` | the same oracle as a **multi-agent CoralOS round** (buyer + competing sellers) | Docker + `docker compose up -d coral` + a TxLINE token (`npm --prefix examples/txodds run mint`) |
| `npm run marketplace` | **the full market** — a buyer + LLM sellers bidding in one session | Docker + `docker compose up -d coral` + `bash build-agents.sh` |
| `npm run marketplace:web` | the market **visualizer** — live rounds, bids, settlement badges (:5173) | the marketplace feed running |
| `npm run agent-economy` | **autonomous** agent→agent purchase | Docker + `docker compose up -d coral` |
| `npm run agent-economy:bridge` | the **human checkout** bridge (HTTP + React) | Docker + `docker compose up -d coral` |
| `npm run agent-economy:quickstart` | the **bare 402** pay-per-call seller (no Docker, no CoralOS) | LLM key + funded wallet |
| `npm run agent-economy:quickstart:buyer` | the quickstart **buyer** (run in a 2nd terminal) | the quickstart server running |
| `npm run agent-economy:web` | the agent-economy **3-tab dashboard** | — (talks to the bridge) |

> **Docker ones** (`marketplace`, `demo:coral`, `agent-economy`, `:bridge`) coordinate over coral-server,
> so start it first: `docker compose up -d coral`, and `bash build-agents.sh` to build the agent images.
> **No-Docker ones** (`dev`, `agent-economy:quickstart`, `:web`, `marketplace:web`) run straight from Node.

## Make it yours

1. **Change the service.** Open [`examples/txodds/agent/service.ts`](examples/txodds/agent/service.ts) —
   the `deliverService()` fork point — and return your own value from `deliverService(request)`. Sell copy,
   a brief, a routed job, a verified fact. The default body sells World Cup odds; that's all it is.
2. **Change the seller.** Give your seller a persona (floor price, quality, inventory) in its
   `coral-agent.toml` under [`coral-agents/`](coral-agents).
3. **Change the buyer's criteria.** Tell the buyer how to value bids and pick a winner
   ([`coral-agents/buyer-agent`](coral-agents/buyer-agent)).

Stuck on the idea? **Ask an LLM: "given this loop and `deliverService()`, what paid agent should I
build?"** — the rails don't care what you sell.

## OmniQuantAI Demo

OmniQuantAI turns this starter kit into a no-trade financial intelligence marketplace. A buyer agent
asks whether a fund should increase Nvidia exposure over the next six months. Four specialist seller
agents compete to sell research, the buyer selects the highest-value bid, the winner delivers a
structured report, and payment settles through Solana devnet escrow.

This fits **agents that earn** because the seller agents are paid service providers. They compete on
domain fit, confidence, expected quality, delivery speed, price, and explanation quality.

### CoralOS Usage

The full market uses the existing CoralOS/MCP flow:

```text
WANT -> BID -> AWARD -> ESCROW_REQUIRED -> DEPOSITED -> DELIVERED -> RELEASED
```

The launcher in `examples/marketplace/start.ts` creates one buyer and four seller personas in a
CoralOS session. The buyer broadcasts the request and the sellers respond through the shared market
thread.

### Solana Escrow Usage

The demo preserves the existing arbiter-gated Solana devnet escrow flow. The buyer opens escrow after
selecting a winner. The seller verifies the funded escrow before delivering. After delivery, the
arbiter releases payment to the winning seller. The React dashboard links deposit and release
transactions to Solana Explorer.

### How To Run

```sh
npm run setup
```

Add your LLM key to `.env` if you want live LLM bid reasoning. The demo still has deterministic
fallback behavior for reliability.

Fund the generated buyer wallet with devnet SOL, then run:

```sh
docker compose up -d coral
bash build-agents.sh
npm run marketplace
npm run marketplace:web
```

Open the marketplace web URL and start a market session.

### Demo Prompt

```text
Should our fund increase exposure to Nvidia over the next 6 months?
```

The market wire format uses:

```text
service=omniquant
arg=nvda-6m-exposure
```

### Expected Flow

1. Buyer broadcasts a financial intelligence request.
2. Market Analyst, News & Earnings, Macro Risk, and Portfolio Risk agents bid.
3. Buyer scores bids by relevance, expected quality, confidence, domain fit, delivery time, price, and explanation quality.
4. Winner is selected and escrow terms are requested.
5. Buyer deposits SOL into devnet escrow.
6. Winning seller delivers a structured financial intelligence report.
7. Arbiter releases escrow to the seller.
8. Dashboard shows final investment thesis and settlement links.

### Limitations

- Financial data is deterministic mock research for demo reliability.
- Optional LLM reasoning can improve bid notes, but core economics are guarded in code.
- This is not financial advice and does not execute trades.

### Future Roadmap

- Multi-winner research bundles.
- Agent reputation and quality scoring.
- Refund/slashing policy for low-quality delivery.
- Live market/news/macro data providers.
- Portfolio-aware buyer mandates.
- Sui as a future settlement adapter alongside Solana.

## Under the hood — the runtime

Agents import [`packages/agent-runtime`](packages/agent-runtime) and write only behaviour. Four modules,
one per concern:

- **`llm/`** — [`complete()`](packages/agent-runtime/src/llm/complete.ts), one provider-agnostic call
  over `fetch` (no SDK). **Venice AI** is the kit's LLM; `LLM_PROVIDER` also accepts `anthropic` / `openai`,
  no code change (see **[LLM.md](LLM.md)**). The model **proposes**, code **disposes** — callers guard
  every number.
- **`solana/`** — Solana Pay helpers + [`solanaConnection()`](packages/agent-runtime/src/solana/connection.ts),
  the **devnet guard** that throws on a mainnet RPC unless `ALLOW_MAINNET=1`, so it applies everywhere
  value moves.
- **`coral/`** — a CoralOS (MCP) client + agent entrypoint: the coordination fabric the sellers and
  buyer meet on. Deep dive, source → example: **[CORAL.md](CORAL.md)**; official docs:
  [docs.coralos.ai](https://docs.coralos.ai/welcome).
- **`market/`** — the WANT/BID/AWARD wire format: the negotiation protocol, pure and testable.

### The escrow contract — the settlement spine

The only Rust in the kit: **two** deployed devnet programs, **called** (not forked) by the agents' TS
clients. The base escrow ([`escrow/lib.rs`](examples/txodds/escrow/programs/escrow/src/lib.rs)) is the
settlement spine; the arbiter ([`arbiter/lib.rs`](examples/txodds/escrow/programs/arbiter/src/lib.rs)) is
a trustless wrapper so the buyer can't take delivery **and** refund.

| Program                               | Instruction                                  | Does                                                                                     |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **escrow** `R5NWNg9...CeXet`  | `initialize(amount, reference, deadline)`  | buyer deposits SOL into a PDA seeded by`(buyer, reference)`                            |
|                                       | `release()` / `refund()`                 | buyer pays the seller on delivery / reclaims after the deadline                          |
| **arbiter** `FJtuVXsy...ktXd` | `open(amount, reference, deadline)`        | payer funds a**vault PDA** that becomes the escrow's buyer (payer can't claw back) |
|                                       | `arbitrate_release` / `arbitrate_refund` | only the**neutral arbiter** releases to the seller / refunds the payer             |

The escrow `reference` is **bound to the delivery** (`sha256(...)`), so the on-chain order provably *is*
the thing bought. Written to the Solana security checklist: `init` (never `init_if_needed`), `has_one` on
buyer **and** seller, `close = buyer`, checked math. It's already deployed — the demo runs against the
deployed ids with no local build. **Devnet only** — never put a funded mainnet key in `.env`. See
[`examples/txodds/escrow/README.md`](examples/txodds/escrow/README.md).

## Repo layout

| Directory                   | Purpose                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examples/txodds/`        | **the default demo** — the World Cup oracle. `agent/` (`service.ts` = the `deliverService()` fork point; `edge.ts` = its transform; escrow/arbiter clients), `server/` (proxy + mint), `web/` (React board), `escrow/` (the two Anchor programs) |
| `examples/marketplace/`   | **the full market** — a buyer + competing sellers in one CoralOS session; `feed/` (SSE feed → rounds), `web/` (React visualizer). Needs Docker                                                                                                            |
| `examples/agent-economy/` | **three front doors** on CoralOS — autonomous (agent→agent), a human checkout bridge, and a bare 402 pay-per-call quickstart                                                                                                                                  |
| `coral-agents/`           | the agents coral-server launches per session —`buyer-agent`, `seller-agent` (+ personas), `broker` (swarm reseller), `echo-agent`, `user_proxy`                                                                                                            |
| `packages/agent-runtime/` | the runtime —`llm/`, `solana/`, `coral/`, `market/`                                                                                                                                                                                                          |
| `scripts/`                | `txodds.js` (`npm run dev`), `setup.js` (devnet wallets)                                                                                                                                                                                                        |
| `docker-compose.yml`      | coral-server (the MCP coordinator) for the market                                                                                                                                                                                                                     |

## The LLM: Venice AI

This kit's agents think with **Venice AI** — OpenAI-compatible, with **free credits** to keep the
hackathon zero-cost. Anthropic and OpenAI are drop-in alternatives. Setup, the redeem code, model
choice, and how to switch providers in env **or in code**: **[LLM.md](LLM.md)**.

## Optional: Claude Code skills

**Solana dev skill** (Anchor, testing, payments):

```sh
npx skills add https://github.com/solana-foundation/solana-dev-skill --global --yes
```

## License

MIT
