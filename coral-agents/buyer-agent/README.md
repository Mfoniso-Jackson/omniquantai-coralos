# buyer-agent

The marketplace buyer broadcasts a `WANT`, collects competing seller bids, awards the best value, and
settles the winner through the arbiter-gated escrow by default.

```text
WANT -> BID* -> AWARD
  -> ESCROW_REQUIRED settlement=arbiter reference=<bound order>
  -> ARBITER_OPENED / DEPOSITED vault=<vault PDA>
  -> DELIVERED
  -> ARBITER_RELEASED
```

> **CoralOS docs:** these messages ride Coral threads with `@mentions`
> ([Threads](https://docs.coralos.ai/concepts/threads)); the buyer blocks on bids and waits for sellers
> to come online via [Coordination](https://docs.coralos.ai/concepts/coordination), all inside a
> [Session](https://docs.coralos.ai/concepts/sessions). End-to-end wiring: [/CORAL.md](../../CORAL.md).

`SETTLEMENT_MODE=direct` keeps the legacy base escrow path available, but the TxODDS CoralOS round uses
`SETTLEMENT_MODE=arbiter` so the buyer cannot unilaterally claw back after delivery.

## Files

| File | Role |
|---|---|
| `src/index.ts` | Market loop: WANT, bid collection, award, arbiter open, delivery wait, release |
| `src/arbiter.ts` | Arbiter wrapper client: config, vault PDA, open, release |
| `src/escrow.ts` | Legacy direct base escrow client |
| `src/guard.ts` | Seller payout binding and legacy payment guards |

## Env

`BUYER_KEYPAIR_B58` funds the order. `ARBITER_KEYPAIR_B58` signs arbiter release/refund.
`SELLER_WALLET` binds the payout wallet. `BUYER_SERVICE` defaults to `txline`, `BUYER_ARG` defaults to
an `edge <fixtureId>` style request, and `MARKET_SELLERS` controls the competing sellers.

For best-value bid selection set an LLM key — the kit's LLM is **Venice AI** (`LLM_PROVIDER=venice` +
`VENICE_API_KEY`; new accounts get $50 free via code `IMPERIAL50` at
[venice.ai/settings/api](https://venice.ai/settings/api)). `ANTHROPIC_API_KEY`, or `LLM_PROVIDER=openai`
+ `OPENAI_API_KEY`, also work. Without a live key, selection falls back to the cheapest valid bid. See
[LLM.md](../../LLM.md).

## Test

```sh
npm install
npm run typecheck
npm test
```

Live settlement signs devnet transactions and is exercised through `examples/txodds/coral`.
