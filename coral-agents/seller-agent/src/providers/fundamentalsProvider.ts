import { mockFundamentals, type FundamentalsSnapshot } from './mockDataProvider.js'
import { getFmpFundamentals } from './fmpProvider.js'

const cache = new Map<string, FundamentalsSnapshot>()

export async function getFundamentals(symbol = 'NVDA'): Promise<FundamentalsSnapshot> {
  const key = `fundamentals:${symbol}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    if (!process.env.FMP_API_KEY) throw new Error('FMP_API_KEY not configured')
    const live = await getFmpFundamentals(symbol)
    cache.set(key, live)
    return live
  } catch (error) {
    const fallback = mockFundamentals((error as Error).message, symbol)
    cache.set(key, fallback)
    return fallback
  }
}
