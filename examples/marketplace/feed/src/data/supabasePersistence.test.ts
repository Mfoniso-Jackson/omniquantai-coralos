import { afterEach, describe, expect, it, vi } from 'vitest'
import { mirrorCollectionRecord, targetFor } from './supabasePersistence.js'
import type { AgentBidRecord, MarketSessionRecord, SettlementRecord } from './models.js'

describe('supabasePersistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_STRICT
  })

  it('maps market sessions to the production table shape', () => {
    const record: MarketSessionRecord = {
      id: 'session-1',
      sessionId: 'session-1',
      namespace: 'omniquant',
      status: 'settled',
      currentStage: 'PAYMENT_RELEASED',
      createdAt: '2026-07-18T00:00:00.000Z',
      completedAt: '2026-07-18T00:01:00.000Z',
      winningAgentId: 'news-earnings',
      settlementStatus: 'RELEASED',
      dataSource: 'Live data',
      updatedAt: '2026-07-18T00:01:00.000Z',
    }

    expect(targetFor('market_sessions', record)).toMatchObject({
      table: 'market_sessions',
      onConflict: 'session_id',
      row: {
        session_id: 'session-1',
        namespace: 'omniquant',
        current_stage: 'PAYMENT_RELEASED',
        winning_agent_id: 'news-earnings',
      },
    })
  })

  it('upserts agent dependencies before bid records', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }))
    const bid: AgentBidRecord = {
      id: 'session-1:round:1:bid:news-earnings',
      sessionId: 'session-1',
      round: 1,
      sellerId: 'news-earnings',
      bidPriceSol: 0.011,
      confidence: 80,
      deliveryTimeSeconds: 22,
      reasoning: 'specialist fit',
      timestamp: '2026-07-18T00:00:10.000Z',
    }

    await mirrorCollectionRecord('agent_bids', bid)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/rest/v1/agents?')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/rest/v1/agent_bids?')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      bid_id: bid.id,
      seller_id: 'news-earnings',
      bid_price_sol: 0.011,
    })
  })

  it('stores explorer proof on settlement rows', () => {
    const settlement: SettlementRecord = {
      id: 'session-1:round:1:settlement',
      sessionId: 'session-1',
      round: 1,
      status: 'RELEASED',
      releaseSignature: 'abc123',
      timestamp: '2026-07-18T00:01:00.000Z',
    }

    expect(targetFor('settlements', settlement)).toMatchObject({
      table: 'settlements',
      row: {
        settlement_id: settlement.id,
        release_signature: 'abc123',
        explorer_url: 'https://explorer.solana.com/tx/abc123?cluster=devnet',
      },
    })
  })
})
