export type OrderSide = 'buy' | 'sell'
export type Signal = OrderSide | 'hold'

export interface RiskDecision {
  signal?: Signal
  suggestedPositionSize?: number
  stopLossPct?: number
  riskScore?: number
}

export interface RiskState {
  portfolioValue?: number
  dailyPnlPct?: number
  openPositions?: number
  volatilityScore?: number
  currentPositionNotional?: number
  maxDrawdownPct?: number
}

export interface RiskLimits {
  maxRiskPerTradePct?: number
  maxPositionPct?: number
  maxLeverage?: number
  maxDailyLossPct?: number
  maxDrawdownPct?: number
  maxOpenPositions?: number
  maxVolatilityScore?: number
  maxMarketDataAgeMs?: number
  requireStopLoss?: boolean
}

export interface RiskEvaluateRequest {
  portfolioId?: string
  symbol?: string
  side?: OrderSide
  notional?: number
  leverage?: number
  stopLoss?: number
  marketDataTimestamp?: string
  killSwitchActive?: boolean
  decision?: RiskDecision
  state?: RiskState
  limits?: RiskLimits
}

export interface RiskEvaluateResponse {
  id: string
  approved: boolean
  reasons: string[]
  maxPositionSize: number
  maxLeverage: number
  cappedPositionSize: number
  killSwitchActive: boolean
  staleMarketData: boolean
  checks: {
    maxPositionSize: boolean
    leverage: boolean
    stopLoss: boolean
    maxDrawdown: boolean
    dailyLoss: boolean
    staleData: boolean
    killSwitch: boolean
    volatility: boolean
    openPositions: boolean
  }
  engine: {
    provider: 'omniquant'
    model: 'deterministic-risk-controls-v1'
    evaluatedAt: string
  }
}

const DEFAULT_LIMITS: Required<RiskLimits> = {
  maxRiskPerTradePct: 0.01,
  maxPositionPct: 0.25,
  maxLeverage: 2,
  maxDailyLossPct: 0.03,
  maxDrawdownPct: 0.08,
  maxOpenPositions: 4,
  maxVolatilityScore: 0.7,
  maxMarketDataAgeMs: 15 * 60 * 1000,
  requireStopLoss: true,
}

export function evaluatePrivateRisk(input: RiskEvaluateRequest): RiskEvaluateResponse {
  const now = Date.now()
  const limits = normalizeLimits(input.limits)
  const state = input.state ?? {}
  const decision = input.decision ?? {}
  const portfolioValue = positiveNumber(state.portfolioValue, 100_000)
  const requestedNotional = positiveNumber(input.notional ?? decision.suggestedPositionSize, 0)
  const stopLossDistance = positiveNumber(input.stopLoss ?? decision.stopLossPct, 0)
  const leverage = positiveNumber(input.leverage, 1)
  const dailyPnlPct = numberOr(state.dailyPnlPct, 0)
  const drawdownPct = Math.abs(numberOr(state.maxDrawdownPct, 0))
  const volatilityScore = Math.max(numberOr(state.volatilityScore, 0), numberOr(decision.riskScore, 0))
  const currentPositionNotional = positiveNumber(state.currentPositionNotional, 0)
  const maxPositionSize = portfolioValue * limits.maxPositionPct
  const maxRiskPerTrade = portfolioValue * limits.maxRiskPerTradePct
  const cappedByRisk = stopLossDistance > 0 ? maxRiskPerTrade / stopLossDistance : 0
  const cappedPositionSize = Math.max(0, Math.min(requestedNotional || maxPositionSize, maxPositionSize, cappedByRisk || maxPositionSize))
  const staleMarketData = isStale(input.marketDataTimestamp, now, limits.maxMarketDataAgeMs)
  const killSwitchActive = Boolean(input.killSwitchActive)
  const reasons: string[] = []
  const checks = {
    maxPositionSize: true,
    leverage: true,
    stopLoss: true,
    maxDrawdown: true,
    dailyLoss: true,
    staleData: true,
    killSwitch: true,
    volatility: true,
    openPositions: true,
  }

  if (killSwitchActive) fail('killSwitch', 'Kill switch is active.')
  if (staleMarketData) fail('staleData', 'Market data is stale.')
  if (decision.signal === 'hold') reasons.push('Decision is hold; no execution required.')
  if (limits.requireStopLoss && stopLossDistance <= 0) fail('stopLoss', 'Stop-loss is required.')
  if (requestedNotional > 0 && currentPositionNotional + requestedNotional > maxPositionSize) {
    fail('maxPositionSize', 'Requested notional exceeds max position size.')
  }
  if (leverage > limits.maxLeverage) fail('leverage', 'Requested leverage exceeds max leverage.')
  if (dailyPnlPct <= -limits.maxDailyLossPct) fail('dailyLoss', 'Daily loss limit reached.')
  if (drawdownPct >= limits.maxDrawdownPct) fail('maxDrawdown', 'Maximum drawdown limit reached.')
  if (positiveNumber(state.openPositions, 0) >= limits.maxOpenPositions) fail('openPositions', 'Max open positions reached.')
  if (volatilityScore > limits.maxVolatilityScore) fail('volatility', 'Volatility/risk threshold exceeded.')

  return {
    id: `risk_${clean(input.portfolioId, 'portfolio')}_${clean(input.symbol, 'SYMBOL')}_${now}`,
    approved: reasons.length === 0,
    reasons,
    maxPositionSize,
    maxLeverage: limits.maxLeverage,
    cappedPositionSize,
    killSwitchActive,
    staleMarketData,
    checks,
    engine: {
      provider: 'omniquant',
      model: 'deterministic-risk-controls-v1',
      evaluatedAt: new Date(now).toISOString(),
    },
  }

  function fail(key: keyof RiskEvaluateResponse['checks'], reason: string): void {
    checks[key] = false
    reasons.push(reason)
  }
}

function normalizeLimits(limits: RiskLimits | undefined): Required<RiskLimits> {
  return {
    maxRiskPerTradePct: positiveNumber(limits?.maxRiskPerTradePct, DEFAULT_LIMITS.maxRiskPerTradePct),
    maxPositionPct: positiveNumber(limits?.maxPositionPct, DEFAULT_LIMITS.maxPositionPct),
    maxLeverage: positiveNumber(limits?.maxLeverage, DEFAULT_LIMITS.maxLeverage),
    maxDailyLossPct: positiveNumber(limits?.maxDailyLossPct, DEFAULT_LIMITS.maxDailyLossPct),
    maxDrawdownPct: positiveNumber(limits?.maxDrawdownPct, DEFAULT_LIMITS.maxDrawdownPct),
    maxOpenPositions: positiveNumber(limits?.maxOpenPositions, DEFAULT_LIMITS.maxOpenPositions),
    maxVolatilityScore: positiveNumber(limits?.maxVolatilityScore, DEFAULT_LIMITS.maxVolatilityScore),
    maxMarketDataAgeMs: positiveNumber(limits?.maxMarketDataAgeMs, DEFAULT_LIMITS.maxMarketDataAgeMs),
    requireStopLoss: limits?.requireStopLoss ?? DEFAULT_LIMITS.requireStopLoss,
  }
}

function isStale(timestamp: string | undefined, now: number, maxAgeMs: number): boolean {
  if (!timestamp) return false
  const parsed = Date.parse(timestamp)
  return !Number.isFinite(parsed) || now - parsed > maxAgeMs
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clean(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/[^a-zA-Z0-9_-]/g, '') : fallback
}
