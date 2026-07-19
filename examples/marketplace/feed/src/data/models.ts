export type DataMode = 'LIVE DATA' | 'DEMO DATA'

export interface MarketSnapshot {
  id: string
  sessionId: string
  symbol: string
  dataMode: DataMode
  timestamp: string
  price?: number
  volatility?: number
  liquidity?: string
  provider: string
  summary: string
}

export interface ResearchRequestRecord {
  id: string
  sessionId: string
  round: number
  buyerId: string
  service: string
  argument: string
  budgetSol: number
  timestamp: string
}

export interface AgentBidRecord {
  id: string
  sessionId: string
  round: number
  sellerId: string
  bidPriceSol: number
  confidence?: number
  deliveryTimeSeconds?: number
  reasoning?: string
  timestamp: string
}

export interface WinnerRecord {
  id: string
  sessionId: string
  round: number
  sellerId: string
  reason?: string
  timestamp: string
}

export interface ObservationRecord {
  id: string
  sessionId: string
  round: number
  agentId: string
  observation: string
  confidence: number
  evidence: string[]
  source: string
  timestamp: string
}

export interface DecisionRecord {
  id: string
  sessionId: string
  round: number
  question: string
  recommendation?: string
  confidence?: number
  evidence: unknown[]
  buyerDecision?: string
  humanDecision?: string
  portfolioContext?: unknown
  futureOutcome?: unknown
  memo: unknown
  timestamp: string
}

export interface SettlementRecord {
  id: string
  sessionId: string
  round: number
  status: 'REQUESTED' | 'DEPOSITED' | 'VERIFIED' | 'RELEASED' | 'REFUNDED'
  reference?: string
  depositSignature?: string
  releaseSignature?: string
  amountSol?: number
  sellerWallet?: string
  timestamp: string
}

export interface AgentReputationRecord {
  id: string
  sessionId: string
  agentId: string
  jobsCompleted: number
  wins: number
  revenueSol: number
  winRate: number
  averageConfidence?: number
  averageDeliveryTimeSeconds?: number
  specialization?: string
  marketDomain: string
  timestamp: string
}

export type MarketEventType =
  | 'SessionCreated'
  | 'WantBroadcast'
  | 'BidSubmitted'
  | 'WinnerSelected'
  | 'EscrowRequested'
  | 'SettlementInitiated'
  | 'MemoGenerated'
  | 'VerificationPassed'
  | 'VerificationFailed'
  | 'SettlementCompleted'
  | 'MarketClosed'
  | 'ReputationUpdated'

export interface MarketSessionRecord {
  id: string
  sessionId: string
  namespace: string
  status: string
  currentStage: string
  createdAt: string
  completedAt?: string
  winningAgentId?: string
  settlementStatus?: string
  dataSource?: string
  updatedAt: string
}

export interface MarketEventRecord {
  id: string
  sessionId: string
  round: number
  type: MarketEventType
  actorId?: string
  entityId?: string
  payload: unknown
  timestamp: string
}

export interface InvestmentMemoRecord {
  id: string
  sessionId: string
  round: number
  memoId: string
  agentId?: string
  question?: string
  recommendation?: string
  confidence?: number
  dataSources: unknown[]
  providerObservability: unknown[]
  memo: unknown
  createdAt: string
}

export type MemoReviewStatus = 'Needs Review' | 'Approved' | 'Watchlist' | 'Rejected'

export interface MemoExportHistoryRecord {
  id: string
  timestamp: string
  actor?: string
  note?: string
}

export interface MemoWorkspaceRecord {
  id: string
  sessionId: string
  memoId?: string
  reviewStatus: MemoReviewStatus
  note: string
  reviewer?: string
  exportReady: boolean
  exportHistory: MemoExportHistoryRecord[]
  createdAt: string
  updatedAt: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface WorkspaceMembershipRecord {
  id: string
  sessionId: string
  publisherId: string
  role: WorkspaceRole
  displayName?: string
  status: 'active' | 'revoked'
  grantedBy?: string
  grantedAt: string
  updatedAt: string
}

export interface AgentProfileRecord {
  id: string
  agentId: string
  specialization: string
  marketsCompleted: number
  wins: number
  revenueSol: number
  averageConfidence?: number
  averageDeliveryTimeSeconds?: number
  verificationRate?: number
  lastSessionId?: string
  updatedAt: string
}

export interface GraphNodeRecord {
  id: string
  sessionId: string
  type: string
  label: string
  entityId: string
  properties?: unknown
  timestamp: string
}

export interface GraphEdgeRecord {
  id: string
  sessionId: string
  from: string
  to: string
  type: string
  properties?: unknown
  timestamp: string
}

export interface IntelligenceGraphSnapshot {
  sessionId: string
  nodes: GraphNodeRecord[]
  edges: GraphEdgeRecord[]
}
