/**
 * Broker economics — pure (network-free) functions so the spread logic is unit-tested, mirroring the
 * seller's `bidder.ts` and the buyer's `guard.ts`. The loop in `index.ts` enforces these.
 */

/**
 * What the broker quotes the buyer downstream. It bids the buyer's full budget to capture the maximum
 * spread, but only if there's room for its margin — if `budgetSol <= marginSol` there's no profit in
 * the round, so it returns `null` and sits out (it can't procure upstream for less than 0).
 */
export function brokerQuote(budgetSol: number, marginSol: number): number | null {
  if (!(budgetSol > marginSol)) return null
  return budgetSol
}

/** The budget the broker offers upstream = its downstream price minus the spread it keeps (floored at 0). */
export function upstreamBudget(downstreamPriceSol: number, marginSol: number): number {
  return Math.max(0, downstreamPriceSol - marginSol)
}

/** Strip the `DELIVERED round=N ` envelope to get the payload the broker resells downstream. */
export function deliveredPayload(text: string): string {
  return text.replace(/^DELIVERED\s+round=\d+\s*/i, '').trim()
}
