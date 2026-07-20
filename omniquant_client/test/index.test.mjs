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
        trades: [],
        equityCurve: [],
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
  assert.equal(calls[0]?.url, 'https://omniquant.internal/v1/backtests')
  assert.equal(calls[0]?.init.method, 'POST')
  assert.match(String(calls[0]?.init.body), /"strategyId":"trend"/)
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
