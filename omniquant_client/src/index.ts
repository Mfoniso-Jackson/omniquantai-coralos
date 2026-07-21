export type SignalSide = 'BUY' | 'SELL' | 'HOLD'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'

export interface OmniQuantClientOptions {
  baseUrl: string
  apiKey?: string
  fetchImpl?: typeof fetch
}

export interface HealthResponse {
  ok: boolean
  service?: string
  version?: string
  status?: string
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

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface BacktestResponse {
  id: string
  strategyId: string
  symbol: string
  timeframe?: string
  totalReturn: number
  maxDrawdown: number
  sharpeRatio?: number
  winRate?: number
  trades: unknown[]
  equityCurve: unknown[]
  engine?: {
    provider: 'omniquant'
    model?: string
    dataMode?: 'provided_candles' | 'deterministic_demo'
  }
}

export interface SignalRequest {
  strategyId?: string
  symbol?: string
  timeframe?: string
  candles?: Candle[]
  portfolioValue?: number
  marketDataRef?: string
  parameters?: Record<string, unknown>
}

export interface SignalResponse {
  id: string
  strategyId: string
  symbol: string
  side: SignalSide
  confidence: number
  rationale?: string
  createdAt: string
  decision?: {
    strategy: string
    signal: 'buy' | 'sell' | 'hold'
    confidence: number
    riskScore: number
    suggestedPositionSize: number
    stopLossPct: number
    explanation: string
  }
  engine?: {
    provider: 'omniquant'
    model?: string
    dataMode?: 'provided_candles' | 'deterministic_demo'
  }
}

export interface RiskRequest {
  portfolioId?: string
  symbol?: string
  side?: OrderSide
  notional?: number
  leverage?: number
  stopLoss?: number
  marketDataTimestamp?: string
  killSwitchActive?: boolean
  decision?: {
    signal?: 'buy' | 'sell' | 'hold'
    suggestedPositionSize?: number
    stopLossPct?: number
    riskScore?: number
  }
  state?: {
    portfolioValue?: number
    dailyPnlPct?: number
    openPositions?: number
    volatilityScore?: number
    currentPositionNotional?: number
    maxDrawdownPct?: number
  }
  limits?: {
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
}

export interface RiskResponse {
  id?: string
  approved: boolean
  reasons: string[]
  maxPositionSize?: number
  maxLeverage?: number
  cappedPositionSize?: number
  killSwitchActive?: boolean
  staleMarketData?: boolean
  checks?: {
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
  engine?: {
    provider: 'omniquant'
    model?: string
    evaluatedAt?: string
  }
}

export interface PrepareOrderRequest {
  portfolioId?: string
  signalId?: string
  riskApprovalId?: string
  symbol?: string
  side?: OrderSide | 'hold'
  type?: OrderType
  quantity?: number
  limitPrice?: number
  price?: number
  maxQuantity?: number
  riskApproved?: boolean
  riskReasons?: string[]
  mode?: 'paper'
}

export interface PreparedOrderResponse {
  id: string
  portfolioId: string
  signalId?: string
  riskApprovalId?: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  limitPrice?: number
  notional?: number
  status: 'prepared' | 'rejected'
  reasons: string[]
  mode?: 'paper'
  createdAt?: string
  engine?: {
    provider: 'omniquant'
    model?: string
  }
}

export interface ExecuteOrderRequest {
  orderId?: string
  mode: 'paper'
  account?: {
    balance?: number
    openPositions?: unknown[]
    trades?: unknown[]
  }
  preparedOrder?: PreparedOrderResponse
  price?: number
  strategy?: string
}

export interface ExecutionResponse {
  id: string
  orderId: string
  mode: 'paper'
  status: 'filled' | 'rejected'
  filledQuantity?: number
  averagePrice?: number
  message?: string
  reasons?: string[]
  account?: {
    balance: number
    openPositions: unknown[]
    trades: unknown[]
  }
  createdAt: string
  engine?: {
    provider: 'omniquant'
    model?: string
  }
}

export interface ModelSummary {
  id: string
  name: string
  version: string
  status: 'active' | 'deprecated' | 'experimental'
}

export class OmniQuantClient {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(options: OmniQuantClientOptions) {
    if (!options.baseUrl.trim()) throw new Error('OmniQuantClient baseUrl is required')
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/v1/health')
  }

  runBacktest(input: BacktestRequest): Promise<BacktestResponse> {
    return this.request<BacktestResponse>('POST', '/v1/backtests', input)
  }

  generateSignal(input: SignalRequest): Promise<SignalResponse> {
    return this.request<SignalResponse>('POST', '/v1/signals/generate', input)
  }

  evaluateRisk(input: RiskRequest): Promise<RiskResponse> {
    return this.request<RiskResponse>('POST', '/v1/risk/evaluate', input)
  }

  prepareOrder(input: PrepareOrderRequest): Promise<PreparedOrderResponse> {
    return this.request<PreparedOrderResponse>('POST', '/v1/orders/prepare', input)
  }

  executePaperOrder(input: ExecuteOrderRequest): Promise<ExecutionResponse> {
    if (input.mode !== 'paper') throw new Error('Only paper execution is supported by this client slice')
    return this.request<ExecutionResponse>('POST', '/v1/orders/execute', input)
  }

  async listModels(): Promise<ModelSummary[]> {
    const body = await this.request<{ models?: ModelSummary[] }>('GET', '/v1/models')
    return body.models ?? []
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(payload),
      body: payload,
    })
    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`OmniQuantAI ${method} ${path} failed: ${response.status}${message ? ` ${message}` : ''}`)
    }
    return await response.json() as T
  }

  private headers(payload?: string): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': createRequestId(),
    }
    if (payload !== undefined) headers['content-type'] = 'application/json'
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`
    return headers
  }
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
