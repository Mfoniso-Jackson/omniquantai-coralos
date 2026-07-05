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

export interface IntelligenceGraphStub {
  nodes: Array<{ id: string; type: string; label: string }>
  edges: Array<{ from: string; to: string; type: string }>
}
