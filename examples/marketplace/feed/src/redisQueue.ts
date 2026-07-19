import { randomUUID } from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'

export interface StartMarketJob {
  id: string
  type: 'start_market'
  status: 'queued' | 'running' | 'completed' | 'failed'
  namespace: string
  request: Record<string, unknown>
  createdAt: string
  updatedAt: string
  session?: string
  error?: string
}

const QUEUE = process.env.START_MARKET_QUEUE ?? 'omniquant:start_market'
const JOB_PREFIX = process.env.START_MARKET_JOB_PREFIX ?? 'omniquant:market-job'

export function redisAvailable(): boolean {
  return Boolean(process.env.REDIS_URL)
}

export async function enqueueStartMarketJob(input: { namespace: string; request: Record<string, unknown> }): Promise<StartMarketJob> {
  const now = new Date().toISOString()
  const job: StartMarketJob = {
    id: randomUUID(),
    type: 'start_market',
    status: 'queued',
    namespace: input.namespace,
    request: input.request,
    createdAt: now,
    updatedAt: now,
  }
  await setJob(job)
  await redisCommand(['LPUSH', QUEUE, JSON.stringify(job)])
  return job
}

export async function reserveStartMarketJob(timeoutSeconds = 5): Promise<StartMarketJob | undefined> {
  const result = await redisCommand(['BRPOP', QUEUE, String(timeoutSeconds)], { timeoutMs: (timeoutSeconds + 5) * 1000 })
  if (!Array.isArray(result) || typeof result[1] !== 'string') return undefined
  return JSON.parse(result[1]) as StartMarketJob
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
}

export async function getJob(id: string): Promise<StartMarketJob | undefined> {
  const result = await redisCommand(['HGET', jobKey(id), 'payload'])
  return typeof result === 'string' ? JSON.parse(result) as StartMarketJob : undefined
}

export function jobKey(id: string): string {
  return `${JOB_PREFIX}:${id}`
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
