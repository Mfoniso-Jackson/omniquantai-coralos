# broker — the swarm coordinator

A market-maker agent that is **both a buyer and a seller**. It powers the **Swarm** tab:

```
buyer ──"request <service>"──▶ broker
  broker quotes every seller in SWARM_SELLERS (each in its own thread)
  broker buys from the cheapest            (broker PAYS the seller on-chain)
  broker resells to the buyer at +MARKUP   (buyer PAYS the broker on-chain)
```

Two on-chain settlements per request; the broker keeps the spread. This is "money flowing through a
graph of agents" — the agent-economy headline.

> **CoralOS docs:** the broker opens **one Coral thread per seller** and correlates each reply per-thread
> — [Threads](https://docs.coralos.ai/concepts/threads) +
> [Coordination](https://docs.coralos.ai/concepts/coordination). How it's wired in the kit:
> [/CORAL.md](../../CORAL.md).

## How it works

- Reuses the kit's pieces: `payment.ts` (seller-side — charges the buyer, dynamic price) and
  `wallet.ts` (buyer-side — pays sellers from `BROKER_KEYPAIR_B58`).
- Correlates each seller's quote by thread via the runtime's `ctx.waitForMentionInThread()`.

## Fork points (build your own swarm app)

- **Who it shops** — `SWARM_SELLERS` (csv of seller agent names).
- **How it picks** — `src/index.ts`, the `quotes.sort(...)` (price today; weight reliability,
  speed, reputation…).
- **The markup** — `MARKUP`.

Turn it into a best-price aggregator, a cheapest-compute router, a subcontractor, an auction house —
start from the fork points above.

## Options (coral-agent.toml)

`BROKER_KEYPAIR_B58` (pays sellers; its pubkey also receives the buyer's payment) · `SELLER_WALLET`
(= broker pubkey) · `SWARM_SELLERS` · `MARKUP` · `BROKER_MAX_SOL` · `SOLANA_RPC_URL`.

Provision a funded broker wallet + seller wallets with `node scripts/provision-swarm.js`.
