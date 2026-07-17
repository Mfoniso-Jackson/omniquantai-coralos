import { createHmac } from 'node:crypto'

export interface SignedRequestInput {
  method: string
  path: string
  body?: string
  publisherId?: string
  secret?: string
  timestamp?: string
}

export function signedAuthHeaders(input: SignedRequestInput): Record<string, string> {
  if (!input.secret) return input.publisherId ? { 'x-oq-publisher': input.publisherId } : {}
  const timestamp = input.timestamp ?? new Date().toISOString()
  const publisher = input.publisherId ?? 'sdk'
  const payload = signingPayload(input.method, input.path, timestamp, input.body ?? '')
  const signature = createHmac('sha256', input.secret).update(payload).digest('hex')
  return {
    'x-oq-publisher': publisher,
    'x-oq-timestamp': timestamp,
    'x-oq-signature': signature,
  }
}

export function signingPayload(method: string, path: string, timestamp: string, body: string): string {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`
}
