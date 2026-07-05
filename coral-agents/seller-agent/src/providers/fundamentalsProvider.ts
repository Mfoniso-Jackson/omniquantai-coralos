import { mockFundamentals, type FundamentalsSnapshot } from './mockDataProvider.js'

const cache = new Map<string, FundamentalsSnapshot>()

export async function getFundamentals(symbol = 'NVDA'): Promise<FundamentalsSnapshot> {
  const key = `fundamentals:${symbol}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    if (!process.env.FMP_API_KEY) throw new Error('FMP_API_KEY not configured')
    const live = await fmpProfile(symbol, process.env.FMP_API_KEY)
    cache.set(key, live)
    return live
  } catch (error) {
    const fallback = mockFundamentals((error as Error).message)
    cache.set(key, fallback)
    return fallback
  }
}

async function fmpProfile(symbol: string, token: string): Promise<FundamentalsSnapshot> {
  const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FMP profile ${res.status}`)
  const [profile] = await res.json() as Array<{ mktCap?: number; pe?: number }>
  if (!profile) throw new Error('FMP profile missing')
  return {
    marketCap: profile.mktCap,
    peRatio: profile.pe,
    source: { label: 'Financial Modeling Prep profile API', mode: 'LIVE DATA', timestamp: new Date().toISOString() },
  }
}
