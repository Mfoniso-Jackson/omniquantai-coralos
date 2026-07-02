/**
 * Market protocol - the wire format for the open marketplace, as pure (network-free) functions so it
 * can be fully unit-tested. Agents format/parse these strings and route them over CoralOS threads
 * (https://docs.coralos.ai/concepts/threads); settlement happens through the escrow contract. Every
 * message carries a `round` to correlate the many messages flowing through one shared thread — Coral
 * moves opaque strings, so this `round` tag (not Coral) is what pairs a reply to its request.
 *
 *   WANT   round=<n> service=<name> arg=<token> budget=<sol>     buyer  -> market, @sellers
 *   BID    round=<n> price=<sol> by=<seller> [note=<free text>]  seller -> market (self-selects)
 *   AWARD  round=<n> to=<seller>                                 buyer  -> market, @winner
 *   ESCROW_REQUIRED round=<n> reference=<R> seller=<addr> amount=<sol> deadline=<secs>  seller -> buyer
 *   DEPOSITED round=<n> reference=<R> buyer=<addr> sig=<sig>     buyer  -> seller
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
  /** The seller's receive wallet (base58) - the buyer deposits to escrow naming this seller. */
  seller: string
  amountSol: number
  deadlineSecs: number
  /** Settlement rail requested by the seller. `arbiter` is the CoralOS default; `direct` is legacy. */
  settlement?: 'direct' | 'arbiter'
}

export interface Deposited {
  round: number
  reference: string
  /** The buyer's wallet (base58) - the seller derives the escrow PDA from (buyer, reference). */
  buyer: string
  sig: string
  /** Arbiter vault PDA, present when settlement='arbiter'. This is the escrow account's buyer. */
  vault?: string
  settlement?: 'direct' | 'arbiter'
  arbiter?: string
}

const num = (text: string, key: string): number | undefined => {
  const m = text.match(new RegExp(`${key}=([\\d.]+)`))
  return m ? Number(m[1]) : undefined
}
const tok = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`${key}=(\\S+)`))?.[1]

/** The leading verb of a market message (`WANT`, `BID`, ...), or '' if none. */
export function verb(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
}

/** Extract the `round` tag for correlation, or undefined. */
export function messageRound(text: string): number | undefined {
  return num(text, 'round')
}

// -- WANT ----------------------------------------------------------------------
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

// -- BID -----------------------------------------------------------------------
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

// -- AWARD ---------------------------------------------------------------------
export function formatAward(round: number, to: string, reason?: string): string {
  const base = `AWARD round=${round} to=${to}`
  // The buyer's best-value justification, surfaced into the transcript (quotes neutralized so it
  // doesn't break parsing). The visualizer reads it via reason="...".
  return reason ? `${base} reason="${reason.replace(/"/g, "'")}"` : base
}
export function parseAward(text: string): { round: number; to: string; reason?: string } | null {
  if (verb(text) !== 'AWARD') return null
  const round = num(text, 'round')
  const to = tok(text, 'to')
  if (round == null || !to) return null
  const reason = text.match(/reason="([^"]*)"/)?.[1] // the quoted justification formatAward emits
  return { round, to, ...(reason ? { reason } : {}) }
}

// -- ESCROW_REQUIRED -------------------------------------------------------------
export function formatEscrowRequired(t: EscrowTerms): string {
  const base = `ESCROW_REQUIRED round=${t.round} reference=${t.reference} seller=${t.seller} amount=${t.amountSol} deadline=${t.deadlineSecs}`
  return t.settlement ? `${base} settlement=${t.settlement}` : base
}
export function parseEscrowRequired(text: string): EscrowTerms | null {
  if (verb(text) !== 'ESCROW_REQUIRED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const seller = tok(text, 'seller')
  const amountSol = num(text, 'amount')
  const deadlineSecs = num(text, 'deadline')
  if (round == null || !reference || !seller || amountSol == null || deadlineSecs == null) return null
  const settlement = tok(text, 'settlement')
  return {
    round, reference, seller, amountSol, deadlineSecs,
    ...(settlement === 'direct' || settlement === 'arbiter' ? { settlement } : {}),
  }
}

// -- DEPOSITED -------------------------------------------------------------------
export function formatDeposited(d: Deposited): string {
  const parts = [`DEPOSITED round=${d.round}`, `reference=${d.reference}`, `buyer=${d.buyer}`, `sig=${d.sig}`]
  if (d.settlement) parts.push(`settlement=${d.settlement}`)
  if (d.vault) parts.push(`vault=${d.vault}`)
  if (d.arbiter) parts.push(`arbiter=${d.arbiter}`)
  return parts.join(' ')
}
export function parseDeposited(text: string): Deposited | null {
  if (verb(text) !== 'DEPOSITED') return null
  const round = num(text, 'round')
  const reference = tok(text, 'reference')
  const buyer = tok(text, 'buyer')
  const sig = tok(text, 'sig')
  if (round == null || !reference || !buyer || !sig) return null
  const settlement = tok(text, 'settlement')
  const vault = tok(text, 'vault')
  const arbiter = tok(text, 'arbiter')
  return {
    round, reference, buyer, sig,
    ...(settlement === 'direct' || settlement === 'arbiter' ? { settlement } : {}),
    ...(vault ? { vault } : {}),
    ...(arbiter ? { arbiter } : {}),
  }
}

// -- selection -------------------------------------------------------------------
/** Keep only bids for `round`, deduped by seller (last bid wins). */
export function selectBids(bids: Bid[], round: number): Bid[] {
  const bySeller = new Map<string, Bid>()
  for (const b of bids) if (b.round === round) bySeller.set(b.by, b)
  return [...bySeller.values()]
}

/** The cheapest bid (does not mutate input); undefined if none. Ties -> first seen. */
export function pickCheapest(bids: Bid[]): Bid | undefined {
  return [...bids].sort((a, b) => a.priceSol - b.priceSol)[0]
}
