# coral-agents

Dockerized agents for the CoralOS round in [`examples/txodds/coral/`](../examples/txodds/coral).
Each agent connects to a CoralOS MCP session through `startCoralAgent` and trades in a shared market
thread.

| Agent | Role |
|---|---|
| `buyer-agent` | Broadcasts `WANT`, collects competing bids, awards best value, opens arbiter escrow, and triggers arbiter release on delivery. |
| `seller-agent` | Fulfillment image: bids on `omniquant` or legacy `txline`, verifies funded escrow, and delivers the paid report. |
| `market-analyst` | OmniQuantAI seller persona for price action, momentum, valuation, and market structure. |
| `news-earnings` | OmniQuantAI seller persona for recent news, earnings themes, and company developments. |
| `macro-risk` | OmniQuantAI seller persona for rates, inflation, liquidity, and macro risk. |
| `portfolio-risk` | OmniQuantAI seller persona for downside scenarios, concentration risk, controls, and invalidation triggers. |

Settlement for the TxODDS round is arbiter-gated by default: the buyer funds a vault PDA, the seller
verifies that vault-backed escrow, and the neutral arbiter key releases payment after delivery.

## Build

```sh
bash build-agents.sh
```

The round launcher creates one buyer and four seller instances. All four reuse `seller-agent:0.1.0`
with different `AGENT_NAME`, `PERSONA`, `FLOOR_SOL`, and buyer-scoring metrics.
