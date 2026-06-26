/**
 * Market protocol — the wire format for the open marketplace, as pure (network-free) functions so it
 * can be fully unit-tested. Agents format/parse these strings and route them over CoralOS threads;
 * settlement happens through the escrow contract. Every message carries a `round` to correlate the
 * many messages flowing through one shared thread.
 *
 *   WANT   round=<n> service=<name> arg=<token> budget=<sol>     buyer  → market, @sellers
 *   BID    round=<n> price=<sol> by=<seller> [note=<free text>]  seller → market (self-selects)
 *   AWARD  round=<n> to=<seller>                                 buyer  → market, @winner
 *   ESCROW_REQUIRED round=<n> reference=<R> amount=<sol> deadline=<secs>   seller → buyer
 *   DEPOSITED round=<n> reference=<R> pda=<addr> sig=<sig>       buyer  → seller
 *   (then DELIVERED / RELEASED / REFUNDED reuse the round tag)
 */

export interface Want {
  round: number
  service: string
  arg: string
  budgetSol: number
}

export interface Bid {
  round: number
  priceSol: number
  by: string
  note?: string
}

export interface EscrowTerms {
  round: number
  reference: string
  amountSol: number
  deadlineSecs: number
}

const num = (text: string, key: string): number | undefined => {
  const m = text.match(new RegExp(`${key}=([\\d.]+)`))
  return m ? Number(m[1]) : undefined
}
const tok = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`${key}=(\\S+)`))?.[1]

/** The leading verb of a market message (`WANT`, `BID`, …), or '' if none. */
export function verb(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
}

/** Extract the `round` tag for correlation, or undefined. */
export function messageRound(text: string): number | undefined {
  return num(text, 'round')
}

// ── WANT ──────────────────────────────────────────────────────────────────────
export function formatWant(w: Want): string {
  return `WANT round=${w.round} service=${w.service} arg=${w.arg} budget=${w.budgetSol}`
}
export function parseWant(text: string): Want | null {
  if (verb(text) !== 'WANT') return null
  const round = num(text, 'round')
  const service = tok(text, 'service')
  const arg = tok(text, 'arg')
  const budgetSol = num(text, 'budget')
  if (round == null || !service || arg == null || budgetSol == null) return null
  return { round, service, arg, budgetSol }
}

// ── BID ───────────────────────────────────────────────────────────────────────
export function formatBid(b: Bid): string {
  const base = `BID round=${b.round} price=${b.priceSol} by=${b.by}`
  return b.note ? `${base} note=${b.note}` : base
}
export function parseBid(text: string): Bid | null {
  if (verb(text) !== 'BID') return null
  const round = num(text, 'round')
  const priceSol = num(text, 'price')
  const by = tok(text, 'by')
  if (round == null || priceSol == null || !by) return null
  const note = text.match(/note=(.+)$/)?.[1]?.trim()
  return { round, priceSol, by, ...(note ? { note } : {}) }
}

// ── AWARD ─────────────────────────────────────────────────────────────────────
export function formatAward(round: number, to: string): string {
  return `AWARD round=${round} to=${to}`
}
export function parseAward(text: string): { round: number; to: string } | null {
  if (verb(text) !== 'AWARD') return null
  const round = num(text, 'round')
  const to = tok(text, 'to')
  if (round == null || !to) return null
  return { round, to }
}

// ── ESCROW_REQUIRED ─────────────────────────────────────────────────────────────
export function formatEscrowRequired(t: EscrowTerms): string {
  return `ESCROW_REQUIRED round=${t.round} reference=${t.reference} amount=${t.amountSol} deadline=${t.deadlineSecs}`
}
export function parseEscrowRequired(text: string): EscrowTerms | null {
  if (verb(text) !== 'ESCROW_REQUIRED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const amountSol = num(text, 'amount')
  const deadlineSecs = num(text, 'deadline')
  if (round == null || !reference || amountSol == null || deadlineSecs == null) return null
  return { round, reference, amountSol, deadlineSecs }
}

// ── selection ───────────────────────────────────────────────────────────────────
/** Keep only bids for `round`, deduped by seller (last bid wins). */
export function selectBids(bids: Bid[], round: number): Bid[] {
  const bySeller = new Map<string, Bid>()
  for (const b of bids) if (b.round === round) bySeller.set(b.by, b)
  return [...bySeller.values()]
}

/** The cheapest bid (does not mutate input); undefined if none. Ties → first seen. */
export function pickCheapest(bids: Bid[]): Bid | undefined {
  return [...bids].sort((a, b) => a.priceSol - b.priceSol)[0]
}
