import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Round } from '../foldRounds.js'
import type {
  AgentProfileRecord,
  AgentBidRecord,
  AgentReputationRecord,
  DecisionRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
  InvestmentMemoRecord,
  MarketEventRecord,
  MarketSessionRecord,
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
    const session: MarketSessionRecord = {
      id: sessionId,
      sessionId,
      namespace: process.env.CORAL_NAMESPACE ?? 'omniquant',
      status: round.status,
      currentStage: currentStage(round),
      createdAt: now,
      completedAt: round.release || round.refunded ? now : undefined,
      winningAgentId: round.award?.to,
      settlementStatus: settlementRecord(sessionId, round, now)?.status,
      dataSource: dataBadge(round),
      updatedAt: now,
    }
    await writeOnce(dataDir, 'market_sessions', `${session.id}:${session.currentStage}`, session)
    await writeEvent(dataDir, {
      id: `${sessionId}:round:${round.round}:event:session-created`,
      sessionId,
      round: round.round,
      type: 'SessionCreated',
      actorId: 'buyer-agent',
      entityId: session.id,
      payload: session,
      timestamp: now,
    })

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
    await writeEvent(dataDir, {
      id: `${sessionId}:round:${round.round}:event:want`,
      sessionId,
      round: round.round,
      type: 'WantBroadcast',
      actorId: request.buyerId,
      entityId: request.id,
      payload: request,
      timestamp: now,
    })

    const snapshot = await marketDataProviderFromEnv().getSnapshot({ sessionId, symbol: symbolFromArg(round.want.arg) })
    await writeOnce(dataDir, 'market_snapshots', snapshot.id, snapshot)
    await writeGraph(dataDir, graphNodes(sessionId, round, now), graphEdges(sessionId, round, snapshot.id, now))
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
    await writeEvent(dataDir, {
      id: `${record.id}:event`,
      sessionId,
      round: round.round,
      type: 'BidSubmitted',
      actorId: bid.by,
      entityId: record.id,
      payload: record,
      timestamp: now,
    })
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
    await writeEvent(dataDir, {
      id: `${winner.id}:event`,
      sessionId,
      round: round.round,
      type: 'WinnerSelected',
      actorId: 'buyer-agent',
      entityId: winner.id,
      payload: winner,
      timestamp: now,
    })
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
    const memoRecord: InvestmentMemoRecord = {
      id: `${sessionId}:round:${round.round}:memo`,
      sessionId,
      round: round.round,
      memoId: `${sessionId}:memo:${round.round}`,
      agentId: round.award?.to,
      question: decision.question,
      recommendation: decision.recommendation,
      confidence: decision.confidence,
      dataSources: Array.isArray(memo?.data_sources) ? memo.data_sources : [],
      providerObservability: Array.isArray(memo?.provider_observability) ? memo.provider_observability : [],
      memo,
      createdAt: now,
    }
    await writeOnce(dataDir, 'investment_memos', memoRecord.id, memoRecord)
    await writeEvent(dataDir, {
      id: `${memoRecord.id}:event`,
      sessionId,
      round: round.round,
      type: 'MemoGenerated',
      actorId: round.award?.to,
      entityId: memoRecord.id,
      payload: memoRecord,
      timestamp: now,
    })
  }

  const settlement = settlementRecord(sessionId, round, now)
  if (settlement) {
    await writeOnce(dataDir, 'settlements', `${settlement.id}:${settlement.status}`, settlement)
    await writeSettlementEvents(dataDir, settlement, round)
  }

  for (const reputation of reputationRecords(sessionId, round, now)) {
    await writeOnce(dataDir, 'agent_reputation', reputation.id, reputation)
    await writeOnce(dataDir, 'agent_profiles', `${reputation.agentId}:${sessionId}:round:${round.round}`, agentProfileFromReputation(reputation))
    await writeEvent(dataDir, {
      id: `${reputation.id}:event`,
      sessionId,
      round: round.round,
      type: 'ReputationUpdated',
      actorId: reputation.agentId,
      entityId: reputation.id,
      payload: reputation,
      timestamp: now,
    })
  }
}

