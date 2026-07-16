export interface SourceMeta {
  label: string
  mode: 'LIVE DATA' | 'DEMO FALLBACK DATA'
  timestamp: string
  reason?: string
}

export interface MarketPrice {
  symbol: string
  latestPrice: number
  currency: string
  dailyChangePercent?: number
  weeklyChangePercent?: number
  volume?: number
  marketCap?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  averageVolume?: number
  volatility?: number
  historicalPrices?: Array<{ date: string; close: number }>
  source: SourceMeta
}

export interface NewsHeadline {
  title: string
  summary?: string
  source: string
  url?: string
  timestamp: string
  sentiment?: 'positive' | 'neutral' | 'negative'
}

export interface FundamentalsSnapshot {
  marketCap?: number
  peRatio?: number
  forwardPe?: number
  revenue?: number
  revenueGrowth?: number
  eps?: number
  ebitda?: number
  grossMargin?: number
  operatingMargin?: number
  roe?: number
  roic?: number
  debt?: number
  cash?: number
  freeCashFlow?: number
  analystTarget?: number
  source: SourceMeta
}

export interface CompanyProfile {
  symbol: string
  name: string
  sector?: string
  industry?: string
  country?: string
  exchange?: string
  website?: string
  description?: string
  source: SourceMeta
}

export interface MacroIndicator {
  name: string
  value: number
  unit: string
  timestamp: string
  source: SourceMeta
}

export interface TechnicalSnapshot {
  symbol: string
  sma50?: number
  sma200?: number
  ema20?: number
  rsi14?: number
  macd?: number
  atr14?: number
  bollingerBandPosition?: 'upper' | 'middle' | 'lower'
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
  companyProfile?: CompanyProfile
  macroIndicators?: MacroIndicator[]
  technicals?: TechnicalSnapshot
  solanaOracle: SolanaOracleContext
  confidenceCaveat: string
  sources: SourceMeta[]
}

export const FALLBACK_TIMESTAMP = '2026-07-16T00:00:00.000Z'

type FallbackAsset = {
  name: string
  sector: string
  industry: string
  price: number
  dailyChangePercent: number
  weeklyChangePercent: number
  volume: number
  marketCap: number
  high52: number
  low52: number
  avgVolume: number
  volatility: number
  revenue: number
  eps: number
  pe: number
  forwardPe: number
  ebitda: number
  grossMargin: number
  operatingMargin: number
  roe: number
  roic: number
  debt: number
  cash: number
  freeCashFlow: number
  analystTarget: number
  headlines: string[]
  technicals: Omit<TechnicalSnapshot, 'symbol' | 'source'>
}

