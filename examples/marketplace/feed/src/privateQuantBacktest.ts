export type Signal = 'buy' | 'sell' | 'hold'

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Trade {
  id: string
  symbol: string
  side: Exclude<Signal, 'hold'>
  quantity: number
  entryPrice: number
  exitPrice?: number
  pnl?: number
  openedAt: number
  closedAt?: number
  strategy: string
}

export interface BacktestRequest {
  strategyId: string
  symbol: string
  timeframe?: string
  start?: string
  end?: string
  initialCapital?: number
  initialBalance?: number
  candles?: Candle[]
  parameters?: Record<string, unknown>
}

export interface BacktestResponse {
  id: string
  strategyId: string
  symbol: string
  timeframe?: string
  totalReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  trades: Trade[]
  equityCurve: Array<{ timestamp: number; equity: number }>
  engine: {
    provider: 'omniquant'
    model: string
    dataMode: 'provided_candles' | 'deterministic_demo'
  }
}

interface StrategyDecision {
  strategy: string
  signal: Signal
  confidence: number
  riskScore: number
  suggestedPositionSize: number
  stopLossPct: number
  explanation: string
}

interface RiskState {
  portfolioValue: number
  dailyPnlPct: number
  openPositions: number
  volatilityScore: number
}

interface RiskResult {
  approved: boolean
  reasons: string[]
  cappedPositionSize: number
}

export function runPrivateBacktest(input: BacktestRequest): BacktestResponse {
  const symbol = cleanSymbol(input.symbol)
  const strategyId = cleanStrategyId(input.strategyId)
  const normalized = normalizeCandles(input.candles)
  const candles = normalized.candles
  const initialBalance = positiveNumber(input.initialCapital ?? input.initialBalance, 100_000)
  const result = runBacktest({
    symbol,
    candles,
    initialBalance,
    strategyId,
  })
  return {
    id: `bt_${strategyId}_${symbol}_${candles[0]?.timestamp ?? 0}_${candles.at(-1)?.timestamp ?? 0}`,
    strategyId,
    symbol,
    timeframe: input.timeframe,
    ...result,
    engine: {
      provider: 'omniquant',
      model: 'deterministic-trend-following-v1',
      dataMode: normalized.dataMode,
    },
  }
}

