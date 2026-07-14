import type { Round } from './foldRounds.js'

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

const explorerTx = (sig: string): string => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

const latestRound = (rounds: Round[]): Round | undefined =>
  [...rounds].sort((a, b) => b.round - a.round)[0]

function dataSource(round?: Round): MarketStatus['dataSource'] {
  const data = round?.delivered?.data
  if (!data || typeof data !== 'object') return 'Unknown'
  const badge = (data as { data_badge?: unknown }).data_badge
  return badge === 'Live data' || badge === 'Demo fallback data' ? badge : 'Unknown'
}

export function deriveMarketStatus(params: {
  session?: string
  rounds: Round[]
  startedAt?: number
  now?: number
  error?: string
}): MarketStatus {
  const { session = '', rounds, startedAt, error } = params
  const now = params.now ?? Date.now()
  const round = latestRound(rounds)
  const sellerBidCount = round ? new Set(round.bids.map((bid) => bid.by)).size : 0
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : undefined

  if (error) {
    return {
      currentStage: 'ERROR',
      currentStageLabel: 'Runtime error',
      latestRound: round?.round,
      buyerStatus: session ? 'Session exists, but the feed could not read the full market state.' : 'No active session.',
      sellerStatus: 'Unknown',
      sellerBidCount,
      winningAgent: round?.award?.to,
      settlementStatus: 'Unknown',
      explorerLink: round?.release?.sig ? explorerTx(round.release.sig) : round?.deposit?.sig ? explorerTx(round.deposit.sig) : undefined,
      dataSource: dataSource(round),
      elapsedMs,
    }
  }

  if (!session) {
    return {
      currentStage: 'NO_SESSION',
      currentStageLabel: 'No market session',
      buyerStatus: 'No session. Start a market or reconnect to an existing session.',
      sellerStatus: 'Waiting for market session.',
      sellerBidCount: 0,
      settlementStatus: 'Not started',
      dataSource: 'Unknown',
    }
  }

  if (!round?.want) {
    return {
      currentStage: 'SESSION_CREATED',
      currentStageLabel: 'Session created',
      buyerStatus: 'Waiting for buyer to broadcast WANT.',
      sellerStatus: 'Seller agents may still be starting.',
      sellerBidCount,
      settlementStatus: 'Not started',
      dataSource: 'Unknown',
      elapsedMs,
    }
  }

  const base = {
    latestRound: round.round,
    buyerStatus: `WANT broadcast for ${round.want.service}:${round.want.arg}`,
    sellerBidCount,
    winningAgent: round.award?.to,
    dataSource: dataSource(round),
    elapsedMs,
  }

  if (round.refunded) {
    return {
      ...base,
      currentStage: 'REFUNDED',
      currentStageLabel: 'Escrow refunded',
      sellerStatus: `${sellerBidCount} seller bid(s) received.`,
      settlementStatus: 'Refunded',
    }
  }
  if (round.release) {
    return {
      ...base,
      currentStage: 'PAYMENT_RELEASED',
      currentStageLabel: 'Payment released',
      sellerStatus: `${sellerBidCount} seller bid(s) received.`,
      settlementStatus: 'Released',
      explorerLink: explorerTx(round.release.sig),
    }
  }
  if (round.verified) {
    return {
      ...base,
      currentStage: 'VERIFICATION_COMPLETE',
      currentStageLabel: round.verified.status === 'PASS' ? 'Verification passed' : 'Verification failed',
      sellerStatus: `${sellerBidCount} seller bid(s) received.`,
      settlementStatus: round.verified.status === 'PASS' ? 'Ready to release' : 'Held for review',
      explorerLink: round.deposit?.sig ? explorerTx(round.deposit.sig) : undefined,
    }
  }
  if (round.delivered) {
    return {
      ...base,
      currentStage: 'INTELLIGENCE_DELIVERED',
      currentStageLabel: 'Intelligence delivered',
      sellerStatus: 'Winning seller delivered the memo.',
      settlementStatus: 'Awaiting verification',
      explorerLink: round.deposit?.sig ? explorerTx(round.deposit.sig) : undefined,
    }
  }
  if (round.deposit) {
    return {
      ...base,
      currentStage: 'ESCROW_DEPOSITED',
      currentStageLabel: 'Escrow deposited',
      sellerStatus: 'Winning seller can verify escrow and deliver.',
      settlementStatus: 'Deposited',
      explorerLink: explorerTx(round.deposit.sig),
    }
  }
  if (round.escrow) {
    return {
      ...base,
      currentStage: 'ESCROW_REQUESTED',
      currentStageLabel: 'Escrow requested',
      sellerStatus: 'Winning seller requested escrow funding.',
      settlementStatus: 'Escrow requested',
    }
  }
  if (round.award) {
    return {
      ...base,
      currentStage: 'WINNER_SELECTED',
      currentStageLabel: 'Winner selected',
      sellerStatus: `${sellerBidCount} seller bid(s) received.`,
      settlementStatus: 'Awaiting deposit',
    }
  }
  if (sellerBidCount > 0) {
    return {
      ...base,
      currentStage: 'BIDS_RECEIVED',
      currentStageLabel: 'Bids received',
      sellerStatus: `${sellerBidCount} seller bid(s) received.`,
      settlementStatus: 'Not started',
    }
  }
  return {
    ...base,
    currentStage: 'WANT_BROADCAST',
    currentStageLabel: 'Research request broadcast',
    sellerStatus: 'Waiting for seller bids.',
    settlementStatus: 'Not started',
  }
}
