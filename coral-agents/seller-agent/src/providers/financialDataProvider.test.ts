import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_TIMESTAMP, mockFundamentals, mockHeadlines, mockMarketPrice } from './mockDataProvider.js'
import { getFinancialDataContext, normalizeAsset } from './financialDataProvider.js'

describe('financial data provider', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
    vi.restoreAllMocks()
  })

  it('normalizes supported assets from requests', () => {
    expect(normalizeAsset('nvda-3-6m-exposure')).toBe('NVDA')
    expect(normalizeAsset('review Apple exposure')).toBe('AAPL')
    expect(normalizeAsset('bitcoin treasury risk')).toBe('BTC')
    expect(normalizeAsset('ethereum staking context')).toBe('ETH')
  })

  it('returns deterministic fallback data for the supported asset set', () => {
    for (const symbol of ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'BTC', 'ETH']) {
      expect(mockMarketPrice(symbol).source.timestamp).toBe(FALLBACK_TIMESTAMP)
      expect(mockHeadlines('test', symbol)).toHaveLength(3)
      expect(mockFundamentals('test', symbol).source.timestamp).toBe(FALLBACK_TIMESTAMP)
    }
    expect(mockMarketPrice('AAPL').latestPrice).not.toBe(mockMarketPrice('NVDA').latestPrice)
  })

  it('never fails when live providers are unavailable', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network unavailable') }) as unknown as typeof fetch

    const context = await getFinancialDataContext('TSLA')

    expect(context.asset).toBe('TSLA')
    expect(context.dataMode).toBe('DEMO FALLBACK DATA')
    expect(context.price.source.mode).toBe('DEMO FALLBACK DATA')
    expect(context.headlines).toHaveLength(3)
    expect(context.companyProfile.name).toBe('Tesla, Inc.')
    expect(context.macroIndicators.length).toBeGreaterThan(3)
    expect(context.technicals.symbol).toBe('TSLA')
    expect(context.sources.every((source) => source.timestamp)).toBe(true)
    expect(context.observability.some((item) => item.fallbackUsed)).toBe(true)
  })
})