const fallbackAssets: Record<string, FallbackAsset> = {
  NVDA: {
    name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', price: 207.2,
    dailyChangePercent: -2.49, weeklyChangePercent: -1.78, volume: 242_000_000, marketCap: 5_050_000_000_000,
    high52: 212.19, low52: 86.62, avgVolume: 210_000_000, volatility: 0.46, revenue: 165_200_000_000,
    eps: 3.1, pe: 66.8, forwardPe: 38.2, ebitda: 105_000_000_000, grossMargin: 0.74, operatingMargin: 0.62,
    roe: 0.91, roic: 0.68, debt: 12_000_000_000, cash: 58_000_000_000, freeCashFlow: 61_000_000_000,
    analystTarget: 225, headlines: [
      'Nvidia AI accelerator demand remains central to data center capex debate',
      'Investors weigh premium valuation against continued earnings revision momentum',
      'Portfolio managers monitor concentration risk in mega-cap AI exposure',
    ], technicals: { sma50: 186.4, sma200: 142.8, ema20: 198.6, rsi14: 61, macd: 4.2, atr14: 7.8, bollingerBandPosition: 'upper' },
  },
  AAPL: {
    name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', price: 214.3, dailyChangePercent: 0.42,
    weeklyChangePercent: 1.1, volume: 58_000_000, marketCap: 3_250_000_000_000, high52: 237.49, low52: 164.08,
    avgVolume: 61_000_000, volatility: 0.22, revenue: 391_000_000_000, eps: 6.18, pe: 34.7, forwardPe: 28.4,
    ebitda: 134_000_000_000, grossMargin: 0.46, operatingMargin: 0.31, roe: 1.38, roic: 0.56, debt: 98_000_000_000,
    cash: 67_000_000_000, freeCashFlow: 101_000_000_000, analystTarget: 230, headlines: [
      'Apple services growth remains a stabilizer against hardware cyclicality',
      'Investors monitor AI device cycle timing and margin impact',
      'Capital returns continue to support long-duration shareholder base',
    ], technicals: { sma50: 205.1, sma200: 192.7, ema20: 211.5, rsi14: 57, macd: 1.8, atr14: 4.1, bollingerBandPosition: 'middle' },
  },
  MSFT: {
    name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software Infrastructure', price: 498.4, dailyChangePercent: 0.76,
    weeklyChangePercent: 2.04, volume: 24_000_000, marketCap: 3_700_000_000_000, high52: 512.2, low52: 388.03,
    avgVolume: 27_000_000, volatility: 0.24, revenue: 281_000_000_000, eps: 13.42, pe: 37.1, forwardPe: 31.6,
    ebitda: 154_000_000_000, grossMargin: 0.69, operatingMargin: 0.45, roe: 0.36, roic: 0.29, debt: 74_000_000_000,
    cash: 92_000_000_000, freeCashFlow: 82_000_000_000, analystTarget: 540, headlines: [
      'Azure AI demand continues to shape Microsoft growth expectations',
      'Copilot monetization remains a key operating leverage question',
      'Enterprise cloud renewals support resilient revenue base',
    ], technicals: { sma50: 480.2, sma200: 436.5, ema20: 492.8, rsi14: 64, macd: 6.1, atr14: 8.9, bollingerBandPosition: 'upper' },
  },
  AMZN: {
    name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail', price: 225.9, dailyChangePercent: 0.34,
    weeklyChangePercent: 1.92, volume: 44_000_000, marketCap: 2_410_000_000_000, high52: 233.0, low52: 151.61,
    avgVolume: 47_000_000, volatility: 0.31, revenue: 690_000_000_000, eps: 6.4, pe: 35.3, forwardPe: 29.8,
    ebitda: 118_000_000_000, grossMargin: 0.49, operatingMargin: 0.11, roe: 0.22, roic: 0.16, debt: 136_000_000_000,
    cash: 89_000_000_000, freeCashFlow: 54_000_000_000, analystTarget: 250, headlines: [
      'AWS margin expansion remains central to Amazon earnings leverage',
      'Retail efficiency gains support operating income resilience',
      'AI infrastructure spending increases scrutiny on cloud returns',
    ], technicals: { sma50: 216.4, sma200: 196.5, ema20: 222.1, rsi14: 59, macd: 3.4, atr14: 5.6, bollingerBandPosition: 'middle' },
  },
  GOOGL: {
    name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', price: 196.7,
    dailyChangePercent: -0.18, weeklyChangePercent: 0.88, volume: 31_000_000, marketCap: 2_390_000_000_000,
    high52: 205.0, low52: 142.66, avgVolume: 35_000_000, volatility: 0.27, revenue: 385_000_000_000, eps: 9.2,
    pe: 21.4, forwardPe: 19.7, ebitda: 142_000_000_000, grossMargin: 0.58, operatingMargin: 0.32, roe: 0.31,
    roic: 0.24, debt: 29_000_000_000, cash: 111_000_000_000, freeCashFlow: 77_000_000_000, analystTarget: 220,
    headlines: [
      'Alphabet AI search monetization remains the core investor debate',
      'Cloud profitability continues to improve from a smaller base',
      'Regulatory risk remains a persistent valuation discount factor',
    ], technicals: { sma50: 190.3, sma200: 174.1, ema20: 194.8, rsi14: 55, macd: 1.2, atr14: 4.8, bollingerBandPosition: 'middle' },
  },
  TSLA: {
    name: 'Tesla, Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', price: 312.6, dailyChangePercent: 1.6,
    weeklyChangePercent: 5.4, volume: 112_000_000, marketCap: 1_010_000_000_000, high52: 348.8, low52: 138.8,
    avgVolume: 98_000_000, volatility: 0.62, revenue: 104_000_000_000, eps: 2.9, pe: 107.8, forwardPe: 82.1,
    ebitda: 18_000_000_000, grossMargin: 0.18, operatingMargin: 0.08, roe: 0.17, roic: 0.12, debt: 12_000_000_000,
    cash: 31_000_000_000, freeCashFlow: 6_000_000_000, analystTarget: 275, headlines: [
      'Tesla autonomy narrative drives renewed multiple expansion debate',
      'EV margin pressure remains a key bear case for earnings quality',
      'Investors weigh robotics optionality against core auto cyclicality',
    ], technicals: { sma50: 286.2, sma200: 241.0, ema20: 305.4, rsi14: 68, macd: 9.7, atr14: 14.8, bollingerBandPosition: 'upper' },
  },
  BTC: {
    name: 'Bitcoin', sector: 'Digital Assets', industry: 'Crypto Asset', price: 118_000, dailyChangePercent: 1.9,
    weeklyChangePercent: 7.2, volume: 48_000_000_000, marketCap: 2_340_000_000_000, high52: 123_000, low52: 52_000,
    avgVolume: 36_000_000_000, volatility: 0.68, revenue: 0, eps: 0, pe: 0, forwardPe: 0, ebitda: 0, grossMargin: 0,
    operatingMargin: 0, roe: 0, roic: 0, debt: 0, cash: 0, freeCashFlow: 0, analystTarget: 0,
    headlines: [
      'Bitcoin liquidity improves as institutional access broadens',
      'Macro rate expectations remain important for crypto risk appetite',
      'ETF flows continue to influence marginal demand',
    ], technicals: { sma50: 106_000, sma200: 88_000, ema20: 114_200, rsi14: 63, macd: 2400, atr14: 5200, bollingerBandPosition: 'upper' },
  },
  ETH: {
    name: 'Ethereum', sector: 'Digital Assets', industry: 'Smart Contract Platform', price: 4_850, dailyChangePercent: 2.2,
    weeklyChangePercent: 6.1, volume: 26_000_000_000, marketCap: 584_000_000_000, high52: 5_120, low52: 2_100,
    avgVolume: 18_000_000_000, volatility: 0.72, revenue: 0, eps: 0, pe: 0, forwardPe: 0, ebitda: 0, grossMargin: 0,
    operatingMargin: 0, roe: 0, roic: 0, debt: 0, cash: 0, freeCashFlow: 0, analystTarget: 0,
    headlines: [
      'Ethereum activity improves as scaling costs decline',
      'Staking yield and ETF access shape institutional demand',
      'Protocol revenue remains cyclical with on-chain activity',
    ], technicals: { sma50: 4_420, sma200: 3_620, ema20: 4_720, rsi14: 60, macd: 140, atr14: 260, bollingerBandPosition: 'middle' },
  },
}

