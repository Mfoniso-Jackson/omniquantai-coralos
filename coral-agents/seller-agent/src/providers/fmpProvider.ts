import {
  type CompanyProfile,
  type FundamentalsSnapshot,
  type MarketPrice,
} from './mockDataProvider.js'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'

type FmpProfile = {
  symbol?: string
  companyName?: string
  sector?: string
  industry?: string
  country?: string
  exchangeShortName?: string
  website?: string
  description?: string
  mktCap?: number
  pe?: number
  price?: number
  volAvg?: number
  range?: string
}

type FmpQuote = {
  symbol?: string
  price?: number
  changesPercentage?: number
  volume?: number
  marketCap?: number
  yearHigh?: number
  yearLow?: number
  avgVolume?: number
  pe?: number
  eps?: number
}

type FmpMetricsTtm = {
  peRatioTTM?: number
  revenuePerShareTTM?: number
  netIncomePerShareTTM?: number
  freeCashFlowPerShareTTM?: number
  returnOnEquityTTM?: number
  roicTTM?: number
}

export function hasFmpApiKey(): boolean {
  return Boolean(process.env.FMP_API_KEY)
}

export async function getFmpCompanyProfile(symbol = 'NVDA'): Promise<CompanyProfile> {
  const [profile] = await fmpGet<FmpProfile[]>(`profile/${symbol}`)
  if (!profile) throw new Error('FMP profile missing')

  return {
    symbol: profile.symbol ?? symbol.toUpperCase(),
    name: profile.companyName ?? symbol.toUpperCase(),
    sector: profile.sector,
    industry: profile.industry,
    country: profile.country,
    exchange: profile.exchangeShortName,
    website: profile.website,
    description: profile.description,
    source: liveSource('Financial Modeling Prep profile API'),
  }
}

export async function getFmpFundamentals(symbol = 'NVDA'): Promise<FundamentalsSnapshot> {
  const [[profile], [quote], [metrics]] = await Promise.all([
    fmpGet<FmpProfile[]>(`profile/${symbol}`),
    fmpGet<FmpQuote[]>(`quote/${symbol}`),
    fmpGet<FmpMetricsTtm[]>(`key-metrics-ttm/${symbol}`),
  ])
  if (!profile && !quote && !metrics) throw new Error('FMP fundamentals missing')

  return {
    marketCap: quote?.marketCap ?? profile?.mktCap,
    peRatio: metrics?.peRatioTTM ?? quote?.pe ?? profile?.pe,
    revenue: metrics?.revenuePerShareTTM,
    eps: quote?.eps ?? metrics?.netIncomePerShareTTM,
    roe: metrics?.returnOnEquityTTM,
    roic: metrics?.roicTTM,
    freeCashFlow: metrics?.freeCashFlowPerShareTTM,
    source: liveSource('Financial Modeling Prep fundamentals API'),
  }
}

export async function getFmpMarketPrice(symbol = 'NVDA'): Promise<MarketPrice> {
  const [quote] = await fmpGet<FmpQuote[]>(`quote/${symbol}`)
  if (!quote?.price) throw new Error('FMP quote price missing')

  return {
    symbol: quote.symbol ?? symbol.toUpperCase(),
    latestPrice: quote.price,
    currency: 'USD',
    dailyChangePercent: quote.changesPercentage,
    volume: quote.volume,
    marketCap: quote.marketCap,
    fiftyTwoWeekHigh: quote.yearHigh,
    fiftyTwoWeekLow: quote.yearLow,
    averageVolume: quote.avgVolume,
    source: liveSource('Financial Modeling Prep quote API'),
  }
}

async function fmpGet<T>(path: string): Promise<T> {
  const token = process.env.FMP_API_KEY
  if (!token) throw new Error('FMP_API_KEY not configured')

  const url = `${FMP_BASE_URL}/${path}?apikey=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FMP ${path} ${res.status}`)
  return res.json() as Promise<T>
}

function liveSource(label: string) {
  return { label, mode: 'LIVE DATA' as const, timestamp: new Date().toISOString() }
}
