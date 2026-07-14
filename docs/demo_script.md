# OmniQuantAI 3-Minute Demo Script

## 1. Problem

Investment research is fragmented and slow. A fund manager needs market evidence, news and earnings context, macro risk, and portfolio controls before making an exposure decision.

## 2. Solution

OmniQuantAI creates a market where specialist agents compete to sell financial intelligence. A buyer agent broadcasts a research request, seller agents bid, the buyer selects the best value, the winner delivers an investment committee memo, verification passes, and Solana devnet escrow releases payment.

## 3. Run The Request

Prompt:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

In the market this is encoded as:

```text
WANT service=omniquant arg=nvda-3-6m-exposure
```

## 4. Show Seller Bids

Show the current bootstrap seller roster:

- Market Analyst Agent
- News & Earnings Agent
- Macro Risk Agent
- Portfolio Risk Agent

Each bid includes price, speed, confidence, domain fit, reasoning, jobs completed, historical success rate, and revenue earned.

## 5. Show Buyer Selection

Explain that the buyer does not simply choose the cheapest seller. It scores relevance, expected quality, confidence, domain fit, speed, price, and explanation quality.

## 6. Show Escrow/Payment

Show the devnet deposit link in the React visualizer. The repo uses its existing arbiter-gated Solana escrow flow.

## 7. Show Investment Committee Memo

Open the delivery panel and show:

- investment question,
- supporting specialist agents,
- portfolio context,
- key evidence,
- evidence cards,
- bull case,
- base case,
- bear case,
- risk factors,
- recommendation,
- confidence,
- disclaimer.

## 8. Show Verification

Show the verification panel:

- status: PASS,
- score,
- checklist,
- decision: Release escrow.

## 9. Show Payment Release

Click the release link in Solana Explorer after verification passes.

## 10. Show Final Recommendation

The investment committee memo gives a HOLD recommendation with confidence and a human approval reminder. It is research support only and never executes trades.

## 11. Close

We just watched one AI agent buy financial intelligence from another AI agent, verify the work, and pay for it on-chain.