function asset(symbol: string): FallbackAsset {
  return fallbackAssets[symbol.toUpperCase()] ?? fallbackAssets.NVDA
}

function source(label: string, reason: string): SourceMeta {
  return { label: `${label} (${reason})`, mode: 'DEMO FALLBACK DATA', timestamp: FALLBACK_TIMESTAMP, reason }
}

export function mockMarketPrice(symbol = 'NVDA', reason = 'live price unavailable'): MarketPrice {
  const item = asset(symbol)
  return {
    symbol: symbol.toUpperCase(),
    latestPrice: item.price,
    currency: 'USD',
    dailyChangePercent: item.dailyChangePercent,
    weeklyChangePercent: item.weeklyChangePercent,
    volume: item.volume,
    marketCap: item.marketCap,
    fiftyTwoWeekHigh: item.high52,
    fiftyTwoWeekLow: item.low52,
    averageVolume: item.avgVolume,
    volatility: item.volatility,
    historicalPrices: [4, 3, 2, 1, 0].map((daysAgo) => ({
      date: new Date(Date.parse(FALLBACK_TIMESTAMP) - daysAgo * 86_400_000).toISOString().slice(0, 10),
      close: Number((item.price * (1 - daysAgo * 0.006)).toFixed(2)),
    })),
    source: source('Deterministic demo price', reason),
  }
}

