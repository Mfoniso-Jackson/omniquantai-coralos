export type Capability =
  | 'equities'
  | 'crypto'
  | 'macro'
  | 'commodities'
  | 'options'
  | 'fx'
  | 'valuation'
  | 'sentiment'
  | 'portfolio-construction'
  | 'verification'
  | 'summarization'
  | 'screening'
  | 'risk-analysis'
  | 'technical-analysis'
  | 'news-analysis'

export type AgentStatus = 'pending' | 'active' | 'verified' | 'suspended' | 'deprecated'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface AgentPricing {
  floorSol: number
  suggestedSol?: number
  currency?: 'SOL' | 'USDC'
}

export interface AgentManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  specialization: string
  supportedMarkets: string[]
  capabilities: Capability[]
  pricing: AgentPricing
  dependencies?: string[]
  requiredData?: string[]
  riskLevel: RiskLevel
  homepage?: string
  repository?: string
  license: string
  status?: AgentStatus
}

export interface MarketContext {
  sessionId: string
  round: number
  service: string
  argument: string
  asset?: string
  budgetSol: number
  capabilitiesRequested?: Capability[]
  dataSources?: unknown[]
  createdAt?: string
}

export interface AgentEvaluation {
  supported: boolean
  confidence: number
  rationale: string
  unsupportedReason?: string
}

export interface BidResponse {
  agentId: string
  priceSol: number
  confidence: number
  deliveryTimeSeconds: number
  reasoning: string
  capabilities: Capability[]
}

export interface MemoInput {
  recommendation: 'BUY' | 'HOLD' | 'REDUCE' | 'SELL'
  confidence: number
  executiveSummary: string
  bullCase?: string
  baseCase?: string
  bearCase?: string
  risks?: string[]
  evidence?: unknown[]
  dataSources?: unknown[]
  disclaimer?: string
}

export interface MemoResponse extends MemoInput {
  agentId: string
  generatedAt: string
  notFinancialAdvice: true
}

export interface VerificationResponse {
  status: 'PASS' | 'FAIL'
  score: number
  checks: string[]
  decision: 'Release escrow' | 'Hold for review'
}

export interface AgentReputation {
  agentId: string
  marketsCompleted: number
  wins: number
  revenueSol: number
  averageConfidence?: number
  averageDeliveryTimeSeconds?: number
  verificationRate?: number
}

export interface AgentRegistration {
  manifest: AgentManifest
  registeredAt: string
  status: AgentStatus
}
