/**
 * Broker agent — a two-sided swarm participant. It is a SELLER to the buyer and a BUYER to the real
 * sellers: it wins a buyer's order, procures it upstream, resells it, and keeps the spread. Both legs
 * settle through the escrow contract. See docs/SWARM.md.
 *
 *   downstream  WANT → BID → AWARD → ESCROW_REQUIRED → (buyer DEPOSITs) → verify funded
 *   upstream    WANT → collect BIDs → AWARD cheapest → DEPOSIT → (seller DELIVERs) → RELEASE
 *   downstream  DELIVERED (resell the upstream payload) → (buyer RELEASEs)
 *
 * The two sides run in separate CoralOS threads: the buyer's shared `market` thread (downstream) and
 * the broker's own `broker-upstream` thread, correlated with `waitForMentionInThread`.
 *
 * Env: BROKER_KEYPAIR_B58 (signs upstream), BROKER_WALLET (downstream receive), UPSTREAM_SELLERS (csv),
 *      BROKER_MARGIN_SOL, BID_WINDOW_MS, SOLANA_RPC_URL, ESCROW_DEADLINE_SECS, TRACE=1.
 *
 * Like the buyer/seller escrow flows, the on-chain legs need a funded devnet wallet + live RPC, so the
 * broker runs in a live session rather than in `npm test`/CI; the pure economics are unit-tested.
 */
