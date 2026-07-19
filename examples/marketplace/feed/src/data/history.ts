import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AgentBidRecord,
  AgentProfileRecord,
  AgentReputationRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
  InvestmentMemoRecord,
  MarketEventRecord,
  MarketSessionRecord,
  ResearchRequestRecord,
  SettlementRecord,
  WinnerRecord,
} from './models.js'
import { getMemoWorkspace } from './workspaceStore.js'

export function dataDirFromEnv(): string {
  return process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
}

export async function listMarkets(dataDir = dataDirFromEnv()): Promise<MarketSessionRecord[]> {
  const sessions = await readJsonl<MarketSessionRecord>(dataDir, 'market_sessions')
  return latestBy(sessions, (session) => session.sessionId, (session) => session.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getMarket(sessionId: string, dataDir = dataDirFromEnv()) {
  const [sessions, requests, bids, winners, memos, settlements, events, workspace] = await Promise.all([
    readJsonl<MarketSessionRecord>(dataDir, 'market_sessions'),
    readJsonl<ResearchRequestRecord>(dataDir, 'research_requests'),
    readJsonl<AgentBidRecord>(dataDir, 'agent_bids'),
    readJsonl<WinnerRecord>(dataDir, 'winners'),
    readJsonl<InvestmentMemoRecord>(dataDir, 'investment_memos'),
    readJsonl<SettlementRecord>(dataDir, 'settlements'),
    readJsonl<MarketEventRecord>(dataDir, 'market_events'),
    getMemoWorkspace(sessionId, dataDir),
  ])
  const session = latestBy(sessions.filter((item) => item.sessionId === sessionId), (item) => item.sessionId, (item) => item.updatedAt)[0]
  if (!session) return undefined
  return {
    session,
    requests: requests.filter((item) => item.sessionId === sessionId),
    bids: bids.filter((item) => item.sessionId === sessionId),
    winners: winners.filter((item) => item.sessionId === sessionId),
    memos: memos.filter((item) => item.sessionId === sessionId),
    settlements: settlements.filter((item) => item.sessionId === sessionId),
    timeline: events.filter((item) => item.sessionId === sessionId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    workspace,
  }
}

export async function listAgents(dataDir = dataDirFromEnv()): Promise<AgentProfileRecord[]> {
  const profiles = await readJsonl<AgentProfileRecord>(dataDir, 'agent_profiles')
  const byAgent = new Map<string, AgentProfileRecord>()
  for (const profile of profiles) {
    const current = byAgent.get(profile.agentId)
    byAgent.set(profile.agentId, mergeProfile(current, profile))
  }
  return [...byAgent.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getAgent(agentId: string, dataDir = dataDirFromEnv()) {
  const [profiles, reputation, bids, memos, settlements] = await Promise.all([
    listAgents(dataDir),
    readJsonl<AgentReputationRecord>(dataDir, 'agent_reputation'),
    readJsonl<AgentBidRecord>(dataDir, 'agent_bids'),
    readJsonl<InvestmentMemoRecord>(dataDir, 'investment_memos'),
    readJsonl<SettlementRecord>(dataDir, 'settlements'),
  ])
  const profile = profiles.find((item) => item.agentId === agentId)
  if (!profile) return undefined
  const agentMemos = memos.filter((item) => item.agentId === agentId)
  return {
    profile,
    reputation: reputation.filter((item) => item.agentId === agentId),
    bids: bids.filter((item) => item.sellerId === agentId),
    memos: agentMemos,
    settlements: settlements.filter((settlement) => agentMemos.some((memo) => memo.sessionId === settlement.sessionId)),
  }
}

export async function getMemo(memoId: string, dataDir = dataDirFromEnv()): Promise<InvestmentMemoRecord | undefined> {
  const memos = await readJsonl<InvestmentMemoRecord>(dataDir, 'investment_memos')
  return memos.find((memo) => memo.id === memoId || memo.memoId === memoId)
}

export async function getSettlement(settlementId: string, dataDir = dataDirFromEnv()): Promise<SettlementRecord | undefined> {
  const settlements = await readJsonl<SettlementRecord>(dataDir, 'settlements')
  return settlements.find((settlement) => settlement.id === settlementId || settlement.sessionId === settlementId || settlement.reference === settlementId)
}

export async function getReputation(agentId: string, dataDir = dataDirFromEnv()) {
  const records = await readJsonl<AgentReputationRecord>(dataDir, 'agent_reputation')
  return records.filter((record) => record.agentId === agentId)
}

export async function getSessionGraph(sessionId: string, dataDir = dataDirFromEnv()) {
  const [nodes, edges] = await Promise.all([
    readJsonl<GraphNodeRecord>(dataDir, 'graph_nodes'),
    readJsonl<GraphEdgeRecord>(dataDir, 'graph_edges'),
  ])
  return {
    sessionId,
    nodes: latestBy(nodes.filter((node) => node.sessionId === sessionId), (node) => node.id, (node) => node.timestamp),
    edges: latestBy(edges.filter((edge) => edge.sessionId === sessionId), (edge) => edge.id, (edge) => edge.timestamp),
  }
}

async function readJsonl<T>(dataDir: string, collection: string): Promise<T[]> {
  try {
    const text = await readFile(join(dataDir, `${collection}.jsonl`), 'utf8')
    return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function latestBy<T>(items: T[], keyFn: (item: T) => string, timeFn: (item: T) => string | undefined): T[] {
  const byKey = new Map<string, T>()
  for (const item of items) {
    const key = keyFn(item)
    const current = byKey.get(key)
    if (!current || (timeFn(item) ?? '').localeCompare(timeFn(current) ?? '') >= 0) byKey.set(key, item)
  }
  return [...byKey.values()]
}

function mergeProfile(current: AgentProfileRecord | undefined, next: AgentProfileRecord): AgentProfileRecord {
  if (!current) return next
  const marketsCompleted = current.marketsCompleted + next.marketsCompleted
  const wins = current.wins + next.wins
  return {
    ...next,
    marketsCompleted,
    wins,
    revenueSol: current.revenueSol + next.revenueSol,
    averageConfidence: averageDefined(current.averageConfidence, next.averageConfidence),
    averageDeliveryTimeSeconds: averageDefined(current.averageDeliveryTimeSeconds, next.averageDeliveryTimeSeconds),
    verificationRate: marketsCompleted > 0 ? wins / marketsCompleted : undefined,
    updatedAt: next.updatedAt.localeCompare(current.updatedAt) >= 0 ? next.updatedAt : current.updatedAt,
  }
}

function averageDefined(a?: number, b?: number): number | undefined {
  if (typeof a === 'number' && typeof b === 'number') return Number(((a + b) / 2).toFixed(2))
  return typeof a === 'number' ? a : b
}
