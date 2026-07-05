export interface SourceMeta {
  label: string
  mode: 'LIVE DATA' | 'DEMO FALLBACK DATA'
  timestamp: string
}

export interface MarketPrice {
  symbol: string
  latestPrice: number
  currency: string
  dailyChangePercent?: number
  weeklyChangePercent?: number
  source: SourceMeta
}

export interface NewsHeadline {
  title: string
  source: string
  url?: string
  timestamp: string
}

export interface FundamentalsSnapshot {
  marketCap?: number
  peRatio?: number
  revenueGrowth?: number
  source: SourceMeta
}

export interface SolanaOracleContext {
  symbol: string
  price?: number
  confidenceInterval?: number
  network: string
  use: string
  source: SourceMeta
}

export interface OmniQuantDataContext {
  asset: string
  dataMode: 'LIVE DATA' | 'DEMO FALLBACK DATA'
  price: MarketPrice
  headlines: NewsHeadline[]
  fundamentals?: FundamentalsSnapshot
  solanaOracle: SolanaOracleContext
  confidenceCaveat: string
  sources: SourceMeta[]
}

const now = () => new Date().toISOString()

export function mockMarketPrice(symbol = 'NVDA', reason = 'live price unavailable'): MarketPrice {
  return {
    symbol,
    latestPrice: 875.28,
    currency: 'USD',
    dailyChangePercent: 1.2,
    weeklyChangePercent: 4.8,
    source: { label: `Deterministic mock price (${reason})`, mode: 'DEMO FALLBACK DATA', timestamp: now() },
  }
}

export function mockHeadlines(reason = 'live headlines unavailable'): NewsHeadline[] {
  const timestamp = now()
  return [
    { title: 'Nvidia AI accelerator demand remains central to data center capex debate', source: `Deterministic mock news (${reason})`, timestamp },
    { title: 'Investors weigh premium valuation against continued earnings revision momentum', source: `Deterministic mock news (${reason})`, timestamp },
    { title: 'Portfolio managers monitor concentration risk in mega-cap AI exposure', source: `Deterministic mock news (${reason})`, timestamp },
  ]
}

export function mockFundamentals(reason = 'fundamentals API unavailable'): FundamentalsSnapshot {
  return {
    marketCap: 2_150_000_000_000,
    peRatio: 68,
    revenueGrowth: 0.78,
    source: { label: `Deterministic mock fundamentals (${reason})`, mode: 'DEMO FALLBACK DATA', timestamp: now() },
  }
}

export function mockSolanaOracleContext(reason = 'Pyth oracle unavailable'): SolanaOracleContext {
  return {
    symbol: 'SOL/USD',
    price: 150.25,
    confidenceInterval: 0.45,
    network: 'Solana devnet oracle context',
    use: 'Macro/liquidity context only; not used as NVDA valuation data.',
    source: { label: `Deterministic mock Solana oracle (${reason})`, mode: 'DEMO FALLBACK DATA', timestamp: now() },
  }
}
