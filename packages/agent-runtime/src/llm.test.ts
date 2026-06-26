import { describe, it, expect, afterEach } from 'vitest'
import { pickProvider, parseJsonReply } from './llm.js'

const env = { ...process.env }
afterEach(() => {
  process.env = { ...env }
})

describe('pickProvider', () => {
  it('explicit LLM_PROVIDER wins', () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.ANTHROPIC_API_KEY = 'x'
    expect(pickProvider()).toBe('openai')
  })

  it('auto-detects OpenAI when its key is present and no explicit provider', () => {
    delete process.env.LLM_PROVIDER
    process.env.OPENAI_API_KEY = 'x'
    expect(pickProvider()).toBe('openai')
  })

  it('defaults to anthropic', () => {
    delete process.env.LLM_PROVIDER
    delete process.env.OPENAI_API_KEY
    expect(pickProvider()).toBe('anthropic')
  })
})

describe('parseJsonReply', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonReply('{"bid":true,"price":0.0003}')).toEqual({ bid: true, price: 0.0003 })
  })

  it('parses JSON inside a ```json fence with prose around it', () => {
    const reply = 'Sure!\n```json\n{"bid":false,"reason":"too cheap"}\n```\nhope that helps'
    expect(parseJsonReply(reply)).toEqual({ bid: false, reason: 'too cheap' })
  })

  it('returns null when there is no JSON', () => {
    expect(parseJsonReply('no json here')).toBeNull()
  })
})
