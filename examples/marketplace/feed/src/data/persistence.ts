import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Round } from '../foldRounds.js'
import type {
  AgentBidRecord,
  AgentReputationRecord,
  DecisionRecord,
  MarketSnapshot,
  ResearchRequestRecord,
  SettlementRecord,
  WinnerRecord,
} from './models.js'
import { marketDataProviderFromEnv } from './providers/marketDataProvider.js'

const seen = new Set<string>()

export async function persistMarketplaceData(input: { sessionId: string; rounds: Round[]; dataDir?: string }): Promise<void> {
  if (process.env.OMNIQUANT_PERSIST === '0') return
  const dataDir = input.dataDir ?? process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
  await mkdir(dataDir, { recursive: true })
  for (const round of input.rounds) {
    await persistRound(dataDir, input.sessionId, round)
  }
}

async function persistRound(dataDir: string, sessionId: string, round: Round): Promise<void> {
  const now = new Date().toISOString()
  if (round.want) {
    const request: ResearchRequestRecord = {
      id: `${sessionId}:round:${round.round}:request`,
      sessionId,
      round: round.round,
      buyerId: 'buyer-agent',
      service: round.want.service,
      argument: round.want.arg,
      budgetSol: round.want.budgetSol,
      timestamp: now,
    }
    await writeOnce(dataDir, 'research_requests', request.id, request)

    const snapshot = await marketDataProviderFromEnv().getSnapshot({ sessionId, symbol: symbolFromArg(round.want.arg) })
    await writeOnce(dataDir, 'market_snapshots', snapshot.id, snapshot)
  }

  for (const bid of round.bids) {
    const metrics = parseMetrics(bid.note)
    const record: AgentBidRecord = {
      id: `${sessionId}:round:${round.round}:bid:${bid.by}`,
      sessionId,
      round: round.round,
      sellerId: bid.by,
      bidPriceSol: bid.priceSol,
      confidence: metrics.confidence,
      deliveryTimeSeconds: metrics.delivery,
      reasoning: bid.note,
      timestamp: now,
    }
    await writeOnce(dataDir, 'agent_bids', record.id, record)
  }

  if (round.award) {
    const winner: WinnerRecord = {
      id: `${sessionId}:round:${round.round}:winner`,
      sessionId,
      round: round.round,
      sellerId: round.award.to,
      reason: round.award.reason,
      timestamp: now,
    }
    await writeOnce(dataDir, 'winners', winner.id, winner)
  }

  if (round.delivered?.data) {
    const memo = memoFromDelivery(round.delivered.data)
    const decision: DecisionRecord = {
      id: `${sessionId}:round:${round.round}:decision`,
      sessionId,
      round: round.round,
      question: String(memo?.investment_question ?? round.want?.arg ?? 'unknown'),
      recommendation: stringField(memo?.recommendation),
      confidence: numberField(memo?.confidence_score),
      evidence: Array.isArray(memo?.evidence_summary) ? memo.evidence_summary : [],
      buyerDecision: round.award?.reason,
      portfolioContext: deliveryObject(round.delivered.data)?.portfolio_context,
      memo,
      timestamp: now,
    }
    await writeOnce(dataDir, 'decision_records', decision.id, decision)
  }

  const settlement = settlementRecord(sessionId, round, now)
  if (settlement) await writeOnce(dataDir, 'settlements', `${settlement.id}:${settlement.status}`, settlement)

  for (const reputation of reputationRecords(sessionId, round, now)) {
    await writeOnce(dataDir, 'agent_reputation', reputation.id, reputation)
  }
}

async function writeOnce(dataDir: string, collection: string, key: string, value: unknown): Promise<void> {
  const seenKey = `${collection}:${key}`
  if (seen.has(seenKey)) return
  seen.add(seenKey)
  await appendFile(join(dataDir, `${collection}.jsonl`), `${JSON.stringify(value)}\n`, 'utf8')
}

function parseMetrics(note?: string): { confidence?: number; delivery?: number } {
  if (!note) return {}
  const confidence = Number(note.match(/\bconfidence=(\d+(?:\.\d+)?)\b/)?.[1])
  const delivery = Number(note.match(/\bdelivery=(\d+(?:\.\d+)?)s\b/)?.[1])
  return {
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    delivery: Number.isFinite(delivery) ? delivery : undefined,
  }
}

function deliveryObject(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === 'object' ? data as Record<string, unknown> : undefined
}

function memoFromDelivery(data: unknown): Record<string, unknown> | undefined {
  const obj = deliveryObject(data)
  const memo = obj?.investment_committee_memo
  return memo && typeof memo === 'object' ? memo as Record<string, unknown> : obj
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function settlementRecord(sessionId: string, round: Round, timestamp: string): SettlementRecord | undefined {
  const base = {
    id: `${sessionId}:round:${round.round}:settlement`,
    sessionId,
    round: round.round,
    reference: round.escrow?.reference,
    depositSignature: round.deposit?.sig,
    releaseSignature: round.release?.sig,
    amountSol: round.escrow?.amountSol,
    sellerWallet: round.escrow?.seller,
    timestamp,
  }
  if (round.release) return { ...base, status: 'RELEASED' }
  if (round.refunded) return { ...base, status: 'REFUNDED' }
  if (round.verified) return { ...base, status: 'VERIFIED' }
  if (round.deposit) return { ...base, status: 'DEPOSITED' }
  if (round.escrow) return { ...base, status: 'REQUESTED' }
  return undefined
}

function reputationRecords(sessionId: string, round: Round, timestamp: string): AgentReputationRecord[] {
  const winner = round.award?.to
  return round.bids.map((bid) => {
    const metrics = parseMetrics(bid.note)
    const won = winner === bid.by
    return {
      id: `${sessionId}:round:${round.round}:reputation:${bid.by}`,
      sessionId,
      agentId: bid.by,
      jobsCompleted: round.release && won ? 1 : 0,
      wins: won ? 1 : 0,
      revenueSol: round.release && won ? bid.priceSol : 0,
      winRate: won ? 1 : 0,
      averageConfidence: metrics.confidence,
      averageDeliveryTimeSeconds: metrics.delivery,
      specialization: bid.by,
      marketDomain: 'financial-intelligence',
      timestamp,
    }
  })
}

function symbolFromArg(arg: string): string {
  if (/nvda|nvidia/i.test(arg)) return 'NVDA'
  return arg.split(/[-_\s:]/)[0]?.toUpperCase() || 'UNKNOWN'
}
