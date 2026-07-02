# Marketplace — the headline example

An open market where **LLM** seller agents compete in a shared **CoralOS** thread and the winner is
settled through the **Solana escrow contract**. One buyer broadcasts a need; persona sellers bid; the
buyer awards best value; funds are escrowed, delivered against, and released on delivery. The product
sold is the verified **TxODDS World Cup read** (the `txline` service) — the same one the oracle sells.

```
WANT txline → (sellers bid) → AWARD best value → deposit (escrow) → DELIVERED → release
```

> **CoralOS docs:** the market is one [Session](https://docs.coralos.ai/concepts/sessions) of agents on a
> shared [thread](https://docs.coralos.ai/concepts/threads); [Writing agents](https://docs.coralos.ai/guides/writing-agents)
> shows how to add your own. Full wiring: [/CORAL.md](../../CORAL.md).

## Run it

Prereqs:
- Docker + a funded devnet wallet pair (`node scripts/setup.js`).
- A free **TxLINE token** — the market sells verified World Cup data, so mint one with `npm run mint`
  in `examples/txodds` (writes `TXLINE_API_KEY` to `.env`). Without it, `npm start` exits with a hint.
- An LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` + `VENICE_API_KEY`; new accounts get
  $50 free via code `IMPERIAL50` at [venice.ai/settings/api](https://venice.ai/settings/api)).
  `ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`, work too — no code change (see
  [../../LLM.md](../../LLM.md)).

The escrow program is already deployed to devnet — no `anchor deploy` needed.

```sh
(cd examples/txodds && npm run mint)       # one-time: free devnet TxLINE token → .env
bash build-agents.sh seller buyer          # build the two agent images (sellers reuse the seller image)
docker compose up -d coral                 # CoralOS (MCP coordinator)
cd examples/marketplace && npm install && npm start
```

Then watch the market:

```sh
docker logs -f buyer-agent     # WANT → AWARD (with a reason) → DEPOSITED → RELEASED
docker logs -f seller-cheap    # BID → ESCROW_REQUIRED → DELIVERED
```

## What you'll see

```
[buyer]  round 1: WANT txline fixtures budget=0.001
seller-cheap    BID round=1 price=0.0002 by=seller-cheap note=undercut
seller-premium  BID round=1 price=0.0005 by=seller-premium note=verified
seller-worldcup BID round=1 price=0.00045 by=seller-worldcup note=specialist
[buyer]  picked seller-cheap (0.0002 SOL): cheapest for the fixture list
[buyer]  round 1: DEPOSITED 0.0002 SOL → seller-cheap
seller-cheap   DELIVERED round=1 {"service":"txline-fixtures","count":…}
[buyer]  round 1: RELEASED to seller-cheap — https://explorer.solana.com/tx/…?cluster=devnet
```

## Knobs (`.env` or the session options)

| Var | Effect |
|-----|--------|
| `BUYER_ARG` | the txline request (`fixtures` default; `edge <fixtureId>` for the headline read) |
| `LLM_PROVIDER=venice\|openai` | flip the whole market to another provider — no code change (Venice is the kit default) |
| `TRACE=1` | log the `coral_*` calls + Explorer links for the escrow PDA, deposit, and release |
| `BUYER_MAX_SOL` | the budget cap each round |

## Visualize it (optional React dashboard)

Watch the auction in a browser instead of the logs — a read-only visualizer (no wallet) that renders
each round's bids, the winner + reasoning, and the escrow settlement with Explorer links:

```sh
just feed            # the feed server on :4000 (in another shell)
just dashboard       # the UI on :5173 → open ?session=<the market session id>
```

It's e2e-tested with fixtures (no devnet needed) — see [`web/`](web/README.md).

## Demo flourishes

- **Drop in a competitor live:** add a fourth seller to `start.ts`'s graph — it bids next round with
  zero buyer edits.
- **Flip the brain:** set `LLM_PROVIDER=venice` (or `openai`) and re-run — same market, a different LLM stack.

For the full protocol and escrow flow, see the agents that implement it:
[`buyer-agent`](../../coral-agents/buyer-agent/README.md) (WANT → AWARD → deposit → release) and
[`seller-agent`](../../coral-agents/seller-agent/README.md) (BID → ESCROW_REQUIRED → DELIVERED).
