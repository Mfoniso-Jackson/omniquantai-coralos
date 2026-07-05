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

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  coral: BASE,
  defaultSession: DEFAULT_SESSION || undefined,
  fixture: FIXTURE || undefined,
}))

/** Operator trigger: launch a market session (runs the marketplace launcher) and return its id. */
app.post('/api/start', (_req, res) => {
  const child = spawn('npm', ['start'], { cwd: MARKET_DIR, shell: true })
  let buf = ''
  let done = false
  const reply = (code: number, body: unknown) => { if (!done) { done = true; res.status(code).json(body) } }
  const onData = (d: Buffer) => {
    buf += d.toString()
    const m = buf.match(/(?:OmniQuantAI\s+)?market session ([a-f0-9-]+)/i)
    if (m) {
      console.error(`[feed] launched market session ${m[1]}`)
      reply(200, { session: m[1] })
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (c) => reply(500, { error: `launcher exited ${c} without a session`, log: buf.slice(-400) }))
  setTimeout(() => reply(504, { error: 'launcher timed out', log: buf.slice(-400) }), 30_000)
})

app.get('/api/feed', async (req, res) => {
  const session = FIXTURE ? 'fixture' : ((req.query.session as string) || DEFAULT_SESSION)
  if (!FIXTURE && !session) {
    return res.json({
      session: '',
      rounds: [],
      updatedAt: new Date().toISOString(),
      diagnostics: {
        api: 'ok',
        coral: 'not_checked',
        messageCount: 0,
        lastEvent: 'No session supplied',
        buyerStatus: 'No session. Pass ?session=<id> or set SESSION.',
        sellerBidCount: 0,
        escrowStatus: 'No session',
      },
    })
  }
  try {
    const messages = collectMessages(await readState(session))
    const rounds = foldRounds(messages, SELLERS)
    void persistMarketplaceData({ sessionId: session, rounds }).catch((error) => {
      console.error(`[feed] persistence failed for session ${session}: ${(error as Error).message}`)
    })
    res.json({ session, rounds, updatedAt: new Date().toISOString(), diagnostics: diagnostics(messages, rounds) })
  } catch (e) {
    res.status(502).json({
      session,
      rounds: [],
      updatedAt: new Date().toISOString(),
      error: `feed failed: ${(e as Error).message}`,
      diagnostics: {
        api: 'ok',
        coral: 'unreachable',
        messageCount: 0,
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
    messageCount: messages.length,
    lastEvent: last ? `${last.sender}: ${last.text.slice(0, 160)}` : 'No events for this session yet',
    buyerStatus,
    sellerBidCount,
    escrowStatus,
  }
}