import {
  startCoralAgent, loadKeypairB58, verb,
  // downstream — broker is a SELLER to the buyer:
  parseWant, formatBid, parseAward, formatEscrowRequired, parseDeposited,
  // upstream — broker is a BUYER to the sellers:
  formatWant, parseBid, formatAward, formatDeposited, parseEscrowRequired,
  selectBids, pickCheapest,
  type CoralAgentContext, type Bid, type EscrowTerms, type Want,
} from '@pay/agent-runtime'
import type { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { makeProgram, deposit, release, isFunded } from './escrow.js'
import { brokerQuote, upstreamBudget, deliveredPayload } from './broker.js'

const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const NAME = process.env.AGENT_NAME ?? 'broker'
const WALLET = process.env.BROKER_WALLET ?? ''
const UPSTREAM = (process.env.UPSTREAM_SELLERS ?? 'seller-cheap,seller-premium')
  .split(',').map((s) => s.trim()).filter(Boolean)
const MARGIN = Number(process.env.BROKER_MARGIN_SOL ?? '0.0001')
const DEADLINE = Number(process.env.ESCROW_DEADLINE_SECS ?? '600')
const BID_WINDOW_MS = Number(process.env.BID_WINDOW_MS ?? '4000')
const trace = process.env.TRACE === '1'

/** Thread-scoped bounded wait: only a message in `thread` for `round` that `parse` accepts. */
async function waitInThread<T>(
  ctx: CoralAgentContext,
  thread: string,
  round: number,
  parse: (t: string) => (T & { round: number }) | null,
  maxMs: number,
): Promise<T | null> {
  const end = Date.now() + maxMs
  while (Date.now() < end) {
    const m = await ctx.waitForMentionInThread(thread, Math.max(500, end - Date.now()))
    if (!m) continue
    const parsed = parse(m.text)
    if (parsed && parsed.round === round) return parsed
  }
  return null
}

/** Buy `want` from the upstream sellers as a normal buyer; return the delivered payload to resell. */
async function procure(
  ctx: CoralAgentContext,
  program: Program,
  broker: Keypair,
  thread: string,
  round: number,
  want: Want,
): Promise<string> {
  await ctx.send(
    formatWant({ round, service: want.service, arg: want.arg, budgetSol: upstreamBudget(want.budgetSol, MARGIN) }),
    thread, UPSTREAM,
  )

  // collect competing upstream bids during the window
  const bids: Bid[] = []
  const end = Date.now() + BID_WINDOW_MS
  while (Date.now() < end) {
    const m = await ctx.waitForMentionInThread(thread, Math.max(500, end - Date.now()))
    if (!m) continue
    const b = parseBid(m.text)
    if (b && b.round === round) bids.push(b)
  }
  const winner = pickCheapest(selectBids(bids, round))
  if (!winner) throw new Error('no upstream sellers bid')

  await ctx.send(formatAward(round, winner.by), thread, [winner.by])
  const terms = await waitInThread<EscrowTerms>(ctx, thread, round, parseEscrowRequired, 15_000)
  if (!terms) throw new Error('no upstream escrow terms')

  const reference = new PublicKey(terms.reference)
  const seller = new PublicKey(terms.seller)
  const sig = await deposit(program, broker, seller, reference, terms.amountSol, terms.deadlineSecs)
  if (trace) console.error(`[${NAME}] upstream DEPOSITED ${terms.amountSol} SOL → ${winner.by}`)
  await ctx.send(
    formatDeposited({ round, reference: terms.reference, buyer: broker.publicKey.toBase58(), sig }),
    thread, [winner.by],
  )

  const delivered = await waitInThread<{ round: number; text: string }>(
    ctx, thread, round, (t) => (verb(t) === 'DELIVERED' ? { round, text: t } : null), 30_000,
  )
  if (!delivered) throw new Error('upstream never delivered')
  await release(program, broker, seller, reference)
  if (trace) console.error(`[${NAME}] upstream RELEASED → ${winner.by}; reselling downstream`)
  return deliveredPayload(delivered.text)
}

await startCoralAgent({ agentName: NAME }, async (ctx) => {
  if (!WALLET) throw new Error('BROKER_WALLET not set — the broker needs a receive wallet')
  const broker = loadKeypairB58('BROKER_KEYPAIR_B58')
  console.error(`[${NAME}] ready — wallet=${WALLET} upstream=[${UPSTREAM.join(',')}] margin=${MARGIN}`)
  const program = await makeProgram(broker, RPC)
  for (const s of UPSTREAM) {
    try { await ctx.waitForAgent(s, 8000) } catch { /* may already be present */ }
  }
  const upThread = await ctx.createThread('broker-upstream', UPSTREAM)
  let upRound = 0

  const wants = new Map<number, Want>()                            // downstream round → its WANT
  const orders = new Map<string, { round: number; want: Want }>()  // reference → awaited deposit

  while (true) {
    try {
      const m = await ctx.waitForMention()
      if (!m) continue
      const text = m.text.trim()
      if (trace) console.error(`[${NAME}] ← ${text.slice(0, 140)}`)

      // ── downstream: a buyer WANTs → quote the full budget (max spread), or sit out ──
      const want = parseWant(text)
      if (want) {
        const price = brokerQuote(want.budgetSol, MARGIN)
        if (price == null) {
          if (trace) console.error(`[${NAME}] no room on round ${want.round} (budget ${want.budgetSol} ≤ margin ${MARGIN})`)
          continue
        }
        wants.set(want.round, want)
        await ctx.reply(m, formatBid({ round: want.round, priceSol: price, by: NAME, note: 'brokered' }))
        continue
      }

      // ── downstream: we won → issue escrow terms to the buyer ──
      const award = parseAward(text)
      if (award) {
        const w = wants.get(award.round)
        if (award.to !== NAME || !w) continue
        const reference = Keypair.generate().publicKey.toBase58()
        orders.set(reference, { round: award.round, want: w })
        wants.delete(award.round)
        await ctx.reply(m, formatEscrowRequired({
          round: award.round, reference, seller: WALLET, amountSol: w.budgetSol, deadlineSecs: DEADLINE,
        }))
        continue
      }

      // ── downstream: buyer deposited → verify funded, procure upstream, deliver the result ──
      const dep = parseDeposited(text)
      if (dep) {
        const order = orders.get(dep.reference)
        if (!order) { await ctx.reply(m, `ERROR: unknown reference ${dep.reference}`); continue }
        orders.delete(dep.reference)
        try {
          const funded = await isFunded(program, new PublicKey(dep.buyer), new PublicKey(WALLET), new PublicKey(dep.reference), 0)
          if (!funded) { await ctx.reply(m, `ERROR: escrow not funded for reference=${dep.reference}`); continue }
          if (trace) console.error(`[${NAME}] downstream escrow funded → procuring round ${dep.round}`)
          const result = await procure(ctx, program, broker, upThread, ++upRound, order.want)
          await ctx.reply(m, `DELIVERED round=${dep.round} ${result}`)
        } catch (e) {
          await ctx.reply(m, `ERROR: brokered delivery failed — ${(e as Error).message}`)
        }
        continue
      }
    } catch (e) {
      console.error(`[${NAME}] loop error: ${e}`)
    }
  }
})
