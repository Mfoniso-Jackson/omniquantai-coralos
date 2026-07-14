/**
 * Buyer agent - the marketplace buyer. Broadcasts a WANT into a shared CoralOS thread, collects
 * competing LLM bids, picks the best value, and settles through the escrow contract:
 *
 *   WANT -> (collect BIDs for a window) -> AWARD winner -> wait ESCROW_REQUIRED ->
 *   deposit() into escrow -> DEPOSITED -> wait DELIVERED -> VERIFIED -> release() to the seller
 *
 * Selection uses the LLM (best value), with a deterministic cheapest fallback so a slow/missing model
 * never hangs the round. Settlement is escrow-only - funds are conditional on delivery.
 *
 * Env: BUYER_KEYPAIR_B58 (signs), BUYER_MAX_SOL (budget), BUYER_SERVICE/BUYER_ARG (the WANT),
 *      MARKET_SELLERS (csv of seller names), BID_WINDOW_MS, SOLANA_RPC_URL,
 *      VENICE_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY (+ LLM_PROVIDER), TRACE=1.
 *
 * The deposit/release calls settle against the escrow program deployed to devnet; they need a funded
 * devnet wallet + live RPC, so they run in a live market session rather than in `npm test`/CI.
 */
import {
  startCoralAgent, complete, parseJsonReply, loadKeypairB58,
  formatWant, parseBid, parseEscrowRequired, formatAward, formatDeposited,
  selectBids, verb, messageRound,
  type Bid, type EscrowTerms, type CoralAgentContext,
} from '@pay/agent-runtime'
import { PublicKey } from '@solana/web3.js'
import { payoutMatches } from './guard.js'
import { createSettlementProvider, normalizeSettlementMode } from './settlement.js'

const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const BUDGET = Number(process.env.BUYER_MAX_SOL ?? '0.03')
const SERVICE = process.env.BUYER_SERVICE ?? 'omniquant'
// Rotate through several args so each round trades a *different* thing (BUYER_ARGS=csv of fixture ids,
// else the single BUYER_ARG). This is what stops the market looking like the same round on a loop.
const ARGS = (process.env.BUYER_ARGS || process.env.BUYER_ARG || 'nvda-3-6m-exposure').split(',').map((s) => s.trim()).filter(Boolean)
const ARG = ARGS[0]
const BID_WINDOW_MS = Number(process.env.BID_WINDOW_MS ?? '5000')
const CYCLE_MS = Number(process.env.CYCLE_INTERVAL_MS ?? '30000')
const SELLERS = (process.env.MARKET_SELLERS ?? 'market-analyst,news-earnings,macro-risk,portfolio-risk')
  .split(',').map((s) => s.trim()).filter(Boolean)
// F3: the payout wallet the buyer expects (personas share one in the demo). If set, the buyer refuses
// to deposit to an ESCROW_REQUIRED whose seller= pubkey differs - binding the award to the payout.
const EXPECTED_SELLER_WALLET = process.env.SELLER_WALLET ?? ''
const SETTLEMENT_MODE = normalizeSettlementMode(process.env.SETTLEMENT_MODE)
const trace = process.env.TRACE === '1'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const metric = (note: string | undefined, key: string, fallback: number): number =>
  Number(note?.match(new RegExp(`${key}=([\\d.]+)`))?.[1] ?? fallback)

function valueScore(bid: Bid): number {
  const priceScore = Math.max(0, 100 - Math.round((bid.priceSol / Math.max(BUDGET, 0.000001)) * 100))
  const speedScore = Math.max(0, 100 - metric(bid.note, 'speed', 30))
  return Number((
    metric(bid.note, 'rel', 80) * 0.18 +
    metric(bid.note, 'qual', 80) * 0.2 +
    metric(bid.note, 'conf', 76) * 0.16 +
    metric(bid.note, 'fit', 80) * 0.18 +
    speedScore * 0.1 +
    priceScore * 0.08 +
    metric(bid.note, 'explain', 80) * 0.1
  ).toFixed(2))
}

