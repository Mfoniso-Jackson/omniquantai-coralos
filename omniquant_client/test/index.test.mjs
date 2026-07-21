import test from 'node:test'
import assert from 'node:assert/strict'
import { OmniQuantClient } from '../dist/index.js'

test('calls the private health endpoint', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal/',
    apiKey: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({ ok: true, service: 'omniquantai' })
    },
  })

  const health = await client.health()

  assert.equal(health.ok, true)
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/health')
  assert.equal(calls[0]?.init.headers.authorization, 'Bearer secret')
})

test('runs a backtest through the versioned API boundary', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({
        id: 'bt_1',
        strategyId: 'trend',
        symbol: 'BTCUSDT',
        totalReturn: 0.12,
      maxDrawdown: 0.04,
      winRate: 0.5,
      trades: [],
      equityCurve: [],
      engine: {
        provider: 'omniquant',
        model: 'deterministic-trend-following-v1',
        dataMode: 'deterministic_demo',
      },
    })
    },
  })

  const result = await client.runBacktest({
    strategyId: 'trend',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    start: '2026-01-01',
    end: '2026-02-01',
    initialCapital: 100000,
  })

  assert.equal(result.id, 'bt_1')
  assert.equal(result.engine.provider, 'omniquant')
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/backtests')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"strategyId":"trend"/)
})

test('evaluates deterministic risk through the versioned API boundary', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({
        id: 'risk_demo_BTCUSDT_1',
        approved: false,
        reasons: ['Requested leverage exceeds max leverage.'],
        maxPositionSize: 25000,
        maxLeverage: 2,
        cappedPositionSize: 10000,
        killSwitchActive: false,
        staleMarketData: false,
        checks: {
          maxPositionSize: true,
          leverage: false,
          stopLoss: true,
          maxDrawdown: true,
          dailyLoss: true,
          staleData: true,
          killSwitch: true,
          volatility: true,
          openPositions: true,
        },
        engine: {
          provider: 'omniquant',
          model: 'deterministic-risk-controls-v1',
          evaluatedAt: '2026-01-01T00:00:00.000Z',
        },
      })
    },
  })

  const result = await client.evaluateRisk({
    portfolioId: 'demo',
    symbol: 'BTCUSDT',
    side: 'buy',
    notional: 10000,
    leverage: 3,
    stopLoss: 0.03,
    marketDataTimestamp: '2026-01-01T00:00:00.000Z',
  })

  assert.equal(result.approved, false)
  assert.equal(result.engine.provider, 'omniquant')
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/risk/evaluate')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"leverage":3/)
})

test('generates signals through the versioned API boundary', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({
        id: 'sig_trend_BTCUSDT_1',
        strategyId: 'trend',
        symbol: 'BTCUSDT',
        side: 'BUY',
        confidence: 0.67,
        rationale: 'Fast average is above the slow average.',
        createdAt: '2026-01-01T00:00:00.000Z',
        decision: {
          strategy: 'Trend Following',
          signal: 'buy',
          confidence: 0.67,
          riskScore: 0.25,
          suggestedPositionSize: 5000,
          stopLossPct: 0.035,
          explanation: 'Fast average is above the slow average.',
        },
        engine: {
          provider: 'omniquant',
          model: 'deterministic-signal-engine-v1',
          dataMode: 'deterministic_demo',
        },
      })
    },
  })

  const result = await client.generateSignal({
    strategyId: 'trend',
    symbol: 'BTCUSDT',
    portfolioValue: 100000,
  })

  assert.equal(result.side, 'BUY')
  assert.equal(result.engine.provider, 'omniquant')
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/signals/generate')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"strategyId":"trend"/)
})

test('prepares paper orders through the versioned API boundary', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({
        id: 'ord_demo_BTCUSDT_1',
        portfolioId: 'demo',
        signalId: 'sig_1',
        riskApprovalId: 'risk_1',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.25,
        notional: 17500,
        status: 'prepared',
        reasons: [],
        mode: 'paper',
        createdAt: '2026-01-01T00:00:00.000Z',
        engine: {
          provider: 'omniquant',
          model: 'deterministic-paper-order-prep-v1',
        },
      })
    },
  })

  const result = await client.prepareOrder({
    portfolioId: 'demo',
    signalId: 'sig_1',
    riskApprovalId: 'risk_1',
    symbol: 'BTCUSDT',
    side: 'buy',
    type: 'market',
    quantity: 0.25,
    price: 70000,
    riskApproved: true,
    mode: 'paper',
  })

  assert.equal(result.status, 'prepared')
  assert.equal(result.engine.provider, 'omniquant')
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/orders/prepare')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"riskApproved":true/)
})

test('executes paper orders through the versioned API boundary', async () => {
  const calls = []
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return jsonResponse({
        id: 'exec_ord_demo_BTCUSDT_1',
        orderId: 'ord_demo_BTCUSDT_1',
        mode: 'paper',
        status: 'filled',
        filledQuantity: 0.25,
        averagePrice: 70000,
        message: 'Paper order executed.',
        reasons: [],
        account: {
          balance: 32500,
          openPositions: [],
          trades: [],
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        engine: {
          provider: 'omniquant',
          model: 'deterministic-paper-execution-v1',
        },
      })
    },
  })

  const result = await client.executePaperOrder({
    orderId: 'ord_demo_BTCUSDT_1',
    mode: 'paper',
    account: {
      balance: 50000,
      openPositions: [],
      trades: [],
    },
    preparedOrder: {
      id: 'ord_demo_BTCUSDT_1',
      portfolioId: 'demo',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'market',
      quantity: 0.25,
      status: 'prepared',
      reasons: [],
    },
    price: 70000,
    strategy: 'Trend Following',
  })

  assert.equal(result.status, 'filled')
  assert.equal(result.engine.provider, 'omniquant')
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/orders/execute')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"mode":"paper"/)
})

test('prevents live order execution in the initial MassifX client slice', async () => {
  const client = new OmniQuantClient({
    baseUrl: 'https://omniquant.internal',
    fetchImpl: async () => jsonResponse({}),
  })

  assert.throws(
    () => client.executePaperOrder({ orderId: 'ord_1', mode: 'live' }),
    /Only paper execution is supported/,
  )
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
