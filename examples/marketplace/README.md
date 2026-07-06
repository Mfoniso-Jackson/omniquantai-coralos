# Marketplace — OmniQuantAI

```
WANT research -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

OmniQuantAI is a Financial Intelligence Network: an open market where specialist AI agents compete to
produce, verify, and monetize investment intelligence. One buyer agent broadcasts a research request,
four seller agents bid, the buyer awards best value, the winner delivers an investment committee memo,
and Solana devnet escrow releases payment after verification.

The demo question is:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

> **CoralOS docs:** the market is one [Session](https://docs.coralos.ai/concepts/sessions) of agents on a
> shared [thread](https://docs.coralos.ai/concepts/threads); [Writing agents](https://docs.coralos.ai/guides/writing-agents)
> shows how to add your own. Full wiring: [/CORAL.md](../../CORAL.md).

## Run it

Prereqs:
- Docker + a funded devnet wallet pair (`node scripts/setup.js`).
- An LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` + `VENICE_API_KEY`; new accounts get
  $50 free via code `IMPERIAL50` at [venice.ai/settings/api](https://venice.ai/settings/api)).
  `ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai` + `OPENAI_API_KEY`, work too — no code change (see
  [../../LLM.md](../../LLM.md)). If no LLM key is present, the demo uses deterministic reasoning.

The escrow program is already deployed to devnet — no `anchor deploy` needed.

```sh
npm run bootstrap
npm run judge
```

Then open the generated dashboard URL and click **Start Market**. The URL updates with the generated
CoralOS session and the dashboard follows the market round.

To watch the market from logs:

```sh
docker logs -f buyer-agent     # WANT -> AWARD -> DEPOSITED -> VERIFIED -> RELEASED
docker logs -f seller-market-analyst
docker logs -f seller-news-earnings
docker logs -f seller-macro-risk
docker logs -f seller-portfolio-risk
```

## What you'll see

```
[buyer]  round 1: WANT omniquant-financial-intelligence NVDA budget=0.002
market-analyst    BID round=1 price=0.00085 confidence=0.86 note=price action and valuation specialist
news-earnings     BID round=1 price=0.00075 confidence=0.84 note=headlines, earnings, and analyst sentiment
macro-risk        BID round=1 price=0.00060 confidence=0.78 note=rates, liquidity, and risk regime
portfolio-risk    BID round=1 price=0.00055 confidence=0.80 note=sizing controls and concentration risk
[buyer]  picked news-earnings: strongest value for the Nvidia exposure question
[buyer]  round 1: DEPOSITED 0.00075 SOL -> news-earnings
news-earnings DELIVERED round=1 {"service":"omniquant-financial-intelligence","recommendation":"HOLD",...}
[buyer]  round 1: VERIFIED investment committee memo
[buyer]  round 1: RELEASED to news-earnings - https://explorer.solana.com/tx/...cluster=devnet
```

## Knobs (`.env` or the session options)

| Var | Effect |
|-----|--------|
| `BUYER_ARG` | the research asset/question context (`NVDA` default) |
| `LLM_PROVIDER=venice\|openai` | flip the whole market to another provider — no code change (Venice is the kit default) |
| `TRACE=1` | log the `coral_*` calls + Explorer links for the escrow PDA, deposit, and release |
| `BUYER_MAX_SOL` | the budget cap each round |
| `FINNHUB_API_KEY`, `NEWS_API_KEY`, `FMP_API_KEY` | optional live market/news/fundamentals providers; deterministic fallback is automatic |

## Visualize it (optional React dashboard)

Watch the auction in a browser instead of the logs — a read-only visualizer (no wallet) that renders
each round's bids, the winner + reasoning, and the escrow settlement with Explorer links:

```sh
just feed            # the feed server on :4000 (in another shell)
just dashboard       # the UI on :5173 -> click Start Market
```

It's e2e-tested with fixtures (no devnet needed) — see [`web/`](web/README.md).

## Demo flourishes

- **Show the agent economy:** point to the four specialist sellers, then the buyer's best-value scoring.
- **Lead with settlement:** show deposit and release Explorer links before explaining the UI.
- **Flip the brain:** set `LLM_PROVIDER=venice` (or `openai`) and re-run — same market, a different LLM stack.

For the full protocol and escrow flow, see the agents that implement it:
[`buyer-agent`](../../coral-agents/buyer-agent/README.md) (WANT → AWARD → deposit → release) and
[`seller-agent`](../../coral-agents/seller-agent/README.md) (BID → ESCROW_REQUIRED → DELIVERED).
