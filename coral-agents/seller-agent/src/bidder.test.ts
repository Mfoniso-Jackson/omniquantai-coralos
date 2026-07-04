import { describe, it, expect } from 'vitest'
import { decideBid, type SellerConfig } from './bidder.js'
import type { Want } from '@pay/agent-runtime'

const cfg: SellerConfig = {
  name: 'seller-x',
  services: ['helius-risk'],
  floorSol: 0.0004,
  persona: 'test',
  relevance: 80,
  expectedQuality: 80,
  confidence: 76,
  domainFit: 80,
  speedSeconds: 20,
  explanationQuality: 80,
}
const want: Want = { round: 1, service: 'helius-risk', arg: '7jw', budgetSol: 0.001 }
const llmSays = (json: string) => async () => json

describe('decideBid - code-enforced economics', () => {
  it('refuses a service not in inventory (no LLM call)', async () => {
    const d = await decideBid({ ...want, service: 'jupiter' }, cfg, async () => { throw new Error('should not call') })
    expect(d.bid).toBe(false)
  })

  it('sits out when the floor exceeds the budget', async () => {
    const d = await decideBid({ ...want, budgetSol: 0.0001 }, cfg, async () => { throw new Error('should not call') })
    expect(d.bid).toBe(false)
  })

  it('clamps an under-floor LLM price up to the floor', async () => {
    const d = await decideBid(want, cfg, llmSays('{"bid":true,"price":0.0001,"note":"cheap"}'))
    expect(d.priceSol).toBe(0.0004) // floor
  })

  it('clamps an over-budget LLM price down to the budget', async () => {
    const d = await decideBid(want, cfg, llmSays('{"bid":true,"price":0.005,"note":"premium"}'))
    expect(d.priceSol).toBe(0.001) // budget
  })

  it('honours an LLM decline', async () => {
    const d = await decideBid(want, cfg, llmSays('{"bid":false,"note":"too cheap for me"}'))
    expect(d.bid).toBe(false)
  })

  it('falls back to a floor bid when the LLM errors', async () => {
    const d = await decideBid(want, cfg, async () => { throw new Error('llm down') })
    expect(d).toMatchObject({ bid: true, priceSol: 0.0004 })
  })
})
