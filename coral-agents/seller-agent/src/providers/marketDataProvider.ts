import { mockMarketPrice, type MarketPrice } from './mockDataProvider.js'

const cache = new Map<string, MarketPrice>()

export async function getMarketPrice(symbol = 'NVDA'): Promise<MarketPrice> {
  const key = `price:${symbol}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    const live = await yahooChart(symbol)
    cache.set(key, live)
    return live
  } catch (error) {
    const fallback = mockMarketPrice(symbol, (error as Error).message)
    cache.set(key, fallback)
    return fallback
  }
}

async function yahooChart(symbol: string): Promise<MarketPrice> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`)
  const body = await res.json() as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; currency?: string }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: number[] }> } }> }
  }
  const result = body.chart?.result?.[0]
  const closes = result?.indicators?.quote?.[0]?.close?.filter((n): n is number => typeof n === 'number') ?? []
  const latestPrice = result?.meta?.regularMarketPrice ?? closes.at(-1)
  if (!latestPrice) throw new Error('Yahoo Finance price missing')
  const previous = closes.at(-2)
  const first = closes[0]
  const pct = (from?: number, to?: number) => from && to ? Number((((to - from) / from) * 100).toFixed(2)) : undefined
  return {
    symbol,
    latestPrice,
    currency: result?.meta?.currency ?? 'USD',
    dailyChangePercent: pct(previous, latestPrice),
    weeklyChangePercent: pct(first, latestPrice),
    source: { label: 'Yahoo Finance chart API', mode: 'LIVE DATA', timestamp: new Date().toISOString() },
  }
}
