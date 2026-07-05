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
  rounds: Round[]
  updatedAt: string
  error?: string
  diagnostics?: FeedDiagnostics
}

export interface FeedDiagnostics {
  api: string
  coral: string
  messageCount: number
  lastEventType: string
  lastEvent: string
  buyerStatus: string
  sellerBidCount: number
  escrowStatus: string
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
