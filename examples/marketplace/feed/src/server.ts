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

const MARKET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..') // examples/marketplace

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const PORT = Number(process.env.PORT ?? 4000)
const DEFAULT_SESSION = process.env.SESSION ?? ''
const FIXTURE = process.env.FEED_FIXTURE
const SELLERS = (process.env.MARKET_SELLERS ?? 'market-analyst,news-earnings,macro-risk,portfolio-risk')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Fetch a session's raw extended state — from the FEED_FIXTURE file, else from coral. */
async function readState(session: string): Promise<unknown> {
  if (FIXTURE) return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const r = await fetch(`${BASE}/api/v1/local/session/${NS}/${session}/extended`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!r.ok) throw new Error(`coral ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

const app = express()
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

/** Operator trigger: launch a market session (runs the marketplace launcher) and return its id. */
app.post('/api/start', (_req, res) => {
  const child = spawn('npm', ['start'], { cwd: MARKET_DIR, shell: true })
  let buf = ''
  let done = false
  const reply = (code: number, body: unknown) => { if (!done) { done = true; res.status(code).json(body) } }
  const onData = (d: Buffer) => {
    buf += d.toString()
    const m = buf.match(/Market session ([a-f0-9-]+)/)
    if (m) reply(200, { session: m[1] })
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (c) => reply(500, { error: `launcher exited ${c} without a session`, log: buf.slice(-400) }))
  setTimeout(() => reply(504, { error: 'launcher timed out', log: buf.slice(-400) }), 30_000)
})

app.get('/api/feed', async (req, res) => {
  const session = FIXTURE ? 'fixture' : ((req.query.session as string) || DEFAULT_SESSION)
  if (!FIXTURE && !session) return res.status(400).json({ error: 'no session — pass ?session=<id> or set SESSION' })
  try {
    const rounds = foldRounds(collectMessages(await readState(session)), SELLERS)
    res.json({ session, rounds, updatedAt: new Date().toISOString() })
  } catch (e) {
    res.status(502).json({ error: `feed failed: ${(e as Error).message}` })
  }
})

app.listen(PORT, () => console.error(`[feed] http://localhost:${PORT}/api/feed  (${FIXTURE ? `fixture=${FIXTURE}` : `coral=${BASE}`})`))
