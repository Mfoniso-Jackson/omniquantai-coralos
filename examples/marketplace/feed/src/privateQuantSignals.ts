import type { Candle, Signal } from './privateQuantBacktest.js'

export interface SignalGenerateRequest {
  strategyId?: string
  symbol?: string
  timeframe?: string
  candles?: Candle[]
  portfolioValue?: number
  parameters?: Record<string, unknown>
}

export interface SignalGenerateResponse {
  id: string
  strategyId: string
  symbol: string
  side: Uppercase<Signal>
  confidence: number
  rationale: string
  createdAt: string
  decision: {
    strategy: string
    signal: Signal
    confidence: number
    riskScore: number
    suggestedPositionSize: number
    stopLossPct: number
    explanation: string
  }
  engine: {
    provider: 'omniquant'
    model: 'deterministic-signal-engine-v1'
    dataMode: 'provided_candles' | 'deterministic_demo'
  }
}

export function generatePrivateSignal(input: SignalGenerateRequest): SignalGenerateResponse {
  const strategyId = cleanStrategyId(input.strategyId)
  const symbol = cleanSymbol(input.symbol)
  const normalized = normalizeCandles(input.candles)
  const portfolioValue = positiveNumber(input.portfolioValue, 100_000)
  const decision = evaluateStrategy(strategyId, {
    candles: normalized.candles,
    portfolioValue,
  })
  const createdAt = new Date().toISOString()

  return {
    id: `sig_${strategyId}_${symbol}_${normalized.candles.at(-1)?.timestamp ?? Date.now()}`,
    strategyId,
    symbol,
    side: decision.signal.toUpperCase() as Uppercase<Signal>,
    confidence: decision.confidence,
    rationale: decision.explanation,
    createdAt,
    decision,
    engine: {
      provider: 'omniquant',
      model: 'deterministic-signal-engine-v1',
      dataMode: normalized.dataMode,
    },
  }
}

function evaluateStrategy(strategyId: string, context: { candles: Candle[]; portfolioValue: number }): SignalGenerateResponse['decision'] {
  if (strategyId === 'mean-reversion' || strategyId === 'community-rsi-reversion') return meanReversion(context)
  if (strategyId === 'breakout') return breakout(context)
  if (strategyId === 'volatility-regime') return volatilityRegime(context)
  return trendFollowing(context)
}

function hold(strategy: string, explanation: string): SignalGenerateResponse['decision'] {
  return {
    strategy,
    signal: 'hold',
    confidence: 0.35,
    riskScore: 0.25,
    suggestedPositionSize: 0,
    stopLossPct: 0.03,
    explanation,
  }
}

function trendFollowing({ candles, portfolioValue }: { candles: Candle[]; portfolioValue: number }): SignalGenerateResponse['decision'] {
  const closes = candles.map((candle) => candle.close)
  if (closes.length < 36) return hold('Trend Following', 'Insufficient candles for trend confirmation.')
  const fast = sma(closes, 12)
  const slow = sma(closes, 36)
  const spread = slow === 0 ? 0 : (fast - slow) / slow
  const confidence = clamp(Math.abs(spread) * 18)
  const signal = spread > 0.004 ? 'buy' : spread < -0.004 ? 'sell' : 'hold'
  return {
    strategy: 'Trend Following',
    signal,
    confidence,
    riskScore: volatilityScore(candles),
    suggestedPositionSize: signal === 'hold' ? 0 : portfolioValue * clamp(confidence * 0.08, 0.01, 0.08),
    stopLossPct: 0.035,
    explanation: `Fast average is ${spread >= 0 ? 'above' : 'below'} the slow average by ${(spread * 100).toFixed(2)}%.`,
  }
}

function meanReversion({ candles, portfolioValue }: { candles: Candle[]; portfolioValue: number }): SignalGenerateResponse['decision'] {
  const closes = candles.map((candle) => candle.close)
  if (closes.length < 30) return hold('Mean Reversion', 'Insufficient candles for mean reversion.')
  const mean = sma(closes, 30)
  const sd = standardDeviation(closes.slice(-30))
  const last = closes.at(-1) ?? mean
  const zScore = sd === 0 ? 0 : (last - mean) / sd
  const signal = zScore < -1.4 ? 'buy' : zScore > 1.4 ? 'sell' : 'hold'
  const confidence = clamp(Math.abs(zScore) / 3)
  return {
    strategy: 'Mean Reversion',
    signal,
    confidence,
    riskScore: clamp(volatilityScore(candles) + Math.abs(zScore) * 0.08),
    suggestedPositionSize: signal === 'hold' ? 0 : portfolioValue * clamp(confidence * 0.06, 0.01, 0.06),
    stopLossPct: 0.025,
    explanation: `Price is ${zScore.toFixed(2)} standard deviations from its 30-candle mean.`,
  }
}