async function writeOnce(dataDir: string, collection: string, key: string, value: unknown): Promise<void> {
  const seenKey = `${collection}:${key}`
  if (seen.has(seenKey)) return
  seen.add(seenKey)
  await appendFile(join(dataDir, `${collection}.jsonl`), `${JSON.stringify(value)}\n`, 'utf8')
}

async function writeEvent(dataDir: string, event: MarketEventRecord): Promise<void> {
  await writeOnce(dataDir, 'market_events', event.id, event)
}

async function writeGraph(dataDir: string, nodes: GraphNodeRecord[], edges: GraphEdgeRecord[]): Promise<void> {
  for (const node of nodes) await writeOnce(dataDir, 'graph_nodes', node.id, node)
  for (const edge of edges) await writeOnce(dataDir, 'graph_edges', edge.id, edge)
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

function dataBadge(round: Round): string | undefined {
  const data = deliveryObject(round.delivered?.data)
  const badge = data?.data_badge
  return typeof badge === 'string' ? badge : undefined
}

function currentStage(round: Round): string {
  if (round.release) return 'PAYMENT_RELEASED'
  if (round.refunded) return 'REFUNDED'
  if (round.verified) return round.verified.status === 'PASS' ? 'VERIFICATION_PASSED' : 'VERIFICATION_FAILED'
  if (round.delivered) return 'MEMO_GENERATED'
  if (round.deposit) return 'SETTLEMENT_INITIATED'
  if (round.award) return 'WINNER_SELECTED'
  if (round.bids.length > 0) return 'BIDS_RECEIVED'
  if (round.want) return 'WANT_BROADCAST'
  return 'SESSION_CREATED'
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

async function writeSettlementEvents(dataDir: string, settlement: SettlementRecord, round: Round): Promise<void> {
  const common = {
    sessionId: settlement.sessionId,
    round: settlement.round,
    actorId: 'buyer-agent',
    entityId: settlement.id,
    payload: settlement,
    timestamp: settlement.timestamp,
  }
  if (round.escrow) {
    await writeEvent(dataDir, { ...common, id: `${settlement.id}:event:escrow-requested`, type: 'EscrowRequested' })
  }
  if (round.deposit) {
    await writeEvent(dataDir, { ...common, id: `${settlement.id}:event:deposit`, type: 'SettlementInitiated' })
  }
  if (round.verified) {
    await writeEvent(dataDir, {
      ...common,
      id: `${settlement.id}:event:verification`,
      type: round.verified.status === 'PASS' ? 'VerificationPassed' : 'VerificationFailed',
      payload: round.verified,
    })
  }
  if (round.release || round.refunded) {
    await writeEvent(dataDir, { ...common, id: `${settlement.id}:event:closed`, type: 'SettlementCompleted' })
    await writeEvent(dataDir, { ...common, id: `${settlement.id}:event:market-closed`, type: 'MarketClosed' })
  }
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

function agentProfileFromReputation(reputation: AgentReputationRecord): AgentProfileRecord {
  return {
    id: reputation.agentId,
    agentId: reputation.agentId,
    specialization: reputation.specialization ?? reputation.agentId,
    marketsCompleted: reputation.jobsCompleted,
    wins: reputation.wins,
    revenueSol: reputation.revenueSol,
    averageConfidence: reputation.averageConfidence,
    averageDeliveryTimeSeconds: reputation.averageDeliveryTimeSeconds,
    verificationRate: reputation.jobsCompleted > 0 ? 1 : undefined,
    lastSessionId: reputation.sessionId,
    updatedAt: reputation.timestamp,
  }
}

function graphNodes(sessionId: string, round: Round, timestamp: string): GraphNodeRecord[] {
  const nodes: GraphNodeRecord[] = []
  if (round.want) {
    nodes.push(node(sessionId, 'MarketSession', sessionId, `Session ${sessionId}`, timestamp))
    nodes.push(node(sessionId, 'ResearchRequest', `${sessionId}:round:${round.round}:request`, round.want.arg, timestamp))
    nodes.push(node(sessionId, 'Buyer', 'buyer-agent', 'buyer-agent', timestamp))
    nodes.push(node(sessionId, 'MarketSnapshot', `${sessionId}:market-snapshot:${symbolFromArg(round.want.arg)}`, symbolFromArg(round.want.arg), timestamp))
  }
  for (const bid of round.bids) {
    nodes.push(node(sessionId, 'Agent', bid.by, bid.by, timestamp))
    nodes.push(node(sessionId, 'AgentBid', `${sessionId}:round:${round.round}:bid:${bid.by}`, `${bid.by} bid`, timestamp))
  }
  if (round.award) nodes.push(node(sessionId, 'Winner', `${sessionId}:round:${round.round}:winner`, round.award.to, timestamp))
  if (round.delivered) nodes.push(node(sessionId, 'InvestmentCommitteeMemo', `${sessionId}:round:${round.round}:memo`, 'Investment Committee Memo', timestamp))
  if (round.verified) nodes.push(node(sessionId, 'Verification', `${sessionId}:round:${round.round}:verification`, round.verified.status, timestamp))
  if (round.escrow || round.deposit || round.release) nodes.push(node(sessionId, 'Settlement', `${sessionId}:round:${round.round}:settlement`, round.release ? 'Released' : 'Settlement', timestamp))
  return nodes
}

function graphEdges(sessionId: string, round: Round, snapshotId: string, timestamp: string): GraphEdgeRecord[] {
  const requestId = `${sessionId}:round:${round.round}:request`
  const memoId = `${sessionId}:round:${round.round}:memo`
  const settlementId = `${sessionId}:round:${round.round}:settlement`
  const edges: GraphEdgeRecord[] = [
    edge(sessionId, sessionId, requestId, 'contains_request', timestamp),
    edge(sessionId, requestId, snapshotId, 'uses_market_snapshot', timestamp),
    edge(sessionId, 'buyer-agent', requestId, 'broadcasts', timestamp),
  ]
  for (const bid of round.bids) {
    const bidId = `${sessionId}:round:${round.round}:bid:${bid.by}`
    edges.push(edge(sessionId, requestId, bid.by, 'solicits_agent', timestamp))
    edges.push(edge(sessionId, bid.by, bidId, 'submits_bid', timestamp))
    edges.push(edge(sessionId, bidId, requestId, 'answers_request', timestamp))
  }
  if (round.award) {
    const winnerId = `${sessionId}:round:${round.round}:winner`
    edges.push(edge(sessionId, 'buyer-agent', winnerId, 'selects_winner', timestamp))
    edges.push(edge(sessionId, winnerId, round.award.to, 'awards_agent', timestamp))
  }
  if (round.delivered) {
    edges.push(edge(sessionId, round.award?.to ?? 'unknown-agent', memoId, 'generates_memo', timestamp))
    edges.push(edge(sessionId, memoId, requestId, 'responds_to_request', timestamp))
  }
  if (round.verified) edges.push(edge(sessionId, memoId, `${sessionId}:round:${round.round}:verification`, 'verified_by', timestamp))
  if (round.escrow || round.deposit || round.release) {
    edges.push(edge(sessionId, memoId, settlementId, 'settled_through', timestamp))
    if (round.award) edges.push(edge(sessionId, settlementId, round.award.to, 'pays_agent', timestamp))
  }
  return edges
}

function node(sessionId: string, type: string, entityId: string, label: string, timestamp: string): GraphNodeRecord {
  return { id: `${sessionId}:node:${type}:${entityId}`, sessionId, type, label, entityId, timestamp }
}

function edge(sessionId: string, from: string, to: string, type: string, timestamp: string): GraphEdgeRecord {
  return { id: `${sessionId}:edge:${type}:${from}->${to}`, sessionId, from, to, type, timestamp }
}

function symbolFromArg(arg: string): string {
  if (/nvda|nvidia/i.test(arg)) return 'NVDA'
  return arg.split(/[-_\s:]/)[0]?.toUpperCase() || 'UNKNOWN'
}
