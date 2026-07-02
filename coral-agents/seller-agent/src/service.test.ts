import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverService } from './service.js'

describe('deliverService routing', () => {
  const realFetch = global.fetch

  beforeEach(() => {
    process.env.TXLINE_API_KEY = 'token'
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.VENICE_API_KEY
    delete process.env.LLM_PROVIDER
  })

  afterEach(() => {
    global.fetch = realFetch
    delete process.env.AGENT_NAME
    delete process.env.PERSONA
    delete process.env.CONFIDENCE
    vi.restoreAllMocks()
  })

  it('rejects unsupported generic services', async () => {
    const out = JSON.parse(await deliverService('coingecko eth'))
    expect(out).toEqual({ error: 'unsupported service', service: 'coingecko', supported: ['omniquant', 'txline'] })
  })

  it('returns a financial intelligence report for omniquant', async () => {
    process.env.AGENT_NAME = 'portfolio-risk'
    process.env.PERSONA = 'Portfolio Risk Agent'
    process.env.CONFIDENCE = '84'
    const out = JSON.parse(await deliverService('omniquant nvda-6m-exposure'))
    expect(out).toMatchObject({
      service: 'omniquant-financial-intelligence',
      agent_name: 'portfolio-risk',
      confidence_score: 84,
      final_synthesis: { recommendation: 'HOLD' },
    })
    expect(out.risks).toContain('25-40% drawdown scenario')
  })

  it('returns fixtures from TxLINE', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      return { ok: true, json: async () => ([{ FixtureId: 1 }, { FixtureId: 2 }]) }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline fixtures'))
    expect(out).toMatchObject({ service: 'txline-fixtures', count: 2 })
  })

  it('produces a deterministic edge when no live LLM key is configured', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/guest/start')) return { ok: true, json: async () => ({ token: 'jwt' }) }
      if (url.includes('/api/odds/snapshot/123')) {
        return {
          ok: true,
          json: async () => ([{
            SuperOddsType: '1X2',
            PriceNames: ['part1', 'x', 'part2'],
            Pct: ['62', '22', '16'],
          }]),
        }
      }
      return {
        ok: true,
        json: async () => ([{
          FixtureId: 123,
          Participant1: 'A',
          Participant2: 'B',
          Competition: 'World Cup',
        }]),
      }
    }) as unknown as typeof fetch

    const out = JSON.parse(await deliverService('txline edge 123'))
    expect(out.analysis.call).toContain('A')
    expect(out.analysis.note).toContain('deterministic fallback')
  })
})
