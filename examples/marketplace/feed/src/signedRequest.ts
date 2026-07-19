import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SignedRequestLike {
  method: string
  path: string
  header(name: string): string | undefined
  rawBody?: string
}

export function verifySignedRequest(req: SignedRequestLike, secret: string | undefined, scope: string): void {
  if (!secret) return
  const publisher = req.header('x-oq-publisher')
  const timestamp = req.header('x-oq-timestamp')
  const signature = req.header('x-oq-signature')
  if (!publisher || !timestamp || !signature) throw new Error(`${scope} auth headers are required`)
  const driftMs = Math.abs(Date.now() - Date.parse(timestamp))
  if (!Number.isFinite(driftMs) || driftMs > 5 * 60_000) throw new Error(`${scope} auth timestamp is outside allowed window`)
  const expected = signPayload({
    secret,
    method: req.method,
    path: req.path,
    timestamp,
    body: req.rawBody ?? '',
  })
  if (!safeEqualHex(signature, expected)) throw new Error(`${scope} signature verification failed`)
}

export function signPayload(input: { secret: string; method: string; path: string; timestamp: string; body: string }): string {
  return createHmac('sha256', input.secret)
    .update(`${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.body}`)
    .digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
