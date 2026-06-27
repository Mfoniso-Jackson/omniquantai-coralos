import { describe, it, expect } from 'vitest'
import { brokerQuote, upstreamBudget, deliveredPayload } from './broker.js'

describe('brokerQuote — quote the budget, but only with room for the margin', () => {
  it('quotes the full budget when there is room', () => {
    expect(brokerQuote(0.001, 0.0001)).toBe(0.001)
  })
  it('sits out (null) when the budget cannot cover the margin', () => {
    expect(brokerQuote(0.0001, 0.0001)).toBeNull() // equal → no spread
    expect(brokerQuote(0.00005, 0.0001)).toBeNull()
  })
})

describe('upstreamBudget — offer downstream price minus the kept spread', () => {
  it('subtracts the margin', () => {
    expect(upstreamBudget(0.001, 0.0001)).toBeCloseTo(0.0009, 9)
  })
  it('never goes negative', () => {
    expect(upstreamBudget(0.0001, 0.001)).toBe(0)
  })
})

describe('deliveredPayload — strip the DELIVERED envelope', () => {
  it('removes the round prefix and trims', () => {
    expect(deliveredPayload('DELIVERED round=7 {"coin":"solana"}')).toBe('{"coin":"solana"}')
  })
  it('is case-insensitive on the verb', () => {
    expect(deliveredPayload('delivered round=1 hello')).toBe('hello')
  })
  it('passes through text without an envelope', () => {
    expect(deliveredPayload('{"x":1}')).toBe('{"x":1}')
  })
})