function runBacktest(params: {
  symbol: string
  candles: Candle[]
  initialBalance: number
  strategyId: string
}): Omit<BacktestResponse, 'id' | 'strategyId' | 'symbol' | 'timeframe' | 'engine'> {
  let cash = params.initialBalance
  let position = 0
  let entryPrice = 0
  const trades: Trade[] = []
  const equityCurve: Array<{ timestamp: number; equity: number }> = []

  for (let index = 40; index < params.candles.length; index += 1) {
    const window = params.candles.slice(0, index + 1)
    const candle = params.candles[index]
    const equity = cash + position * candle.close
    const decision = trendFollowingDecision({
      symbol: params.symbol,
      candles: window,
      portfolioValue: equity,
    })
    const risk = evaluateRisk(decision, {
      portfolioValue: equity,
      dailyPnlPct: 0,
      openPositions: position === 0 ? 0 : 1,
      volatilityScore: decision.riskScore,
    })

    if (position === 0 && decision.signal === 'buy' && risk.approved) {
      const allocation = Math.min(risk.cappedPositionSize, cash * 0.25)
      position = allocation / candle.close
      cash -= allocation
      entryPrice = candle.close
      trades.push({
        id: `bt-${index}`,
        symbol: params.symbol,
        side: 'buy',
        quantity: position,
        entryPrice,
        openedAt: candle.timestamp,
        strategy: decision.strategy,
      })
    }

    if (position > 0 && (decision.signal === 'sell' || candle.close <= entryPrice * (1 - decision.stopLossPct))) {
      cash += position * candle.close
      const trade = trades.at(-1)
      if (trade && trade.closedAt === undefined) {
        trade.exitPrice = candle.close
        trade.closedAt = candle.timestamp
        trade.pnl = (candle.close - trade.entryPrice) * trade.quantity
      }
      position = 0
      entryPrice = 0
    }

    equityCurve.push({ timestamp: candle.timestamp, equity: cash + position * candle.close })
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? params.initialBalance
  const closedTrades = trades.filter((trade) => trade.pnl !== undefined)
  const wins = closedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length
  const equityReturns = returns(equityCurve.map((point) => ({
    timestamp: point.timestamp,
    open: point.equity,
    high: point.equity,
    low: point.equity,
    close: point.equity,
    volume: 0,
  })))
  const average = equityReturns.reduce((sum, value) => sum + value, 0) / (equityReturns.length || 1)
  const variance = equityReturns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (equityReturns.length || 1)
  const sharpeRatio = variance === 0 ? 0 : (average / Math.sqrt(variance)) * Math.sqrt(365)

  return {
    totalReturn: (finalEquity - params.initialBalance) / params.initialBalance,
    maxDrawdown: maxDrawdown(equityCurve.map((point) => point.equity)),
    sharpeRatio,
    winRate: closedTrades.length === 0 ? 0 : wins / closedTrades.length,
    trades,
    equityCurve,
  }
}

function trendFollowingDecision(context: { symbol: string; candles: Candle[]; portfolioValue: number }): StrategyDecision {
  const closes = context.candles.map((candle) => candle.close)
  if (closes.length < 36) {
    return {
      strategy: 'Trend Following',
      signal: 'hold',
      confidence: 0.35,
      riskScore: 0.25,
      suggestedPositionSize: 0,
      stopLossPct: 0.03,
      explanation: 'Insufficient candles for trend confirmation.',
    }
  }
  const fast = sma(closes, 12)
  const slow = sma(closes, 36)
  const spread = slow === 0 ? 0 : (fast - slow) / slow
  const confidence = clamp(Math.abs(spread) * 18)
  const signal = spread > 0.004 ? 'buy' : spread < -0.004 ? 'sell' : 'hold'
  return {
    strategy: 'Trend Following',
    signal,
    confidence,
    riskScore: volatilityScore(context.candles),
    suggestedPositionSize: signal === 'hold' ? 0 : context.portfolioValue * clamp(confidence * 0.08, 0.01, 0.08),
    stopLossPct: 0.035,
    explanation: `Fast average is ${spread >= 0 ? 'above' : 'below'} the slow average by ${(spread * 100).toFixed(2)}%.`,
  }
}

function evaluateRisk(decision: StrategyDecision, state: RiskState): RiskResult {
  const reasons: string[] = []
  const maxRiskPerTradePct = 0.01
  const maxDailyDrawdownPct = 0.03
  const maxOpenPositions = 4
  const maxVolatilityScore = 0.7
  const maxPositionRisk = state.portfolioValue * maxRiskPerTradePct
  const stopLossDistance = decision.stopLossPct || 0
  const positionRisk = decision.suggestedPositionSize * stopLossDistance

  if (decision.signal === 'hold') reasons.push('Decision is hold; no execution required.')
  if (stopLossDistance <= 0) reasons.push('Stop-loss is required.')
  if (positionRisk > maxPositionRisk) reasons.push('Suggested position exceeds max risk per trade.')
  if (Math.abs(state.dailyPnlPct) >= maxDailyDrawdownPct && state.dailyPnlPct < 0) reasons.push('Daily drawdown limit reached.')
  if (state.openPositions >= maxOpenPositions) reasons.push('Max open positions reached.')
  if (state.volatilityScore > maxVolatilityScore || decision.riskScore > maxVolatilityScore) reasons.push('Volatility/risk threshold exceeded.')

  return {
    approved: reasons.length === 0,
    reasons,
    cappedPositionSize: stopLossDistance > 0 ? Math.min(decision.suggestedPositionSize, maxPositionRisk / stopLossDistance) : 0,
  }
}

function normalizeCandles(candles: Candle[] | undefined): { candles: Candle[]; dataMode: BacktestResponse['engine']['dataMode'] } {
  const valid = (candles ?? []).filter(isCandle)
  return valid.length >= 60
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

function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0
  let worst = 0
  for (const value of equity) {
    peak = Math.max(peak, value)
    if (peak > 0) worst = Math.min(worst, (value - peak) / peak)
  }
  return Math.abs(worst)
}
