/**
 * Marketplace feed server — the only backend the visualizer needs.
 *
 * Reads a CoralOS session's transcript (extended state, behind the dev token), folds it into typed
 * market rounds with `foldRounds`, and serves CORS-enabled JSON for the React app to poll. The browser
 * never touches coral or Solana — this keeps the token server-side and avoids CORS.
 *
 *   GET /api/health                  → { ok: true }
 *   GET /api/feed?session=<sid>      → { session, rounds, updatedAt }   (session defaults to $SESSION)
 *
 * Set FEED_FIXTURE=<path-to-recorded-extended-state.json> to serve a recorded transcript instead of
 * hitting coral — used by the e2e so it exercises the REAL fold/parse path with no devnet.
 *
 * Env: CORAL_SERVER_URL (default http://localhost:5555), CORAL_TOKEN (default dev),
 *      SESSION, MARKET_SELLERS (csv for the declined column), FEED_FIXTURE, PORT (default 4000).
 */
import express from 'express'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { foldRounds } from './foldRounds.js'
import { collectMessages } from './coralState.js'
import type { RawMessage, Round } from './foldRounds.js'
import { persistMarketplaceData } from './data/persistence.js'

const MARKET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..') // examples/marketplace

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = process.env.CORAL_NAMESPACE ?? 'omniquant'
const PORT = Number(process.env.PORT ?? 4000)
const DEFAULT_SESSION = process.env.SESSION ?? ''
const FIXTURE = process.env.FEED_FIXTURE
const SESSION_READ_RETRIES = Number(process.env.FEED_SESSION_READ_RETRIES ?? 8)
const SESSION_READ_RETRY_MS = Number(process.env.FEED_SESSION_READ_RETRY_MS ?? 1000)
const START_READY_RETRIES = Number(process.env.FEED_START_READY_RETRIES ?? 35)
const START_READY_RETRY_MS = Number(process.env.FEED_START_READY_RETRY_MS ?? 1000)
const BUILD = 'feed-session-id-v4'
const sessionNamespaces = new Map<string, string>()
const SELLERS = (process.env.MARKET_SELLERS ?? 'market-analyst,news-earnings,macro-risk,portfolio-risk')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Fetch a session's raw extended state — from the FEED_FIXTURE file, else from coral. */
async function readState(session: string, namespace = NS): Promise<unknown> {
  if (FIXTURE) return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  let lastError = ''
  for (let attempt = 1; attempt <= SESSION_READ_RETRIES; attempt += 1) {
    try {
      return await readStateAcrossNamespaces(session, namespace)
    } catch (error) {
      const message = (error as Error).message
      if (!shouldRecoverSessionRead(message)) throw error
      lastError = message
      if (attempt < SESSION_READ_RETRIES) {
        console.error(`[feed] session=${session} namespace=${namespace} read attempt ${attempt}/${SESSION_READ_RETRIES} failed: ${message}`)
        await sleep(SESSION_READ_RETRY_MS)
      }
    }
  }
  throw new Error(lastError || `Session ${session} could not be read`)
}

async function readStateAcrossNamespaces(session: string, namespace: string): Promise<unknown> {
  try {
    return await readStateInNamespace(session, namespace)
  } catch (error) {
    const message = (error as Error).message
    if (!shouldRecoverSessionRead(message)) throw error
    const namespaces = await listNamespaces()
    for (const candidate of namespaces.filter((name) => name !== namespace)) {
      try {
        const state = await readStateInNamespace(session, candidate)
        sessionNamespaces.set(session, candidate)
        console.error(`[feed] recovered session ${session} in namespace=${candidate} after ${message}`)
        return state
      } catch { /* keep scanning */ }
    }
    throw new Error(`${message}; available namespaces: ${namespaces.join(', ') || 'none'}`)
  }
}

function shouldRecoverSessionRead(message: string): boolean {
  return /Namespace .* does not exist|Session not found|coral 404|namespace|not found/i.test(message)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readStateInNamespace(session: string, namespace: string): Promise<unknown> {
  const r = await fetch(`${BASE}/api/v1/local/session/${namespace}/${session}/extended`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!r.ok) throw new Error(`coral ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function listNamespaces(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/local/namespace`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok) return []
    const body = await res.json() as Array<{ name?: string }>
    return body.map((item) => item.name).filter((name): name is string => Boolean(name))
  } catch {
    return []
  }
}