function breakout({ candles, portfolioValue }: { candles: Candle[]; portfolioValue: number }): SignalGenerateResponse['decision'] {
  if (candles.length < 25) return hold('Breakout', 'Insufficient candles for breakout range.')
  const recent = candles.slice(-25, -1)
  const last = candles.at(-1) as Candle
  const high = Math.max(...recent.map((candle) => candle.high))
  const low = Math.min(...recent.map((candle) => candle.low))
  const upward = last.close > high
  const downward = last.close < low
  const signal = upward ? 'buy' : downward ? 'sell' : 'hold'
  const range = high - low || last.close
  const confidence = clamp((Math.abs(last.close - (upward ? high : low)) / range) * 8)
  return {
    strategy: 'Breakout',
    signal,
    confidence,
    riskScore: clamp(volatilityScore(candles) + (signal === 'hold' ? 0.05 : 0.12)),
    suggestedPositionSize: signal === 'hold' ? 0 : portfolioValue * clamp(confidence * 0.05, 0.01, 0.05),
    stopLossPct: 0.04,
    explanation: signal === 'hold' ? 'Price remains inside the recent range.' : 'Price closed outside the recent range.',
  }
}

function volatilityRegime({ candles }: { candles: Candle[] }): SignalGenerateResponse['decision'] {
  const vol = volatilityScore(candles)
  const signal = vol > 0.72 ? 'hold' : 'buy'
  return {
    strategy: 'Volatility Regime Detection',
    signal,
    confidence: vol > 0.72 ? 0.8 : 0.48,
    riskScore: vol,
    suggestedPositionSize: signal === 'hold' ? 0 : 1_500,
    stopLossPct: 0.03,
    explanation: vol > 0.72 ? 'Volatility is elevated, so the agent should avoid new exposure.' : "Volatility is within the system's tradable regime.",
  }
}

function normalizeCandles(candles: Candle[] | undefined): { candles: Candle[]; dataMode: SignalGenerateResponse['engine']['dataMode'] } {
  const valid = (candles ?? []).filter(isCandle)
  return valid.length >= 36
    ? { candles: valid, dataMode: 'provided_candles' }
    : { candles: generateDemoCandles(), dataMode: 'deterministic_demo' }
}

function generateDemoCandles(count = 180, start = 64_000): Candle[] {
  const baseTimestamp = Date.parse('2026-01-01T00:00:00.000Z')
  return Array.from({ length: count }, (_, index) => {
    const trend = index * 32
    const cycle = Math.sin(index / 8) * 950
    const noise = Math.cos(index / 3) * 180
    const close = start + trend + cycle + noise
    const open = close - Math.sin(index / 5) * 130
    return {
      timestamp: baseTimestamp + index * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) + 220,
      low: Math.min(open, close) - 220,
      close,
      volume: 1_200 + Math.sin(index / 6) * 240,
    }
  })
}

function isCandle(value: unknown): value is Candle {
  const candle = value as Candle
  return Boolean(
    candle
    && Number.isFinite(candle.timestamp)
    && Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && Number.isFinite(candle.volume),
  )
}

function cleanSymbol(symbol: unknown): string {
  return typeof symbol === 'string' && symbol.trim() ? symbol.trim().toUpperCase() : 'BTCUSDT'
}

function cleanStrategyId(strategyId: unknown): string {
  return typeof strategyId === 'string' && strategyId.trim() ? strategyId.trim() : 'moving-average-trend'
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function sma(values: number[], period: number): number {
  if (values.length < period) return values.at(-1) ?? 0
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function returns(candles: Candle[]): number[] {
  return candles.slice(1).map((candle, index) => {
    const previous = candles[index].close
    return previous === 0 ? 0 : (candle.close - previous) / previous
  })
}

function volatilityScore(candles: Candle[], lookback = 24): number {
  return clamp(standardDeviation(returns(candles).slice(-lookback)) * 100)
}