export function mockHeadlines(reason = 'live headlines unavailable', symbol = 'NVDA'): NewsHeadline[] {
  const item = asset(symbol)
  return item.headlines.map((title, index) => ({
    title,
    summary: `${item.name} fallback article ${index + 1} used for deterministic research context.`,
    source: `Deterministic demo news (${reason})`,
    timestamp: FALLBACK_TIMESTAMP,
    sentiment: index === 1 ? 'neutral' : 'positive',
  }))
}

export function mockFundamentals(reason = 'fundamentals API unavailable', symbol = 'NVDA'): FundamentalsSnapshot {
  const item = asset(symbol)
  return {
    marketCap: item.marketCap,
    peRatio: item.pe,
    forwardPe: item.forwardPe,
    revenue: item.revenue,
    revenueGrowth: symbol.toUpperCase() === 'NVDA' ? 0.78 : undefined,
    eps: item.eps,
    ebitda: item.ebitda,
    grossMargin: item.grossMargin,
    operatingMargin: item.operatingMargin,
    roe: item.roe,
    roic: item.roic,
    debt: item.debt,
    cash: item.cash,
    freeCashFlow: item.freeCashFlow,
    analystTarget: item.analystTarget,
    source: source('Deterministic demo fundamentals', reason),
  }
}

export function mockCompanyProfile(reason = 'company profile unavailable', symbol = 'NVDA'): CompanyProfile {
  const item = asset(symbol)
  return {
    symbol: symbol.toUpperCase(),
    name: item.name,
    sector: item.sector,
    industry: item.industry,
    country: ['BTC', 'ETH'].includes(symbol.toUpperCase()) ? 'Global' : 'United States',
    exchange: ['BTC', 'ETH'].includes(symbol.toUpperCase()) ? 'Crypto' : 'NASDAQ',
    website: ['BTC', 'ETH'].includes(symbol.toUpperCase()) ? undefined : `https://www.${item.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.com`,
    description: `${item.name} deterministic fallback profile for OmniQuantAI research context.`,
    source: source('Deterministic demo company profile', reason),
  }
}

export function mockMacroIndicators(reason = 'macro provider unavailable'): MacroIndicator[] {
  const src = source('Deterministic demo macro', reason)
  return [
    { name: 'US 10Y Treasury Yield', value: 4.18, unit: '%', timestamp: FALLBACK_TIMESTAMP, source: src },
    { name: 'US CPI YoY', value: 3.1, unit: '%', timestamp: FALLBACK_TIMESTAMP, source: src },
    { name: 'Unemployment Rate', value: 4.0, unit: '%', timestamp: FALLBACK_TIMESTAMP, source: src },
    { name: 'VIX', value: 16.8, unit: 'index', timestamp: FALLBACK_TIMESTAMP, source: src },
    { name: 'WTI Oil', value: 82.4, unit: 'USD/bbl', timestamp: FALLBACK_TIMESTAMP, source: src },
    { name: 'Gold', value: 2420, unit: 'USD/oz', timestamp: FALLBACK_TIMESTAMP, source: src },
  ]
}

export function mockTechnicals(reason = 'technical indicators unavailable', symbol = 'NVDA'): TechnicalSnapshot {
  return {
    symbol: symbol.toUpperCase(),
    ...asset(symbol).technicals,
    source: source('Deterministic demo technicals', reason),
  }
}

export function mockSolanaOracleContext(reason = 'Pyth oracle unavailable'): SolanaOracleContext {
  return {
    symbol: 'SOL/USD',
    price: 150.25,
    confidenceInterval: 0.45,
    network: 'Solana devnet oracle context',
    use: 'Macro/liquidity context only; not used as NVDA valuation data.',
    source: source('Deterministic demo Solana oracle', reason),
  }
}