const app = express()
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

app.use(express.json())

app.get('/api/health', async (req, res) => {
  const quick = req.query.quick === '1'
  const coral = quick ? { ok: false, status: 'not_checked' } : await coralHealth()
  res.json({
    ok: true,
    coral: BASE,
    coralReachable: coral.ok,
    coralStatus: coral.status,
    build: BUILD,
    defaultSession: DEFAULT_SESSION || undefined,
    fixture: FIXTURE || undefined,
  })
})

/** Operator trigger: launch a market session (runs the marketplace launcher) and return its id. */
app.post('/api/start', (_req, res) => {
  const child = spawn('npm', ['start'], { cwd: MARKET_DIR, shell: true })
  let buf = ''
  let done = false
  let matched = false
  const reply = (code: number, body: unknown) => { if (!done) { done = true; res.status(code).json(body) } }
  const onData = (d: Buffer) => {
    buf += d.toString()
    const m = buf.match(/(?:OmniQuantAI\s+)?market session (\S+)(?:\s+namespace\s+([A-Za-z0-9_.-]+))?/i)
    if (m && !matched) {
      matched = true
      const session = m[1]
      const namespace = m[2] ?? NS
      sessionNamespaces.set(session, namespace)
      console.error(`[feed] launched market session ${session} namespace=${namespace}`)
      void waitForWant(session, namespace)
        .then(() => reply(200, { session, namespace }))
        .catch(async (error) => reply(502, {
          error: `launcher created session ${session} but buyer did not publish WANT: ${(error as Error).message}`,
          session,
          namespace,
          log: `${buf.slice(-800)}\n${await runtimeDiagnostics()}`.slice(-4000),
        }))
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (c) => {
    if (matched) return
    reply(500, { error: `launcher exited ${c} without a session`, log: buf.slice(-4000) })
  })
  setTimeout(() => reply(504, { error: 'launcher timed out', log: buf.slice(-800) }), Math.max(60_000, START_READY_RETRIES * START_READY_RETRY_MS + 10_000))
})

async function waitForWant(session: string, namespace: string): Promise<void> {
  let lastError = ''
  for (let attempt = 1; attempt <= START_READY_RETRIES; attempt += 1) {
    try {
      const messages = collectMessages(await readState(session, namespace))
      const want = messages.find((message) => /^WANT\b/.test(message.text.trim()))
      if (want) {
        console.error(`[feed] session=${session} namespace=${namespace} first WANT observed from ${want.sender}`)
        return
      }
      lastError = `readable session has ${messages.length} message(s), but no WANT yet`
    } catch (error) {
      lastError = (error as Error).message
    }
    if (attempt < START_READY_RETRIES) {
      console.error(`[feed] session=${session} namespace=${namespace} waiting for WANT ${attempt}/${START_READY_RETRIES}: ${lastError}`)
      await sleep(START_READY_RETRY_MS)
    }
  }
  throw new Error(lastError || 'Timed out waiting for buyer WANT')
}

async function runtimeDiagnostics(): Promise<string> {
  const commands = [
    ['docker ps', ['ps', '--format', 'table {{.Names}}\t{{.Image}}\t{{.Status}}']],
    ['coral logs', ['logs', '--tail', '80', 'coral']],
    ['buyer logs', ['logs', '--tail', '80', 'buyer-agent']],
    ['market analyst logs', ['logs', '--tail', '40', 'market-analyst']],
    ['news earnings logs', ['logs', '--tail', '40', 'news-earnings']],
    ['macro risk logs', ['logs', '--tail', '40', 'macro-risk']],
    ['portfolio risk logs', ['logs', '--tail', '40', 'portfolio-risk']],
  ] as const
  const out: string[] = []
  for (const [label, args] of commands) {
    out.push(`\n--- ${label} ---`)
    out.push(await dockerOutput(args))
  }
  return out.join('\n')
}

function dockerOutput(args: readonly string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('docker', [...args], { shell: false })
    let output = ''
    child.stdout.on('data', (data) => { output += data.toString() })
    child.stderr.on('data', (data) => { output += data.toString() })
    child.on('error', (error) => resolve((error as Error).message))
    child.on('close', () => resolve(output.trim() || 'no output'))
  })
}

