/**
 * foldRounds — turn a CoralOS session transcript into typed market Round objects.
 *
 * Pure and network-free, so it's fully unit-testable. Reuses the SAME pure protocol source the
 * agents use — the market wire protocol has one source of truth without pulling the full runtime
 * package into feed-only deploys.
 */
import {
  verb, messageRound, parseWant, parseBid, parseAward, parseEscrowRequired, parseDeposited,
} from '../../../../packages/agent-runtime/src/market/protocol.js'

export interface RawMessage {
  sender: string
  text: string
}

export interface RoundBid {
  by: string
  priceSol: number
  note?: string
}

export type RoundStatus = 'bidding' | 'awarded' | 'deposited' | 'delivered' | 'verified' | 'settled' | 'refunded'

export interface Round {
  round: number
  want?: { service: string; arg: string; budgetSol: number }
  bids: RoundBid[]
  /** Sellers that were in the market but didn't bid (self-selected out) — needs the seller roster. */
  declined: string[]
  award?: { to: string; reason?: string }
  escrow?: { reference: string; seller: string; amountSol: number; deadlineSecs: number }
  deposit?: { sig: string; buyer: string }
  delivered?: { raw: string; data?: unknown }
  verified?: { status: 'PASS' | 'FAIL'; score: number; decision?: string; checks: string[] }
  release?: { sig: string }
  refunded?: boolean
  status: RoundStatus
}

const tryJson = (s: string): unknown => {
  try { return JSON.parse(s) } catch { return undefined }
}

/** Optional `reason="…"` carried on an AWARD (the buyer's best-value justification). */
const awardReason = (text: string): string | undefined => text.match(/reason="([^"]*)"/)?.[1]

const quoted = (text: string, key: string): string | undefined => text.match(new RegExp(`${key}="([^"]*)"`))?.[1]

const parseVerified = (text: string): Round['verified'] | undefined => {
  const status = text.match(/\bstatus=(PASS|FAIL)\b/i)?.[1]?.toUpperCase() as 'PASS' | 'FAIL' | undefined
  const score = Number(text.match(/\bscore=(\d+(?:\.\d+)?)\b/)?.[1])
  if (!status || !Number.isFinite(score)) return undefined
  const checks = (quoted(text, 'checks') ?? '').split('|').map((s) => s.trim()).filter(Boolean)
  return { status, score, decision: quoted(text, 'decision'), checks }
}

/**
 * Fold raw transcript messages into rounds (ascending). Pass the seller roster to compute which
 * sellers declined a round (self-selection) once its bidding has closed.
 */
export function foldRounds(messages: RawMessage[], sellers: string[] = []): Round[] {
  const byRound = new Map<number, Round>()
  const get = (r: number): Round => {
    let round = byRound.get(r)
    if (!round) {
      round = { round: r, bids: [], declined: [], status: 'bidding' }
      byRound.set(r, round)
    }
    return round
  }

  for (const m of messages) {
    const text = m.text.trim()

    const want = parseWant(text)
    if (want) { get(want.round).want = { service: want.service, arg: want.arg, budgetSol: want.budgetSol }; continue }

    const bid = parseBid(text)
    if (bid) {
      const r = get(bid.round)
      if (!r.bids.some((b) => b.by === bid.by)) r.bids.push({ by: bid.by, priceSol: bid.priceSol, note: bid.note })
      continue
    }

    const award = parseAward(text)
    if (award) { const r = get(award.round); r.award = { to: award.to, reason: awardReason(text) }; if (r.status === 'bidding') r.status = 'awarded'; continue }

    const esc = parseEscrowRequired(text)
    if (esc) { get(esc.round).escrow = { reference: esc.reference, seller: esc.seller, amountSol: esc.amountSol, deadlineSecs: esc.deadlineSecs }; continue }

    const dep = parseDeposited(text)
    if (dep) { const r = get(dep.round); r.deposit = { sig: dep.sig, buyer: dep.buyer }; if (r.status !== 'settled') r.status = 'deposited'; continue }

    const v = verb(text)
    const r = messageRound(text)
    if (v === 'DELIVERED' && r != null) {
      const round = get(r)
      const raw = text.replace(/^DELIVERED\s+round=\d+\s*/i, '').trim()
      round.delivered = { raw, data: tryJson(raw) }
      if (round.status !== 'settled') round.status = 'delivered'
    } else if (v === 'VERIFIED' && r != null) {
      const round = get(r)
      const verified = parseVerified(text)
      if (verified) round.verified = verified
      if (round.status !== 'settled') round.status = verified?.status === 'PASS' ? 'verified' : 'delivered'
    } else if ((v === 'RELEASED' || v === 'ARBITER_RELEASED') && r != null) {
      const round = get(r)
      const sig = text.match(/sig=(\S+)/)?.[1]
      if (sig) round.release = { sig }
      round.status = 'settled'
    } else if (v === 'REFUNDED' && r != null) {
      const round = get(r)
      round.refunded = true
      round.status = 'refunded'
    }
  }

  const rounds = [...byRound.values()].sort((a, b) => a.round - b.round)
  // Sellers who were in the roster but didn't bid on a round whose bidding has closed.
  for (const round of rounds) {
    if (round.status === 'bidding') continue
    round.declined = sellers.filter((s) => !round.bids.some((b) => b.by === s))
  }
  return rounds
}
