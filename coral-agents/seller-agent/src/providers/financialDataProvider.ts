import { getFundamentals } from './fundamentalsProvider.js'
import { getFmpCompanyProfile } from './fmpProvider.js'
import { getMarketPrice } from './marketDataProvider.js'
import { getNewsHeadlines } from './newsProvider.js'
import { getSolanaOracleContext } from './solanaOracleProvider.js'
import {
  mockCompanyProfile,
  mockMacroIndicators,
  mockTechnicals,
  type CompanyProfile,
  type FundamentalsSnapshot,
  type MacroIndicator,
  type MarketPrice,
  type NewsHeadline,
  type OmniQuantDataContext,
  type SourceMeta,
  type TechnicalSnapshot,
} from './mockDataProvider.js'

export interface ProviderObservation {
  provider: string
  capability: string
  mode: SourceMeta['mode']
  latencyMs: number
  cacheHit: boolean
  success: boolean
  fallbackUsed: boolean
  error?: string
  timestamp: string
}

export interface FinancialDataContext extends OmniQuantDataContext {
  companyProfile: CompanyProfile
  macroIndicators: MacroIndicator[]
  technicals: TechnicalSnapshot
  observability: ProviderObservation[]
}

export interface FinancialDataProvider {
  name: string
  getContext(input: { asset: string }): Promise<FinancialDataContext>
}

const contextCache = new Map<string, { expiresAt: number; value: FinancialDataContext }>()
const TTL_MS = 60_000

export class OmniQuantFinancialDataProvider implements FinancialDataProvider {
  name = 'omniquant-financial-data-layer'

  async getContext(input: { asset: string }): Promise<FinancialDataContext> {
    const asset = normalizeAsset(input.asset)
    const cached = contextCache.get(asset)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        observability: cached.value.observability.map((item) => ({ ...item, cacheHit: true })),
      }
    }

    const observations: ProviderObservation[] = []
    const [price, headlines, fundamentals, solanaOracle, companyProfile, macroIndicators, technicals] = await Promise.all([
      observe('market-price', () => getMarketPrice(asset), observations),
      observe('news', () => getNewsHeadlines(asset), observations),
      observe('fundamentals', () => getFundamentals(asset), observations),
      observe('solana-oracle', () => getSolanaOracleContext(), observations),
      observe('company-profile', () => getCompanyProfile(asset), observations),
      observe('macro', async () => mockMacroIndicators('live macro provider not configured'), observations),
      observe('technicals', async () => mockTechnicals('live technical indicator provider not configured', asset), observations),
    ])

    const sources = dedupeSources([
      price.source,
      fundamentals.source,
      solanaOracle.source,
      companyProfile.source,
      technicals.source,
      ...macroIndicators.map((item) => item.source),
      ...headlineSources(headlines),
    ])

    const hasLive = sources.some((source) => source.mode === 'LIVE DATA')
    const context: FinancialDataContext = {
      asset,
      dataMode: hasLive ? 'LIVE DATA' : 'DEMO FALLBACK DATA',
      price,
      headlines,
      fundamentals,
      solanaOracle,
      companyProfile,
      macroIndicators,
      technicals,
      sources,
      observability: observations,
      confidenceCaveat: hasLive
        ? 'Live data improves freshness, but this remains research support and requires human review.'
        : 'Live APIs were unavailable or unconfigured, so deterministic demo data was used for reliability.',
    }
    contextCache.set(asset, { expiresAt: Date.now() + TTL_MS, value: context })
    return context
  }
}

export function financialDataProviderFromEnv(): FinancialDataProvider {
  return new OmniQuantFinancialDataProvider()
}

export async function getFinancialDataContext(asset: string): Promise<FinancialDataContext> {
  return financialDataProviderFromEnv().getContext({ asset })
}

async function getCompanyProfile(asset: string): Promise<CompanyProfile> {
  try {
    return await getFmpCompanyProfile(asset)
  } catch (error) {
    return mockCompanyProfile((error as Error).message, asset)
  }
}

export function normalizeAsset(input: string): string {
  const upper = input.toUpperCase()
  if (upper.includes('AAPL') || upper.includes('APPLE')) return 'AAPL'
  if (upper.includes('MSFT') || upper.includes('MICROSOFT')) return 'MSFT'
  if (upper.includes('AMZN') || upper.includes('AMAZON')) return 'AMZN'
  if (upper.includes('GOOGL') || upper.includes('GOOG') || upper.includes('ALPHABET') || upper.includes('GOOGLE')) return 'GOOGL'
  if (upper.includes('TSLA') || upper.includes('TESLA')) return 'TSLA'
  if (upper.includes('BTC') || upper.includes('BITCOIN')) return 'BTC'
  if (upper.includes('ETH') || upper.includes('ETHEREUM')) return 'ETH'
  return 'NVDA'
}

async function observe<T>(
  capability: string,
  fn: () => Promise<T>,
  observations: ProviderObservation[],
): Promise<T> {
  const started = Date.now()
  try {
    const value = await fn()
    const mode = sourceMode(value)
    observations.push({
      provider: sourceLabel(value),
      capability,
      mode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      success: true,
      fallbackUsed: mode === 'DEMO FALLBACK DATA',
      timestamp: new Date().toISOString(),
    })
    return value
  } catch (error) {
    observations.push({
      provider: 'unknown',
      capability,
      mode: 'DEMO FALLBACK DATA',
      latencyMs: Date.now() - started,
      cacheHit: false,
      success: false,
      fallbackUsed: true,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

function sourceMode(value: unknown): SourceMeta['mode'] {
  const source = sourceFromValue(value)
  return source?.mode ?? 'DEMO FALLBACK DATA'
}

function sourceLabel(value: unknown): string {
  const source = sourceFromValue(value)
  return source?.label ?? 'mixed provider set'
}

function sourceFromValue(value: unknown): SourceMeta | undefined {
  if (Array.isArray(value)) return sourceFromValue(value[0])
  if (value && typeof value === 'object' && 'source' in value) {
    return (value as { source?: SourceMeta }).source
  }
  return undefined
}

function headlineSources(headlines: NewsHeadline[]): SourceMeta[] {
  return headlines.map((headline) => ({
    label: headline.source,
    mode: headline.source.includes('Deterministic demo') ? 'DEMO FALLBACK DATA' : 'LIVE DATA',
    timestamp: headline.timestamp,
  }))
}

function dedupeSources(sources: SourceMeta[]): SourceMeta[] {
  const seen = new Set<string>()
  return sources.filter((source) => {
    const key = `${source.label}:${source.mode}:${source.timestamp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type {
  CompanyProfile,
  FundamentalsSnapshot,
  MacroIndicator,
  MarketPrice,
  NewsHeadline,
  TechnicalSnapshot,
}
