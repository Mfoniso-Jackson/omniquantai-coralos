import { describe, expect, it } from 'vitest'
import { signPayload, verifySignedRequest, type SignedRequestLike } from './signedRequest.js'

describe('signedRequest', () => {
  it('allows unsigned requests when no secret is configured', () => {
    expect(() => verifySignedRequest(request({}), undefined, 'workspace')).not.toThrow()
  })

  it('verifies a valid HMAC signature', () => {
    const secret = 'test-secret'
    const timestamp = new Date().toISOString()
    const body = JSON.stringify({ reviewStatus: 'Approved' })
    const signature = signPayload({ secret, method: 'PATCH', path: '/api/workspace/memos/session-1', timestamp, body })
    expect(() => verifySignedRequest(request({
      method: 'PATCH',
      path: '/api/workspace/memos/session-1',
      body,
      timestamp,
      signature,
    }), secret, 'workspace')).not.toThrow()
  })

  it('rejects missing or invalid signatures when a secret is configured', () => {
    const secret = 'test-secret'
    const timestamp = new Date().toISOString()
    expect(() => verifySignedRequest(request({ timestamp }), secret, 'workspace')).toThrow(/workspace auth headers/)
    expect(() => verifySignedRequest(request({ timestamp, signature: '00', body: '{}' }), secret, 'workspace')).toThrow(/workspace signature/)
  })
})

function request(input: {
  method?: string
  path?: string
  body?: string
  timestamp?: string
  signature?: string
  publisher?: string
}): SignedRequestLike {
  return {
    method: input.method ?? 'PATCH',
    path: input.path ?? '/api/workspace/memos/session-1',
    rawBody: input.body ?? '',
    header(name: string) {
      const headers: Record<string, string | undefined> = {
        'x-oq-publisher': input.publisher ?? (input.signature ? 'dashboard' : undefined),
        'x-oq-timestamp': input.timestamp,
        'x-oq-signature': input.signature,
      }
      return headers[name.toLowerCase()]
    },
  }
}
