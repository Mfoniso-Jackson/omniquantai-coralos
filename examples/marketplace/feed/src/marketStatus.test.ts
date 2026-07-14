import { describe, expect, it } from 'vitest'
import { deriveMarketStatus } from './marketStatus.js'
import type { Round } from './foldRounds.js'

const baseRound: Round = {
  round: 1,
  want: { service: 'omniquant', arg: 'nvda-3-6m-exposure', budgetSol: 0.03 },
  bids: [],
  declined: [],
  status: 'bidding',
}

describe('deriveMarketStatus', () => {
  it('reports no-session state without requiring CoralOS', () => {
    expect(deriveMarketStatus({ rounds: [] })).toMatchObject({
      currentStage: 'NO_SESSION',
      settlementStatus: 'Not started',
      sellerBidCount: 0,
    })
  })

  it('moves from WANT to bids to award', () => {
    expect(deriveMarketStatus({ session: 's', rounds: [baseRound] })).toMatchObject({
      currentStage: 'WANT_BROADCAST',
      sellerStatus: 'Waiting for seller bids.',
    })
    expect(deriveMarketStatus({
      session: 's',
      rounds: [{ ...baseRound, bids: [{ by: 'market-analyst', priceSol: 0.01 }] }],
    })).toMatchObject({
      currentStage: 'BIDS_RECEIVED',
      sellerBidCount: 1,
    })
    expect(deriveMarketStatus({
      session: 's',
      rounds: [{ ...baseRound, bids: [{ by: 'market-analyst', priceSol: 0.01 }], award: { to: 'market-analyst' }, status: 'awarded' }],
    })).toMatchObject({
      currentStage: 'WINNER_SELECTED',
      winningAgent: 'market-analyst',
      settlementStatus: 'Awaiting deposit',
    })
  })

  it('surfaces release Explorer proof and data source', () => {
    const status = deriveMarketStatus({
      session: 's',
      startedAt: 1000,
      now: 2500,
      rounds: [{
        ...baseRound,
        bids: [{ by: 'portfolio-risk', priceSol: 0.014 }],
        award: { to: 'portfolio-risk' },
        deposit: { sig: 'depositSig', buyer: 'buyer' },
        delivered: { raw: '{}', data: { data_badge: 'Live data' } },
        verified: { status: 'PASS', score: 100, checks: [] },
        release: { sig: 'releaseSig' },
        status: 'settled',
      }],
    })
    expect(status).toMatchObject({
      currentStage: 'PAYMENT_RELEASED',
      settlementStatus: 'Released',
      dataSource: 'Live data',
      elapsedMs: 1500,
    })
    expect(status.explorerLink).toContain('/tx/releaseSig?cluster=devnet')
  })

  it('returns explicit error stage when feed cannot read runtime state', () => {
    expect(deriveMarketStatus({ session: 's', rounds: [], error: 'coral 404' })).toMatchObject({
      currentStage: 'ERROR',
      buyerStatus: 'Session exists, but the feed could not read the full market state.',
      settlementStatus: 'Unknown',
    })
  })
})
