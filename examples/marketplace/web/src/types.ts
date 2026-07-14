// The feed server's API contract (mirrors marketplace-feed's Round). Kept here so the browser bundle
// never imports the node-side runtime/anchor/web3 code.

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

export interface Feed {
  session: string
  namespace?: string
  rounds: Round[]
  updatedAt: string
  error?: string
  diagnostics?: FeedDiagnostics
  marketStatus?: MarketStatus
}

export type MarketStage =
  | 'NO_SESSION'
  | 'SESSION_CREATED'
  | 'WANT_BROADCAST'
  | 'BIDS_RECEIVED'
  | 'WINNER_SELECTED'
  | 'ESCROW_REQUESTED'
  | 'ESCROW_DEPOSITED'
  | 'INTELLIGENCE_DELIVERED'
  | 'VERIFICATION_COMPLETE'
  | 'PAYMENT_RELEASED'
  | 'REFUNDED'
  | 'ERROR'

export interface MarketStatus {
  currentStage: MarketStage
  currentStageLabel: string
  latestRound?: number
  buyerStatus: string
  sellerStatus: string
  sellerBidCount: number
  winningAgent?: string
  settlementStatus: string
  explorerLink?: string
  dataSource: 'Live data' | 'Demo fallback data' | 'Unknown'
  elapsedMs?: number
}

export interface FeedDiagnostics {
  api: string
  coral: string
  build?: string
  currentStage?: MarketStage
  currentStageLabel?: string
  elapsedMs?: number
  messageCount: number
  lastEventType: string
  lastEvent: string
  buyerStatus: string
  sellerStatus?: string
  sellerBidCount: number
  winningAgent?: string
  settlementStatus?: string
  explorerLink?: string
  dataSource?: 'Live data' | 'Demo fallback data' | 'Unknown'
  escrowStatus: string
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
