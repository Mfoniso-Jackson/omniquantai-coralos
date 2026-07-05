import { mockSolanaOracleContext, type SolanaOracleContext } from './mockDataProvider.js'

const cache = new Map<string, SolanaOracleContext>()

const SOL_USD_FEED_ID =
  process.env.PYTH_SOL_USD_FEED_ID ??
  'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

export async function getSolanaOracleContext(): Promise<SolanaOracleContext> {
  const key = `pyth:${SOL_USD_FEED_ID}`
  const cached = cache.get(key)
  if (cached) return cached
  try {
    const live = await pythSolUsd(SOL_USD_FEED_ID)
    cache.set(key, live)
    return live
  } catch (error) {
    const fallback = mockSolanaOracleContext((error as Error).message)
    cache.set(key, fallback)
    return fallback
  }
}

async function pythSolUsd(feedId: string): Promise<SolanaOracleContext> {
  const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${encodeURIComponent(feedId)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pyth Hermes ${res.status}`)
  const body = await res.json() as {
    parsed?: Array<{
      id?: string
      price?: { price?: string; conf?: string; expo?: number; publish_time?: number }
    }>
  }
  const parsed = body.parsed?.find((item) => item.id?.toLowerCase() === feedId.toLowerCase()) ?? body.parsed?.[0]
  const price = parsed?.price
  if (!price?.price || typeof price.expo !== 'number') throw new Error('Pyth SOL/USD price missing')
  const scale = 10 ** price.expo
  return {
    symbol: 'SOL/USD',
    price: Number(price.price) * scale,
    confidenceInterval: price.conf ? Number(price.conf) * scale : undefined,
    network: 'Pyth Hermes / Solana oracle context',
    use: 'Macro/liquidity context only; not used as NVDA valuation data.',
    source: {
      label: 'Pyth Hermes SOL/USD price feed',
      mode: 'LIVE DATA',
      timestamp: price.publish_time ? new Date(price.publish_time * 1000).toISOString() : new Date().toISOString(),
    },
  }
}