function bidSummary(bid: Bid): string {
  return `${bid.by}: score=${valueScore(bid)}/100 price=${bid.priceSol} SOL ` +
    `confidence=${metric(bid.note, 'conf', 76)} delivery=${metric(bid.note, 'speed', 30)}s ` +
    `quality=${metric(bid.note, 'qual', 80)} fit=${metric(bid.note, 'fit', 80)}`
}

function deterministicReason(winner: Bid, pool: Bid[]): string {
  const cheapest = [...pool].sort((a, b) => a.priceSol - b.priceSol)[0]
  const considered = pool.map(bidSummary).join(' | ')
  const cheapLost = cheapest.by === winner.by
    ? 'The winner was also price-competitive.'
    : `${cheapest.by} was cheaper at ${cheapest.priceSol} SOL but lost on quality/fit/confidence.`
  return `Winner ${winner.by}: best value score ${valueScore(winner)}/100. Considered ${considered}. ${cheapLost}`
}

interface VerificationResult {
  pass: boolean
  score: number
  checks: string[]
  decision: string
}

function verificationCheck(label: string, pass: boolean): { label: string; pass: boolean } {
  return { label, pass }
}

function verifyDelivery(raw: string, requestArg: string): VerificationResult {
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { /* non-JSON delivery fails completeness checks */ }
  const final = (data.final_synthesis ?? {}) as Record<string, unknown>
  const hasArray = (key: string) => Array.isArray(data[key]) && (data[key] as unknown[]).length > 0
  const checks = [
    verificationCheck('Report answered the research request', data.request_understood === requestArg || typeof data.request_understood === 'string'),
    verificationCheck('Investment committee memo present', typeof data.investment_committee_memo === 'object' && data.investment_committee_memo != null),
    verificationCheck('Executive summary present', typeof data.executive_summary === 'string' || typeof final.executive_summary === 'string'),
    verificationCheck('Key evidence present', hasArray('key_evidence')),
    verificationCheck('Evidence cards present', hasArray('evidence_cards')),
    verificationCheck('Bull/base/bear cases present', Boolean(final.bull_case && final.base_case && final.bear_case)),
    verificationCheck('Risk factors present', hasArray('risks') || Array.isArray(final.risk_factors)),
    verificationCheck('Recommendation and confidence present', Boolean(final.recommendation || data.recommendation_contribution) && typeof (final.confidence_score ?? data.confidence_score) === 'number'),
    verificationCheck('Not financial advice disclaimer present', typeof data.disclaimer === 'string' && /not financial advice/i.test(data.disclaimer)),
    verificationCheck('No trading action executed', !JSON.stringify(data).toLowerCase().includes('order_submitted')),
  ]
  const passed = checks.filter((c) => c.pass)
  const score = Math.round((passed.length / checks.length) * 100)
  const pass = score >= 85
  return {
    pass,
    score,
    checks: checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}: ${c.label}`),
    decision: pass ? 'Release escrow' : 'Hold escrow for review',
  }
}

function formatVerified(round: number, verification: VerificationResult): string {
  const status = verification.pass ? 'PASS' : 'FAIL'
  const checks = verification.checks.join(' | ').replace(/"/g, "'")
  return `VERIFIED round=${round} status=${status} score=${verification.score} decision="${verification.decision}" checks="${checks}"`
}

/** Best-value selection via LLM; deterministic value-score fallback. Returns the winner + its reasoning. */
async function pickWinner(pool: Bid[]): Promise<{ winner: Bid; reason?: string }> {
  if (pool.length === 1) return { winner: pool[0] }
  try {
    const system =
      'You are a buyer choosing the best-value bid for a financial intelligence service. ' +
      'Consider relevance, expected quality, confidence, domain fit, delivery speed, price, and explanation quality. ' +
      'Do not simply choose the cheapest seller. ' +
      'Explain why each seller was considered, why the winner won, and why cheaper bids may have lost. ' +
      'Reply ONLY with JSON {"by": "<seller name>", "reason": "<one concise sentence>"}.'
    const user =
      `service=${SERVICE} arg=${ARG} budget=${BUDGET}\nbids:\n` +
      pool.map((b) => `- ${b.by}: ${b.priceSol} SOL${b.note ? ` (${b.note})` : ''}`).join('\n')
    const parsed = parseJsonReply<{ by?: string; reason?: string }>(await complete({ system, user, maxTokens: 100 }))
    const chosen = pool.find((b) => b.by === parsed?.by)
    if (chosen) {
      console.error(`[buyer] picked ${chosen.by} (${chosen.priceSol} SOL): ${parsed?.reason ?? ''}`)
      return { winner: chosen, reason: parsed?.reason }
    }
  } catch {
    /* fall through to deterministic choice */
  }
  const ranked = [...pool].sort((a, b) => valueScore(b) - valueScore(a))
  return { winner: ranked[0], reason: deterministicReason(ranked[0], pool) }
}

/** Wait (bounded) for a message matching `round` that `parse` accepts. */
async function waitFor<T>(
  ctx: CoralAgentContext,
  round: number,
  parse: (text: string) => (T & { round: number }) | null,
  maxMs: number,
): Promise<T | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
    if (!m) continue
    const parsed = parse(m.text)
    if (parsed && parsed.round === round) return parsed
  }
  return null
}

await startCoralAgent({ agentName: process.env.AGENT_NAME ?? 'buyer-agent' }, async (ctx) => {
  const buyer = loadKeypairB58('BUYER_KEYPAIR_B58')
  const arbiter = SETTLEMENT_MODE === 'arbiter' ? loadKeypairB58('ARBITER_KEYPAIR_B58') : null
  console.error(`[buyer] market buyer - session=${process.env.SESSION_ID ?? 'coral-injected'} wallet=${buyer.publicKey.toBase58()} budget=${BUDGET} sellers=[${SELLERS.join(',')}]`)

  for (const s of SELLERS) {
    try { await ctx.waitForAgent(s, 8000) } catch { /* seller may already be present */ }
  }
  const thread = await ctx.createThread('market', SELLERS)
  console.error(`[buyer] session=${process.env.SESSION_ID ?? 'coral-injected'} thread=${thread} created participants=[${SELLERS.join(',')}]`)
  const settlementProvider = createSettlementProvider(SETTLEMENT_MODE, buyer, arbiter, RPC)
  await settlementProvider.setup()
  let round = 0

  while (true) {
    try {
      round++
      const arg = ARGS[(round - 1) % ARGS.length] // rotate fixtures so consecutive rounds differ
      console.error(`[buyer] session=${process.env.SESSION_ID ?? 'coral-injected'} thread=${thread} round=${round}: WANT ${SERVICE} ${arg} budget=${BUDGET}`)
      await ctx.send(formatWant({ round, service: SERVICE, arg, budgetSol: BUDGET }), thread, SELLERS)

      // -- collect competing bids during the window --------------------------
      const bids: Bid[] = []
      const deadline = Date.now() + BID_WINDOW_MS
      while (Date.now() < deadline) {
        const m = await ctx.waitForMention(Math.max(500, deadline - Date.now()))
        if (!m) continue
        const b = parseBid(m.text)
        if (b && b.round === round) bids.push(b)
      }
      const pool = selectBids(bids, round)
      console.error(`[buyer] session=${process.env.SESSION_ID ?? 'coral-injected'} round=${round}: bids_received=${pool.length}`)
      if (pool.length === 0) { console.error(`[buyer] round ${round}: NO_SELLERS`); await sleep(CYCLE_MS); continue }

      // -- award the best value ----------------------------------------------
      const { winner, reason } = await pickWinner(pool)
      await ctx.send(formatAward(round, winner.by, reason), thread, [winner.by])

      // -- settle through escrow: deposit -> DEPOSITED -> wait DELIVERED -> VERIFIED -> release
      const terms = await waitFor<EscrowTerms>(ctx, round, parseEscrowRequired, 15_000)
      if (!terms) { console.error(`[buyer] round ${round}: no escrow terms from ${winner.by}`); await sleep(CYCLE_MS); continue }
      if (!payoutMatches(terms.seller, EXPECTED_SELLER_WALLET)) {
        console.error(`[buyer] round ${round}: escrow payout ${terms.seller} != expected ${EXPECTED_SELLER_WALLET} - skipping`)
        await sleep(CYCLE_MS); continue
      }

      const reference = new PublicKey(terms.reference)
      const seller = new PublicKey(terms.seller)
      const requestedSettlement = terms.settlement ?? settlementProvider.mode
      if (requestedSettlement !== settlementProvider.mode) {
        throw new Error(`seller requested ${requestedSettlement} settlement but buyer is configured for ${settlementProvider.mode}`)
      }
      const opened = await settlementProvider.open({ seller, reference, amountSol: terms.amountSol, deadlineSecs: terms.deadlineSecs })
      console.error(`[buyer] round ${round}: DEPOSITED ${terms.amountSol} SOL -> ${winner.by}`)
      if (trace) {
        if (opened.settlement === 'arbiter' && opened.vault) {
          console.error(`[buyer]   vault PDA: ${settlementProvider.explorerUrl('address', opened.vault.toBase58())}`)
          console.error(`[buyer]   escrow PDA: ${settlementProvider.explorerUrl('address', opened.escrow.toBase58())}`)
          console.error(`[buyer]   open tx: ${settlementProvider.explorerUrl('tx', opened.sig)}`)
        } else {
          console.error(`[buyer]   escrow PDA: ${settlementProvider.explorerUrl('address', opened.escrow.toBase58())}`)
          console.error(`[buyer]   deposit tx: ${settlementProvider.explorerUrl('tx', opened.sig)}`)
        }
      }
      await ctx.send(
        formatDeposited({
          round,
          reference: terms.reference,
          buyer: buyer.publicKey.toBase58(),
          sig: opened.sig,
          settlement: opened.settlement,
          ...(opened.vault && arbiter ? { vault: opened.vault.toBase58(), arbiter: arbiter.publicKey.toBase58() } : {}),
        }),
        thread, [winner.by],
      )

      const delivered = await waitFor<{ round: number; raw: string }>(ctx, round, (t) => {
        const r = messageRound(t)
        if (verb(t) !== 'DELIVERED' || r == null) return null
        const raw = t.replace(/^DELIVERED\s+round=\d+\s*/i, '').trim()
        return { round: r, raw }
      }, 30_000)

      if (delivered) {
        const verification = verifyDelivery(delivered.raw, arg)
        console.error(`[buyer] round ${round}: VERIFIED ${verification.pass ? 'PASS' : 'FAIL'} score=${verification.score} decision="${verification.decision}"`)
        await ctx.send(formatVerified(round, verification), thread, [winner.by])
        if (!verification.pass) {
          console.error(`[buyer] round ${round}: verification failed - funds stay in escrow, refundable after the deadline`)
          await sleep(CYCLE_MS); continue
        }
        const releaseSig = await settlementProvider.release({ seller, reference })
        const releaseVerb = settlementProvider.mode === 'arbiter' ? 'ARBITER_RELEASED' : 'RELEASED'
        console.error(`[buyer] round ${round}: ${releaseVerb} to ${winner.by} - ${settlementProvider.explorerUrl('tx', releaseSig)}`)
        await ctx.send(`${releaseVerb} round=${round} sig=${releaseSig} settlement=${settlementProvider.mode}`, thread, [winner.by])
      } else {
        console.error(`[buyer] round ${round}: no delivery - funds stay in escrow, refundable after the deadline`)
      }
    } catch (e) {
      console.error(`[buyer] round error: ${e}`)
    }
    await sleep(CYCLE_MS)
  }
})
