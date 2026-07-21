import { describe, expect, it } from 'vitest'
import { authenticatePrivateQuantRequest, privateQuantHealth, privateQuantModels, privateQuantNotImplemented, requestIdFrom } from './privateQuantApi.js'
import { runPrivateBacktest } from './privateQuantBacktest.js'
import { evaluatePrivateRisk } from './privateQuantRisk.js'
import { generatePrivateSignal } from './privateQuantSignals.js'
import { executePrivatePaperOrder, preparePrivateOrder } from './privateQuantOrders.js'

describe('private quant API boundary', () => {
  const originalApiKey = process.env.OMNIQUANT_API_KEY

  it('identifies the MassifX-facing private API as boundary-ready', () => {
    expect(privateQuantHealth()).toEqual({
      ok: true,
      service: 'omniquantai-private-api',
      version: 'v1',
      status: 'boundary-ready',
    })
  })

  it('starts with an empty model registry projection', () => {
    expect(privateQuantModels()).toEqual([])
  })

  it('enforces private API bearer auth only when configured', () => {
    process.env.OMNIQUANT_API_KEY = 'secret'

    expect(authenticatePrivateQuantRequest({
      headers: {
        authorization: 'Bearer secret',
      },
    } as never)).toEqual({ ok: true })
    expect(authenticatePrivateQuantRequest({
      headers: {
        authorization: 'Bearer wrong',
      },
    } as never)).toEqual({
      ok: false,
      message: 'Valid OMNIQUANT_API_KEY bearer token is required.',
    })

    restoreApiKey(originalApiKey)
    expect(authenticatePrivateQuantRequest({
      headers: {},
    } as never)).toEqual({ ok: true })
  })

  it('uses caller request ids when present', () => {
    expect(requestIdFrom({
      headers: {
        'x-request-id': 'req_test_123',
      },
    } as never)).toBe('req_test_123')
  })

  it('runs the first private backtest implementation with a stable response shape', () => {
    const result = runPrivateBacktest({
      strategyId: 'moving-average-trend',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      initialCapital: 100000,
    })

    expect(result).toMatchObject({
      strategyId: 'moving-average-trend',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      engine: {
        provider: 'omniquant',
        model: 'deterministic-trend-following-v1',
        dataMode: 'deterministic_demo',
      },
    })
    expect(result.id).toMatch(/^bt_moving-average-trend_BTCUSDT_/)
    expect(Number.isFinite(result.totalReturn)).toBe(true)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
    expect(result.equityCurve.length).toBeGreaterThan(50)
  })

  it('approves deterministic risk requests that satisfy all controls', () => {
    const result = evaluatePrivateRisk({
      portfolioId: 'demo',
      symbol: 'BTCUSDT',
      side: 'buy',
      notional: 5_000,
      leverage: 1,
      stopLoss: 0.03,
      marketDataTimestamp: new Date().toISOString(),
      state: {
        portfolioValue: 100_000,
        dailyPnlPct: -0.004,
        openPositions: 1,
        volatilityScore: 0.25,
      },
    })

    expect(result).toMatchObject({
      approved: true,
      reasons: [],
      maxPositionSize: 25_000,
      maxLeverage: 2,
      killSwitchActive: false,
      staleMarketData: false,
      engine: {
        provider: 'omniquant',
        model: 'deterministic-risk-controls-v1',
      },
    })
    expect(result.id).toMatch(/^risk_demo_BTCUSDT_/)
    expect(result.checks).toEqual({
      maxPositionSize: true,
      leverage: true,
      stopLoss: true,
      maxDrawdown: true,
      dailyLoss: true,
      staleData: true,
      killSwitch: true,
      volatility: true,
      openPositions: true,
    })
  })

  it('generates deterministic signals with a stable response shape', () => {
    const result = generatePrivateSignal({
      strategyId: 'moving-average-trend',
      symbol: 'BTCUSDT',
      portfolioValue: 100_000,
    })

    expect(result).toMatchObject({
      strategyId: 'moving-average-trend',
      symbol: 'BTCUSDT',
      side: expect.stringMatching(/BUY|SELL|HOLD/),
      engine: {
        provider: 'omniquant',
        model: 'deterministic-signal-engine-v1',
        dataMode: 'deterministic_demo',
      },
      decision: {
        strategy: 'Trend Following',
      },
    })
    expect(result.id).toMatch(/^sig_moving-average-trend_BTCUSDT_/)
    expect(Number.isFinite(result.confidence)).toBe(true)
    expect(Number.isFinite(result.decision.riskScore)).toBe(true)
  })

  it('prepares deterministic paper orders after risk approval', () => {
    const result = preparePrivateOrder({
      portfolioId: 'demo-paper',
      signalId: 'sig_1',
      riskApprovalId: 'risk_1',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.25,
      price: 70_000,
      riskApproved: true,
      mode: 'paper',
    })

    expect(result).toMatchObject({
      portfolioId: 'demo-paper',
      signalId: 'sig_1',
      riskApprovalId: 'risk_1',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.25,
      notional: 17_500,
      status: 'prepared',
      reasons: [],
      mode: 'paper',
      engine: {
        provider: 'omniquant',
        model: 'deterministic-paper-order-prep-v1',
      },
    })
    expect(result.id).toMatch(/^ord_demo-paper_BTCUSDT_/)
  })

  it('rejects deterministic paper orders when required controls are missing', () => {
    const result = preparePrivateOrder({
      portfolioId: 'demo-paper',
      symbol: 'BTCUSDT',
      side: 'hold',
      quantity: 0,
      riskApproved: false,
      riskReasons: ['Risk approval is required.'],
    })

    expect(result.status).toBe('rejected')
    expect(result.reasons).toEqual(expect.arrayContaining([
      'Executable buy or sell side is required.',
      'Quantity must be greater than zero.',
      'Prepared quantity must be greater than zero.',
      'Risk approval is required.',
    ]))
  })

  it('executes prepared paper orders with deterministic account updates', () => {
    const preparedOrder = preparePrivateOrder({
      portfolioId: 'demo-paper',
      signalId: 'sig_1',
      riskApprovalId: 'risk_1',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.25,
      price: 70_000,
      riskApproved: true,
      mode: 'paper',
    })
    const result = executePrivatePaperOrder({
      orderId: preparedOrder.id,
      mode: 'paper',
      account: {
        balance: 50_000,
        openPositions: [],
        trades: [],
      },
      preparedOrder,
      price: 70_000,
      strategy: 'Trend Following',
    })

    expect(result).toMatchObject({
      orderId: preparedOrder.id,
      mode: 'paper',
      status: 'filled',
      filledQuantity: 0.25,
      averagePrice: 70_000,
      message: 'Paper order executed.',
      reasons: [],
      account: {
        balance: 32_500,
      },
      engine: {
        provider: 'omniquant',
        model: 'deterministic-paper-execution-v1',
      },
    })
    expect(result.account.trades).toHaveLength(1)
    expect(result.account.trades[0]).toMatchObject({
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 0.25,
      entryPrice: 70_000,
      strategy: 'Trend Following',
    })
  })

  it('runs the full private quant workflow from backtest to paper execution', () => {
    const backtest = runPrivateBacktest({
      strategyId: 'moving-average-trend',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      initialCapital: 100_000,
    })
    const signal = generatePrivateSignal({
      strategyId: backtest.strategyId,
      symbol: backtest.symbol,
      portfolioValue: 100_000,
    })
    const risk = evaluatePrivateRisk({
      portfolioId: 'demo-paper',
      symbol: signal.symbol,
      side: signal.decision.signal === 'sell' ? 'sell' : 'buy',
      notional: signal.decision.suggestedPositionSize,
      leverage: 1,
      stopLoss: signal.decision.stopLossPct,
      marketDataTimestamp: new Date().toISOString(),
      decision: signal.decision,
      state: {
        portfolioValue: 100_000,
        dailyPnlPct: 0,
        openPositions: 0,
        volatilityScore: signal.decision.riskScore,
      },
    })
    const price = 70_000
    const quantity = Math.max(0.01, Math.min(risk.cappedPositionSize, 50_000) / price)
    const preparedOrder = preparePrivateOrder({
      portfolioId: 'demo-paper',
      signalId: signal.id,
      riskApprovalId: risk.id,
      symbol: signal.symbol,
      side: signal.decision.signal === 'sell' ? 'sell' : 'buy',
      type: 'market',
      quantity,
      price,
      riskApproved: risk.approved,
      riskReasons: risk.reasons,
      mode: 'paper',
    })
    const execution = executePrivatePaperOrder({
      orderId: preparedOrder.id,
      mode: 'paper',
      account: {
        balance: 50_000,
        openPositions: [],
        trades: [],
      },
      preparedOrder,
      price,
      strategy: signal.decision.strategy,
    })

    expect(backtest.engine.model).toBe('deterministic-trend-following-v1')
    expect(signal.engine.model).toBe('deterministic-signal-engine-v1')
    expect(risk.engine.model).toBe('deterministic-risk-controls-v1')
    expect(preparedOrder.status).toBe(risk.approved ? 'prepared' : 'rejected')
    expect(execution.status).toBe(risk.approved ? 'filled' : 'rejected')
    if (risk.approved) {
      expect(execution.account.trades).toHaveLength(1)
      expect(execution.account.balance).toBeLessThan(50_000)
    }
  })

  it('rejects paper execution when the account cannot fund the prepared order', () => {
    const preparedOrder = preparePrivateOrder({
      portfolioId: 'demo-paper',
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 1,
      price: 70_000,
      riskApproved: true,
      mode: 'paper',
    })
    const result = executePrivatePaperOrder({
      orderId: preparedOrder.id,
      mode: 'paper',
      account: {
        balance: 10_000,
        openPositions: [],
        trades: [],
      },
      preparedOrder,
      price: 70_000,
    })

    expect(result.status).toBe('rejected')
    expect(result.reasons).toEqual(['Paper account balance is insufficient.'])
    expect(result.account.balance).toBe(10_000)
  })

  it('rejects risk requests that breach deterministic controls', () => {
    const result = evaluatePrivateRisk({
      portfolioId: 'demo',
      symbol: 'BTCUSDT',
      side: 'buy',
      notional: 40_000,
      leverage: 4,
      marketDataTimestamp: '2020-01-01T00:00:00.000Z',
      killSwitchActive: true,
      state: {
        portfolioValue: 100_000,
        dailyPnlPct: -0.04,
        openPositions: 4,
        volatilityScore: 0.9,
        currentPositionNotional: 5_000,
        maxDrawdownPct: 0.1,
      },
    })

    expect(result.approved).toBe(false)
    expect(result.reasons).toEqual(expect.arrayContaining([
      'Kill switch is active.',
      'Market data is stale.',
      'Stop-loss is required.',
      'Requested notional exceeds max position size.',
      'Requested leverage exceeds max leverage.',
      'Daily loss limit reached.',
      'Maximum drawdown limit reached.',
      'Max open positions reached.',
      'Volatility/risk threshold exceeded.',
    ]))
    expect(result.checks.killSwitch).toBe(false)
    expect(result.checks.staleData).toBe(false)
    expect(result.checks.stopLoss).toBe(false)
  })

  it('returns explicit not-implemented errors for future live execution endpoints', () => {
    expect(privateQuantNotImplemented('execute live orders', '/v1/orders/live')).toEqual({
      error: {
        code: 'not_implemented',
        message: 'OmniQuantAI private API can execute live orders after the quant engine migration is implemented.',
        owner: 'OmniQuantAI',
        plannedEndpoint: '/v1/orders/live',
      },
    })
  })
})

function restoreApiKey(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.OMNIQUANT_API_KEY
  } else {
    process.env.OMNIQUANT_API_KEY = value
  }
}
