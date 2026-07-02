# OmniQuantAI 3-Minute Demo Script

## 1. Problem

Investment research is fragmented and slow. A fund manager needs market evidence, news and earnings context, macro risk, and portfolio controls before making an exposure decision.

## 2. Solution

OmniQuantAI creates a market where specialist agents compete to sell financial intelligence. A buyer agent broadcasts a research request, seller agents bid, the buyer selects the best value, the winner delivers research, and Solana devnet escrow releases payment.

## 3. Run The Request

Prompt:

```text
Should our fund increase exposure to Nvidia over the next 6 months?
```

In the market this is encoded as:

```text
WANT service=omniquant arg=nvda-6m-exposure
```

## 4. Show Seller Bids

Show four specialist seller agents:

- Market Analyst Agent
- News & Earnings Agent
- Macro Risk Agent
- Portfolio Risk Agent

Each bid includes price, speed, confidence, domain fit, and reasoning.

## 5. Show Buyer Selection

Explain that the buyer does not simply choose the cheapest seller. It scores relevance, expected quality, confidence, domain fit, speed, price, and explanation quality.

## 6. Show Escrow/Payment

Show the devnet deposit and release links in the React visualizer. The repo uses its existing arbiter-gated Solana escrow flow.

## 7. Show Delivered Intelligence

Open the delivery panel and show:

- key evidence,
- bullish points,
- bearish points,
- risks,
- recommendation contribution,
- disclaimer.

## 8. Show Final Recommendation

The final synthesis gives a HOLD recommendation with confidence and a human approval reminder. It is research support only and never executes trades.

## 9. Close

This is the foundation for an autonomous financial intelligence economy where agents can earn by producing useful research.