app.get('/api/feed', async (req, res) => {
  const session = FIXTURE ? 'fixture' : ((req.query.session as string) || DEFAULT_SESSION)
  const requestedNamespace = FIXTURE ? 'fixture' : ((req.query.namespace as string) || sessionNamespaces.get(session) || NS)
  if (!FIXTURE && !session) {
    return res.json({
      session: '',
      rounds: [],
      updatedAt: new Date().toISOString(),
      diagnostics: {
        api: 'ok',
        coral: 'not_checked',
        build: BUILD,
        messageCount: 0,
        lastEventType: 'NONE',
        lastEvent: 'No session supplied',
        buyerStatus: 'No session. Pass ?session=<id> or set SESSION.',
        sellerBidCount: 0,
        escrowStatus: 'No session',
      },
    })
  }
  try {
    const messages = collectMessages(await readState(session, requestedNamespace))
    const namespace = sessionNamespaces.get(session) || requestedNamespace
    const rounds = foldRounds(messages, SELLERS)
    const diag = diagnostics(messages, rounds)
    console.error(`[feed] session=${session} namespace=${namespace} messages=${diag.messageCount} rounds=${rounds.length} last_event_type=${diag.lastEventType} seller_bids=${diag.sellerBidCount} escrow=${diag.escrowStatus}`)
    void persistMarketplaceData({ sessionId: session, rounds }).catch((error) => {
      console.error(`[feed] persistence failed for session ${session}: ${(error as Error).message}`)
    })
    res.json({ session, namespace, rounds, updatedAt: new Date().toISOString(), diagnostics: diag })
  } catch (e) {
    res.status(502).json({
      session,
      namespace: sessionNamespaces.get(session) || requestedNamespace,
      rounds: [],
      updatedAt: new Date().toISOString(),
      error: `feed failed: ${(e as Error).message}`,
      diagnostics: {
        api: 'ok',
        coral: 'unreachable',
        build: BUILD,
        messageCount: 0,
        lastEventType: 'ERROR',
        lastEvent: (e as Error).message,
        buyerStatus: 'CoralOS extended state could not be read for this session.',
        sellerBidCount: 0,
        escrowStatus: 'Unknown',
      },
    })
  }
})

app.listen(PORT, () => console.error(`[feed] http://localhost:${PORT}/api/feed  (${FIXTURE ? `fixture=${FIXTURE}` : `coral=${BASE}`})`))

function diagnostics(messages: RawMessage[], rounds: Round[]) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const last = messages.at(-1)
  const sellerBidCount = latest ? new Set(latest.bids.map((b) => b.by)).size : 0
  const escrowStatus =
    latest?.release ? 'Released'
      : latest?.refunded ? 'Refunded'
        : latest?.deposit ? 'Deposited'
          : latest?.escrow ? 'Escrow requested'
            : latest?.award ? 'Awaiting deposit'
              : 'Not started'
  const buyerStatus =
    latest?.want ? `WANT broadcast for ${latest.want.service}:${latest.want.arg}`
      : messages.length ? 'Messages exist, but no buyer WANT has been parsed yet.'
        : 'No CoralOS thread messages yet. Buyer may still be starting.'
  return {
    api: 'ok',
    coral: 'ok',
    build: BUILD,
    messageCount: messages.length,
    lastEventType: last ? lastEventType(last.text) : 'NONE',
    lastEvent: last ? `${last.sender}: ${last.text.slice(0, 160)}` : 'No events for this session yet',
    buyerStatus,
    sellerBidCount,
    escrowStatus,
  }
}

function lastEventType(text: string): string {
  return text.trim().match(/^([A-Z_]+)/)?.[1] ?? 'UNKNOWN'
}

async function coralHealth(): Promise<{ ok: boolean; status: string }> {
  if (FIXTURE) return { ok: true, status: 'fixture mode' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(`${BASE}/api/v1/local/session/${NS}/__healthcheck__/extended`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: controller.signal,
    })
    if (res.status === 404) return { ok: true, status: 'reachable' }
    return { ok: res.ok, status: `${res.status} ${res.statusText}` }
  } catch (error) {
    return { ok: false, status: (error as Error).message }
  } finally {
    clearTimeout(timeout)
  }
}
