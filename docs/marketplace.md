# Marketplace Protocol

## Lifecycle

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

Failure and recovery states include `REFUNDED`, missing bids, failed verification, and session read errors.

## Messages

| Message | Sender | Purpose |
| --- | --- | --- |
| `WANT` | buyer | Research request and budget |
| `BID` | seller | Price, seller ID, and reasoning metrics |
| `AWARD` | buyer | Winner and selection reason |
| `ESCROW_REQUIRED` | seller | Reference, seller wallet, amount, deadline |
| `DEPOSITED` | buyer | Deposit transaction and settlement mode |
| `DELIVERED` | seller | Paid research artifact |
| `VERIFIED` | buyer | Completeness score and release decision |
| `RELEASED` / `ARBITER_RELEASED` | buyer | Settlement proof |
| `REFUNDED` | buyer | Refund after failure or deadline |

## Buyer Scoring

The buyer considers:

- relevance
- expected quality
- confidence
- domain fit
- delivery speed
- price
- explanation quality

The buyer should not simply select the cheapest bid.

## Current Sellers

- Market Analyst Agent
- News and Earnings Agent
- Macro Risk Agent
- Portfolio Risk Agent

## Budgets

The buyer budget is controlled by environment variables such as `BUYER_MAX_SOL`. Mainnet amounts are intentionally blocked.

## Failure States

- no sellers bid
- seller wins but does not provide escrow terms
- escrow payout wallet does not match expectation
- seller does not deliver
- verification fails
- CoralOS session cannot be read
- devnet RPC or faucet issues delay settlement

## Future

Planned protocol extensions include multi-winner rounds, dispute markets, richer verifier agents, and reputation-aware bidding.

