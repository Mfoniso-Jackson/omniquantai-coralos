import type { DataMode, MarketSnapshot } from '../models.js'

export interface MarketDataProvider {
  name: string
  mode: DataMode
  getSnapshot(input: { sessionId: string; symbol: string }): Promise<MarketSnapshot>
}

export class MockMarketDataProvider implements MarketDataProvider {
  name = 'mock-market-data'
  mode: DataMode = 'DEMO DATA'

  async getSnapshot(input: { sessionId: string; symbol: string }): Promise<MarketSnapshot> {
    return {
      id: `${input.sessionId}:market-snapshot:${input.symbol}`,
      sessionId: input.sessionId,
      symbol: input.symbol,
      dataMode: this.mode,
      timestamp: new Date().toISOString(),
      price: input.symbol.toUpperCase() === 'NVDA' ? 875.28 : undefined,
      volatility: 0.42,
      liquidity: 'institutional',
      provider: this.name,
      summary: 'Deterministic demo snapshot. Replace with live provider when API keys are configured.',
    }
  }
}

export function marketDataProviderFromEnv(): MarketDataProvider {
  // Future live providers can branch on FINNHUB_API_KEY, POLYGON_API_KEY, FMP_API_KEY, etc.
  return new MockMarketDataProvider()
}
