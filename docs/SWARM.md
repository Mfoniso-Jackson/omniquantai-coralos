# Swarm extension — the broker agent

The marketplace ships as buyer ↔ sellers. The next step up is a **swarm**: an agent that is *both* a
seller and a buyer — a **broker** that wins a buyer's order, procures it from the real sellers, and
keeps the spread. Every leg still settles through the one escrow contract.

This ships as a worked, tested example in **[`coral-agents/broker/`](../coral-agents/broker/)** — read it
as the reference for any multi-role agent. It's opt-in: the default demo is unchanged until you enable it.

It builds only on what the runtime already provides:

- **The broker primitive is built in.** [`ctx.waitForMentionInThread(threadId)`](../packages/agent-runtime/src/coral/mcp.ts#L114) lets one agent juggle several threads — exactly what a broker needs to keep its upstream room separate from the buyer's.
- **The protocol is role-agnostic.** `WANT/BID/AWARD/ESCROW_REQUIRED/DEPOSITED/DELIVERED` ([protocol.ts](../packages/agent-runtime/src/market/protocol.ts)) don't care who speaks them.
- **Registration is glob-based.** [coral.toml](../examples/agent-economy/config/coral.toml#L18) auto-discovers `/agents/*`.

It pairs naturally with the **data-broker** story in [TXODDS_INTEGRATION.md §5](TXODDS_INTEGRATION.md#L102): one broker holds a paid subscription and resells it query-by-query to a swarm of traders.

---

## The shape

```
                 downstream (broker is a SELLER)        upstream (broker is a BUYER)
   buyer  ──WANT──▶  broker  ──BID/ESCROW_REQUIRED──▶ buyer
   buyer  ──DEPOSIT──▶ [escrow A: buyer→broker]
                       broker  ──WANT──▶  seller-cheap / seller-premium / …
                       broker  ◀──BID──   sellers
                       broker  ──DEPOSIT──▶ [escrow B: broker→seller]
                       seller  ──DELIVERED──▶ broker  (broker releases escrow B)
   broker ──DELIVERED──▶ buyer            (buyer releases escrow A)
```

**Money:** the buyer escrows `price_down` to the broker; the broker escrows `price_up` to a seller.
The broker's margin is `price_down − price_up`. It only spends upstream **after** its downstream sale
is escrow-funded ([`isFunded`](../coral-agents/broker/src/escrow.ts) before `procure`), so it never
procures at a loss.

## How it works (the shipped code)

The two sides run in separate CoralOS threads — the buyer's shared `market` thread (downstream) and the
broker's own `broker-upstream` thread — correlated with `waitForMentionInThread`.

- **[`src/index.ts`](../coral-agents/broker/src/index.ts)** — the loop. Downstream it handles
  `WANT → BID`, `AWARD → ESCROW_REQUIRED`, `DEPOSITED → verify funded → procure → DELIVERED`. The
  `procure()` helper runs a normal *buyer* round upstream (WANT → collect BIDs → AWARD cheapest →
  DEPOSIT → await DELIVERED → RELEASE) and returns the payload to resell.
- **[`src/broker.ts`](../coral-agents/broker/src/broker.ts)** — the pure, unit-tested economics:
  `brokerQuote` (bid the budget, sit out if there's no room for the margin), `upstreamBudget`
  (downstream price − margin), `deliveredPayload` (strip the `DELIVERED` envelope).
- **[`src/escrow.ts`](../coral-agents/broker/src/escrow.ts)** — both halves of the escrow client:
  buyer-side `deposit`/`release` (to pay upstream) + seller-side `isFunded` (to verify the downstream
  deposit). All connections go through the devnet guard.

## Run it

```sh
# 1. Provision a broker wallet (a 3rd wallet; sets ENABLE_BROKER=1 + the broker keys in .env)
node scripts/setup.js --broker

# 2. Fund ALL THREE printed wallets at https://faucet.solana.com (the broker pays upstream)

# 3. Add your ANTHROPIC_API_KEY to .env, then run — npm run dev builds the broker because ENABLE_BROKER=1
npm run dev
#   (or build just the broker:  bash build-agents.sh broker  ·  or: docker build -f coral-agents/broker/Dockerfile -t broker:0.1.0 .)
```

When `ENABLE_BROKER=1`, [start.ts](../examples/marketplace/start.ts) rewires the session: the buyer's
`MARKET_SELLERS` becomes `broker` (and its F3 payout binding becomes `BROKER_WALLET`), and the broker's
`UPSTREAM_SELLERS` becomes the real sellers. Turn it off by removing `ENABLE_BROKER` (or set it ≠ `1`).

> The buyer nests a full upstream round inside each of its rounds, so it takes longer — bump
> [`DELIVERY_WAIT_MS`](../coral-agents/buyer-agent/src/goal.ts#L27) if rounds time out, and keep the
> broker's `BID_WINDOW_MS` short (default 4s).

## What you'll see

```
[buyer]  round 1: WANT coingecko SOL-USDC budget=0.001
broker         BID  round=1 price=0.001 by=broker note=brokered
[buyer]  picked broker (0.001 SOL) → DEPOSITED 0.001 SOL → broker      # escrow A
broker → broker-upstream: WANT coingecko SOL-USDC budget=0.0009
seller-cheap   BID  round=1 price=0.0002 by=seller-cheap
broker  upstream DEPOSITED 0.0002 SOL → seller-cheap                   # escrow B
seller-cheap   DELIVERED {"coin":"solana","usd":…} → broker  (broker RELEASES escrow B)
broker  DELIVERED round=1 {"coin":"solana","usd":…} → buyer  (buyer RELEASES escrow A)
# broker margin this round: 0.001 − 0.0002 = 0.0008 SOL
```

## Tests

The pure economics + the devnet guard are unit-tested (the on-chain legs run in a live session, like
the buyer/seller flows):

```sh
cd coral-agents/broker && npm install && npm run typecheck && npm test
```

## Caveats — what to know before you ship it

- **Two-sided counterparty risk.** The broker procures only after escrow A is funded, but it delivers
  before the buyer releases — same buyer-grief gap as the base market
  ([trust model, F2](AUDIT_REMEDIATION.md)). And the buyer now trusts the broker to actually procure.
  This is the natural place to introduce an **on-chain arbiter** (below).
- **Round correlation.** The broker keeps its upstream round numbers separate and reads upstream traffic
  only via `waitForMentionInThread('broker-upstream', …)`, so bids never collide with downstream traffic.
- **Speculative quote.** The shipped broker quotes the buyer's full budget at `WANT` time (max spread)
  and procures after the award. If upstream costs more than `budget − margin`, procurement simply fails
  and the buyer refunds after the deadline — the broker is only out the gas.

## Extensions ladder (small → ambitious)

| Step | What | Effort |
|------|------|--------|
| Best-of-N upstream | already, via `pickCheapest` — point `UPSTREAM_SELLERS` at many sellers; the broker is an aggregator | XS |
| Quoted margin | procure-first during the buyer's bid window, then quote `upstream + margin` instead of the budget | S |
| Caching reseller | cache the upstream result and resell the same `arg` to later buyers without re-buying — pure margin | S |
| **Data-broker** | the broker holds the **TxLINE** subscription and resells World Cup queries to a swarm ([§5](TXODDS_INTEGRATION.md#L102)) | M |
| Multi-hop | broker → broker → seller; nothing in the protocol forbids chains | M |
| **On-chain arbiter** | a third signer attests delivery and releases — closes the two-sided trust gap ([contract_extension.md](../examples/agent-economy/escrow/contract_extension.md)) | L (new Anchor program) |

## Staying within hackathon limits

Everything down to "data-broker" is **new behaviour over the existing pillars** — no new
infrastructure: CoralOS is the orchestration substrate, the escrow is the settlement substrate, and the
broker is one more `/agents/*` folder. You only leave the budget when you add **new Rust** (the arbiter
or a reputation/staking program) — each a real Anchor program, documented but deliberately out of the
base kit.
