import { randomUUID } from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'
import { persistStartMarketJob } from './data/jobStore.js'

export interface StartMarketJob {
  id: string
  type: 'start_market'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'dead_lettered'
  namespace: string
  request: Record<string, unknown>
  createdAt: string
  updatedAt: string
  attempts: number
  maxAttempts: number
  idempotencyKey?: string
  organizationId?: string
  assignedBy?: string
  retryAt?: string
  deadLetteredAt?: string
  session?: string
  error?: string
}

const QUEUE = process.env.START_MARKET_QUEUE ?? 'omniquant:start_market'
const DEAD_LETTER_QUEUE = process.env.START_MARKET_DEAD_LETTER_QUEUE ?? 'omniquant:start_market:dead-letter'
const JOB_PREFIX = process.env.START_MARKET_JOB_PREFIX ?? 'omniquant:market-job'
const IDEMPOTENCY_PREFIX = process.env.START_MARKET_IDEMPOTENCY_PREFIX ?? 'omniquant:market-idempotency'
const DEFAULT_MAX_ATTEMPTS = Number(process.env.START_MARKET_MAX_ATTEMPTS ?? process.env.JOB_ATTEMPTS ?? 3)

export function redisAvailable(): boolean {
  return Boolean(process.env.REDIS_URL)
}

export async function enqueueStartMarketJob(input: {
  namespace: string
  request: Record<string, unknown>
  idempotencyKey?: string
  organizationId?: string
  assignedBy?: string
}): Promise<{ job: StartMarketJob; existing: boolean }> {
  if (input.idempotencyKey) {
    const existingId = await getJobIdForIdempotencyKey(input.idempotencyKey)
    if (existingId) {
      const existing = await getJob(existingId)
      if (existing) return { job: existing, existing: true }
    }
  }
  const now = new Date().toISOString()
  const job: StartMarketJob = {
    id: randomUUID(),
    type: 'start_market',
    status: 'queued',
    namespace: input.namespace,
    request: input.request,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    maxAttempts: Number.isFinite(DEFAULT_MAX_ATTEMPTS) && DEFAULT_MAX_ATTEMPTS > 0 ? DEFAULT_MAX_ATTEMPTS : 3,
    idempotencyKey: input.idempotencyKey,
    organizationId: input.organizationId,
    assignedBy: input.assignedBy,
  }
  if (input.idempotencyKey) await setIdempotencyKey(input.idempotencyKey, job.id)
  await setJob(job)
  await pushJob(QUEUE, job)
  return { job, existing: false }
}

export async function reserveStartMarketJob(timeoutSeconds = 5): Promise<StartMarketJob | undefined> {
  const result = await redisCommand(['BRPOP', QUEUE, String(timeoutSeconds)], { timeoutMs: (timeoutSeconds + 5) * 1000 })
  if (!Array.isArray(result) || typeof result[1] !== 'string') return undefined
  return JSON.parse(result[1]) as StartMarketJob
}

export async function requeueStartMarketJob(job: StartMarketJob): Promise<void> {
  await setJob(job)
  await pushJob(QUEUE, job)
}

export async function deadLetterStartMarketJob(job: StartMarketJob): Promise<void> {
  const dead = {
    ...job,
    status: 'dead_lettered' as const,
    deadLetteredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await setJob(dead)
  await pushJob(DEAD_LETTER_QUEUE, dead)
}

export async function setJob(job: StartMarketJob): Promise<void> {
  await redisCommand([
    'HSET',
    jobKey(job.id),
    'payload',
    JSON.stringify(job),
    'status',
    job.status,
    'updatedAt',
    job.updatedAt,
  ])
  await persistStartMarketJob(job)
}

export async function getJob(id: string): Promise<StartMarketJob | undefined> {
  const result = await redisCommand(['HGET', jobKey(id), 'payload'])
  return typeof result === 'string' ? JSON.parse(result) as StartMarketJob : undefined
}

export function jobKey(id: string): string {
  return `${JOB_PREFIX}:${id}`
}

export function idempotencyKey(key: string): string {
  return `${IDEMPOTENCY_PREFIX}:${key}`
}

async function getJobIdForIdempotencyKey(key: string): Promise<string | undefined> {
  const result = await redisCommand(['GET', idempotencyKey(key)])
  return typeof result === 'string' ? result : undefined
}

async function setIdempotencyKey(key: string, jobId: string): Promise<void> {
  await redisCommand(['SET', idempotencyKey(key), jobId])
}

async function pushJob(queue: string, job: StartMarketJob): Promise<void> {
  await redisCommand(['LPUSH', queue, JSON.stringify(job)])
}

export async function redisCommand(args: string[], options: { timeoutMs?: number } = {}): Promise<unknown> {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL is required for Redis queue operations')
  const parsed = new URL(url)
  const secure = parsed.protocol === 'rediss:'
  const port = Number(parsed.port || (secure ? 6380 : 6379))
  const host = parsed.hostname
  const password = decodeURIComponent(parsed.password)
  const username = decodeURIComponent(parsed.username)
  const db = parsed.pathname.replace('/', '')
  const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port })
  const timeout = setTimeout(() => socket.destroy(new Error('redis command timed out')), options.timeoutMs ?? 5000)
  try {
    await onceConnect(socket, secure)
    if (password) {
      await writeCommand(socket, username ? ['AUTH', username, password] : ['AUTH', password])
    }
    if (db) await writeCommand(socket, ['SELECT', db])
    return await writeCommand(socket, args)
  } finally {
    clearTimeout(timeout)
    socket.end()
  }
}

function onceConnect(socket: net.Socket, secure: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once(secure ? 'secureConnect' : 'connect', resolve)
    socket.once('error', reject)
  })
}

function writeCommand(socket: net.Socket, args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const onData = (chunk: Buffer) => {
      chunks.push(chunk)
      try {
        const parsed = parseResp(Buffer.concat(chunks))
        cleanup()
        resolve(parsed.value)
      } catch (error) {
        if ((error as Error).message !== 'RESP_INCOMPLETE') {
          cleanup()
          reject(error)
        }
      }
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
    }
    socket.on('data', onData)
    socket.on('error', onError)
    socket.write(encodeResp(args))
  })
}

function encodeResp(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`
}

function parseResp(buffer: Buffer, offset = 0): { value: unknown; offset: number } {
  if (offset >= buffer.length) throw new Error('RESP_INCOMPLETE')
  const prefix = String.fromCharCode(buffer[offset])
  const lineEnd = buffer.indexOf('\r\n', offset)
  if (lineEnd === -1) throw new Error('RESP_INCOMPLETE')
  const line = buffer.toString('utf8', offset + 1, lineEnd)
  const next = lineEnd + 2
  if (prefix === '+') return { value: line, offset: next }
  if (prefix === '-') throw new Error(`redis error: ${line}`)
  if (prefix === ':') return { value: Number(line), offset: next }
  if (prefix === '$') {
    const length = Number(line)
    if (length === -1) return { value: undefined, offset: next }
    const end = next + length
    if (buffer.length < end + 2) throw new Error('RESP_INCOMPLETE')
    return { value: buffer.toString('utf8', next, end), offset: end + 2 }
  }
  if (prefix === '*') {
    const count = Number(line)
    if (count === -1) return { value: undefined, offset: next }
    const values: unknown[] = []
    let cursor = next
    for (let i = 0; i < count; i += 1) {
      const parsed = parseResp(buffer, cursor)
      values.push(parsed.value)
      cursor = parsed.offset
    }
    return { value: values, offset: cursor }
  }
  throw new Error(`Unsupported RESP prefix: ${prefix}`)
}
