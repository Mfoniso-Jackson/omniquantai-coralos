import { describe, expect, it } from 'vitest'
import { parseLauncherSession } from './marketLauncher.js'

describe('parseLauncherSession', () => {
  it('parses the primary OmniQuantAI launcher line', () => {
    expect(parseLauncherSession(
      '✅ OmniQuantAI market session 394f18fe-842e-4243-8b84-8a1365b4a31c namespace omniquant',
      'fallback',
    )).toEqual({
      session: '394f18fe-842e-4243-8b84-8a1365b4a31c',
      namespace: 'omniquant',
    })
  })

  it('parses the fallback session id and namespace lines', () => {
    expect(parseLauncherSession(
      'session id: 17ef578a-f906-4053-aad1-093e2aa4128a\nnamespace: omniquant',
      'fallback',
    )).toEqual({
      session: '17ef578a-f906-4053-aad1-093e2aa4128a',
      namespace: 'omniquant',
    })
  })

  it('uses the fallback namespace when launcher output omits one', () => {
    expect(parseLauncherSession('market session abc123', 'omniquant')).toEqual({
      session: 'abc123',
      namespace: 'omniquant',
    })
  })

  it('returns null when no session id is present', () => {
    expect(parseLauncherSession('buyer and sellers are still starting', 'omniquant')).toBeNull()
  })
})
