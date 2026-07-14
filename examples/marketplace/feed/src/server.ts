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
import type { Request, Response } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { foldRounds } from './foldRounds.js'
import { collectMessages } from './coralState.js'
import type { RawMessage, Round } from './foldRounds.js'
import { persistMarketplaceData } from './data/persistence.js'
import { deriveMarketStatus, type MarketStatus } from './marketStatus.js'

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
const BUILD = 'feed-direct-launcher-v6'
const sessionNamespaces = new Map<string, string>()
const sessionStartedAt = new Map<string, number>()
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

async function healthPayload(quick: boolean) {
  const coral = quick ? { ok: false, status: 'not_checked' } : await coralHealth()
  return {
    ok: true,
    coral: BASE,
    coralReachable: coral.ok,
    coralStatus: coral.status,
    build: BUILD,
    defaultSession: DEFAULT_SESSION || undefined,
    fixture: FIXTURE || undefined,
  }
}

app.get('/health', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/status', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/api/health', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/api/status', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.post('/api/sessions/start', startSession)
app.post('/api/start', startSession)

/** Operator trigger: launch a market session (runs the marketplace launcher) and return its id. */
function startSession(_req: Request, res: Response) {
  const launcher = launcherCommand()
  const child = spawn(launcher.cmd, launcher.args, { cwd: MARKET_DIR, shell: false, env: process.env })
  let buf = ''
  let done = false
  let matched = false
  const reply = (code: number, body: unknown) => { if (!done) { done = true; res.status(code).json(body) } }
  const onData = (d: Buffer) => {
    buf += d.toString()
    const parsed = parseLauncherSession(buf)
    if (parsed && !matched) {
      matched = true
      const { session, namespace } = parsed
      sessionNamespaces.set(session, namespace)
      sessionStartedAt.set(session, Date.now())
      console.error(`[feed] launched market session ${session} namespace=${namespace}`)
      reply(200, { session, namespace })
      void waitForWant(session, namespace)
        .catch(async (error) => {
          console.error(`[feed] session=${session} namespace=${namespace} buyer did not publish WANT: ${(error as Error).message}`)
          console.error(await runtimeDiagnostics())
        })
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('error', (error) => {
    reply(500, { error: `launcher failed to start: ${(error as Error).message}`, log: buf.slice(-4000) })
  })
  child.on('exit', (c) => {
    if (matched) return
    reply(500, {
      error: `launcher exited ${c} without a session`,
      command: `${launcher.cmd} ${launcher.args.join(' ')}`,
      log: buf.slice(-4000),
    })
  })
  setTimeout(() => reply(504, { error: 'launcher timed out', log: buf.slice(-800) }), Math.max(60_000, START_READY_RETRIES * START_READY_RETRY_MS + 10_000))
}

function launcherCommand(): { cmd: string; args: string[] } {
  const localTsx = join(MARKET_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')
  if (existsSync(localTsx)) return { cmd: localTsx, args: ['start.ts'] }
  return { cmd: 'npx', args: ['tsx', 'start.ts'] }
}

function parseLauncherSession(text: string): { session: string; namespace: string } | null {
  const primary = text.match(/(?:OmniQuantAI\s+)?market session (\S+)(?:\s+namespace\s+([A-Za-z0-9_.-]+))?/i)
  if (primary) return { session: primary[1], namespace: primary[2] ?? NS }
  const session = text.match(/session id:\s*(\S+)/i)?.[1]
  if (!session) return null
  const namespace = text.match(/namespace:\s*([A-Za-z0-9_.-]+)/i)?.[1] ?? NS
  return { session, namespace }
}

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

app.get('/api/sessions/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

app.get('/session/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

app.get('/api/session/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

async function marketStatusResponse(req: Request, res: Response) {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  const body = result.body as FeedResponse
  res.status(result.status).json({
    session: body.session,
    namespace: body.namespace,
    status: body.marketStatus.currentStage,
    currentStage: body.marketStatus.currentStage,
    currentStageLabel: body.marketStatus.currentStageLabel,
    latestRound: body.marketStatus.latestRound,
    winningAgent: body.marketStatus.winningAgent,
    settlementStatus: body.marketStatus.settlementStatus,
    explorerLink: body.marketStatus.explorerLink,
    elapsedMs: body.marketStatus.elapsedMs,
    dataSource: body.marketStatus.dataSource,
    diagnostics: body.diagnostics,
    updatedAt: body.updatedAt,
    error: body.error,
  })
}

app.get('/api/market/:id/status', marketStatusResponse)
app.get('/market/:id', marketStatusResponse)
app.get('/api/market/:id', marketStatusResponse)

app.get('/api/feed', async (req, res) => {
  const session = FIXTURE ? 'fixture' : ((req.query.session as string) || DEFAULT_SESSION)
  const requestedNamespace = FIXTURE ? 'fixture' : ((req.query.namespace as string) || sessionNamespaces.get(session) || NS)
  const result = await feedSnapshot(session, requestedNamespace)
  res.status(result.status).json(result.body)
})

interface FeedResponse {
  session: string
  namespace?: string
  rounds: Round[]
  updatedAt: string
  diagnostics: ReturnType<typeof diagnostics>
  marketStatus: MarketStatus
  error?: string
}

async function feedSnapshot(session: string, requestedNamespace: string): Promise<{ status: number; body: FeedResponse }> {
  if (!FIXTURE && !session) {
    const marketStatus = deriveMarketStatus({ rounds: [] })
    return {
      status: 200,
      body: {
      session: '',
      rounds: [],
      updatedAt: new Date().toISOString(),
      marketStatus,
      diagnostics: {
        api: 'ok',
        coral: 'not_checked',
        build: BUILD,
        currentStage: marketStatus.currentStage,
        currentStageLabel: marketStatus.currentStageLabel,
        elapsedMs: marketStatus.elapsedMs,
        messageCount: 0,
        lastEventType: 'NONE',
        lastEvent: 'No session supplied',
        buyerStatus: marketStatus.buyerStatus,
        sellerStatus: marketStatus.sellerStatus,
        sellerBidCount: marketStatus.sellerBidCount,
        winningAgent: marketStatus.winningAgent,
        settlementStatus: marketStatus.settlementStatus,
        explorerLink: marketStatus.explorerLink,
        dataSource: marketStatus.dataSource,
        escrowStatus: marketStatus.settlementStatus,
      },
      },
    }
  }
  try {
    const messages = collectMessages(await readState(session, requestedNamespace))
    const namespace = sessionNamespaces.get(session) || requestedNamespace
    const rounds = foldRounds(messages, SELLERS)
    const marketStatus = deriveMarketStatus({ session, rounds, startedAt: sessionStartedAt.get(session) })
    const diag = diagnostics(messages, rounds, marketStatus)
    console.error(`[feed] session=${session} namespace=${namespace} messages=${diag.messageCount} rounds=${rounds.length} last_event_type=${diag.lastEventType} seller_bids=${diag.sellerBidCount} escrow=${diag.escrowStatus}`)
    void persistMarketplaceData({ sessionId: session, rounds }).catch((error) => {
      console.error(`[feed] persistence failed for session ${session}: ${(error as Error).message}`)
    })
    return {
      status: 200,
      body: { session, namespace, rounds, updatedAt: new Date().toISOString(), diagnostics: diag, marketStatus },
    }
  } catch (e) {
    const marketStatus = deriveMarketStatus({ session, rounds: [], startedAt: sessionStartedAt.get(session), error: (e as Error).message })
    return {
      status: 502,
      body: {
      session,
      namespace: sessionNamespaces.get(session) || requestedNamespace,
      rounds: [],
      updatedAt: new Date().toISOString(),
      error: `feed failed: ${(e as Error).message}`,
      marketStatus,
      diagnostics: {
        api: 'ok',
        coral: 'unreachable',
        build: BUILD,
        messageCount: 0,
        lastEventType: 'ERROR',
        lastEvent: (e as Error).message,
        currentStage: marketStatus.currentStage,
        currentStageLabel: marketStatus.currentStageLabel,
        elapsedMs: marketStatus.elapsedMs,
        buyerStatus: marketStatus.buyerStatus,
        sellerStatus: marketStatus.sellerStatus,
        sellerBidCount: 0,
        winningAgent: marketStatus.winningAgent,
        settlementStatus: marketStatus.settlementStatus,
        explorerLink: marketStatus.explorerLink,
        dataSource: marketStatus.dataSource,
        escrowStatus: marketStatus.settlementStatus,
      },
      },
    }
  }
}

app.listen(PORT, () => console.error(`[feed] http://localhost:${PORT}/api/feed  (${FIXTURE ? `fixture=${FIXTURE}` : `coral=${BASE}`})`))

function diagnostics(messages: RawMessage[], rounds: Round[], marketStatus: MarketStatus) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const last = messages.at(-1)
  return {
    api: 'ok',
    coral: 'ok',
    build: BUILD,
    currentStage: marketStatus.currentStage,
    currentStageLabel: marketStatus.currentStageLabel,
    elapsedMs: marketStatus.elapsedMs,
    messageCount: messages.length,
    lastEventType: last ? lastEventType(last.text) : 'NONE',
    lastEvent: last ? `${last.sender}: ${last.text.slice(0, 160)}` : 'No events for this session yet',
    buyerStatus: marketStatus.buyerStatus,
    sellerStatus: marketStatus.sellerStatus,
    sellerBidCount: marketStatus.sellerBidCount,
    winningAgent: marketStatus.winningAgent,
    settlementStatus: marketStatus.settlementStatus,
    explorerLink: marketStatus.explorerLink,
    dataSource: marketStatus.dataSource,
    escrowStatus: marketStatus.settlementStatus,
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
