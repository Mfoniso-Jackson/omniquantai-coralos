/**
 * Human → user-proxy bridge — the human front door to the agent economy.
 *
 * A person can't be an MCP agent, so this bridge represents them: it injects their order into a
 * CoralOS session *as* the `user-proxy` agent (the exact puppet-API pattern proven by smoke-mcp),
 * routed to the same `seller-agent` the autonomous buyer uses. The human pays the seller's Solana
 * Pay URL with Phantom; the seller verifies on-chain and delivers. One protocol, two front doors.
 *
 *   Browser → POST /order                 { service } → { reference, amountSol, solanaPayUrl, recipient }
 *   (Phantom signs a transfer that writes the reference key in → sig)
 *   Browser → POST /order/:reference/paid { sig }     → { status: 'delivered', data }
 *
 * Env: CORAL_SERVER_URL, CORAL_TOKEN, SELLER_WALLET (required), PRICE_SOL, SERVICE,
 *      SOLANA_RPC_URL, ANTHROPIC_API_KEY, PORT (default 3010).
 */
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const PORT = Number(process.env.PORT ?? 3010)
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

const SELLER_WALLET = process.env.SELLER_WALLET ?? ''
const PRICE_SOL = process.env.PRICE_SOL ?? '0.0001'
const SERVICE = process.env.SERVICE ?? 'jupiter'
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const NEWS_API_KEY = process.env.NEWS_API_KEY ?? ''
const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? ''
const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? ''
const BUYER_KEYPAIR_B58 = process.env.BUYER_KEYPAIR_B58 ?? '' // only for the autonomous demo
const BUYER_MAX_SOL = Number(process.env.BUYER_MAX_SOL ?? '0.001')

// ── Typed coral option values: { type: "string" | "f64", value } ──
const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })

/** Forward any configured service API keys to the seller agent (declared in its coral-agent.toml). */
const addSellerKeys = (opts: Record<string, unknown>) => {
  if (ANTHROPIC) opts.ANTHROPIC_API_KEY = str(ANTHROPIC)
  if (NEWS_API_KEY) opts.NEWS_API_KEY = str(NEWS_API_KEY)
  if (JUPITER_API_KEY) opts.JUPITER_API_KEY = str(JUPITER_API_KEY)
  if (HELIUS_API_KEY) opts.HELIUS_API_KEY = str(HELIUS_API_KEY)
  return opts
}

/** Agent descriptor for a session request. */
const localAgent = (name: string, options: Record<string, unknown> = {}) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name, provider: { type: 'local', runtime: 'docker' }, options,
})

// ── Lazy long-lived session [seller-agent, user-proxy]; one thread per order ──
let session: Promise<string> | null = null
const orders = new Map<string, { threadId: string }>()

function ensureSession(): Promise<string> {
  if (session) return session
  session = (async () => {
    if (!SELLER_WALLET) throw new Error('SELLER_WALLET not set — the seller has no wallet to receive payments')
    const sellerOpts: Record<string, unknown> = {
      SELLER_WALLET: str(SELLER_WALLET),
      SOLANA_RPC_URL: str(RPC),
      SERVICE: str(SERVICE),
    }
    addSellerKeys(sellerOpts)

    const res = await fetch(`${BASE}/api/v1/local/session`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({
        agentGraphRequest: { agents: [localAgent('seller-agent', sellerOpts), localAgent('user-proxy')] },
        namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
        execution: { mode: 'immediate' },
      }),
    })
    if (!res.ok) { session = null; throw new Error(`session create failed: ${res.status} ${await res.text()}`) }
    const { sessionId } = await res.json() as { sessionId: string }
    console.error(`[bridge] session ${sessionId} created — waiting for agents to spawn`)
    await new Promise(r => setTimeout(r, 8000)) // let coral spawn + connect the containers
    return sessionId
  })()
  return session
}

/** Inject a message into a thread as user-proxy. */
async function inject(sid: string, threadId: string, content: string) {
  const res = await fetch(`${BASE}/api/v1/puppet/${NS}/${sid}/user-proxy/thread/message`, {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({ threadId, content, mentions: ['seller-agent'] }),
  })
  if (!res.ok) throw new Error(`inject failed: ${res.status} ${await res.text()}`)
}

/** A message pulled from the extended session state. */
interface Msg { threadId: string; text: string; sender: string }

/** Recursively collect messages from the extended session state (in traversal/thread order). */
function collectMessages(node: unknown, out: Msg[] = []): Msg[] {
  if (Array.isArray(node)) {
    for (const v of node) collectMessages(v, out)
  } else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if (typeof o.threadId === 'string' && typeof o.text === 'string') {
      out.push({ threadId: o.threadId, text: o.text, sender: typeof o.senderName === 'string' ? o.senderName : '' })
    }
    for (const v of Object.values(o)) collectMessages(v, out)
  }
  return out
}

/**
 * Poll the extended session state until a message in `threadId` contains `marker`; return its text.
 * The puppet API is send-only (no read), so replies are read from the session state instead.
 */
async function pollThread(sid: string, threadId: string, marker: string, timeoutMs = 35000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500))
    const res = await fetch(`${BASE}/api/v1/local/session/${NS}/${sid}/extended`, { headers: AUTH })
    if (res.ok) {
      const msg = collectMessages(await res.json()).find(m => m.threadId === threadId && m.text.includes(marker))
      if (msg) return msg.text
    }
  }
  throw new Error(`timed out waiting for "${marker}"`)
}

const app = express()
app.use(express.json())

// Serve the Phantom checkout UI (same origin → no CORS).
const webDir = join(dirname(fileURLToPath(import.meta.url)), 'web')
app.use(express.static(webDir))

app.get('/health', (_req, res) => res.json({ ok: true, seller: SELLER_WALLET, service: SERVICE }))

// 1. Start an order — open a thread, ask the seller, return the Solana Pay URL.
app.post('/order', async (req, res) => {
  try {
    const service = String(req.body?.service ?? SERVICE)
    const prompt = String(req.body?.prompt ?? '').trim()
    // The seller routes on the first token; append the prompt for services that use it (e.g. inference).
    const query = prompt ? `${service} ${prompt}` : service
    const sid = await ensureSession()

    const tres = await fetch(`${BASE}/api/v1/puppet/${NS}/${sid}/user-proxy/thread`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ threadName: `order-${Date.now()}`, participantNames: ['seller-agent'] }),
    })
    if (!tres.ok) throw new Error(`thread create failed: ${tres.status} ${await tres.text()}`)
    const threadId = (await tres.json() as { thread: { id: string } }).thread.id

    await inject(sid, threadId, `request ${query}`)
    const text = await pollThread(sid, threadId, 'PAYMENT_REQUIRED')

    // The reference is a base58 pubkey that binds this payment to this order (the field appears
    // before the url=, so the first match is the standalone reference, not the one in the URL).
    const reference = text.match(/reference=([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1]
    const amountSol = text.match(/amount=([\d.]+)/)?.[1]
    const solanaPayUrl = text.match(/url=(solana:[^\s"\\]+)/)?.[1]
    if (!reference || !solanaPayUrl) throw new Error('could not parse seller PAYMENT_REQUIRED')

    orders.set(reference, { threadId })
    res.json({ reference, amountSol: amountSol ?? PRICE_SOL, solanaPayUrl, recipient: SELLER_WALLET })
  } catch (e) {
    console.error(`[bridge] /order error: ${e}`)
    res.status(502).json({ error: (e as Error).message })
  }
})

// 2. Submit payment proof — tell the seller, wait for delivery.
app.post('/order/:reference/paid', async (req, res) => {
  try {
    const reference = req.params.reference
    const sig = String(req.body?.sig ?? '')
    const order = orders.get(reference)
    if (!order) return res.status(404).json({ error: `unknown reference ${reference}` })
    if (!sig) return res.status(400).json({ error: 'sig required' })

    const sid = await ensureSession()
    await inject(sid, order.threadId, `paid ${sig} reference=${reference}`)
    const text = await pollThread(sid, order.threadId, 'DELIVERED')

    // DELIVERED <data> — grab the seller's delivered payload (rest of the message).
    const data = text.match(/DELIVERED\s+([\s\S]+)/)?.[1]?.trim()
    orders.delete(reference)
    res.json({ status: 'delivered', sig, data: data ?? '(delivered)' })
  } catch (e) {
    console.error(`[bridge] /paid error: ${e}`)
    res.status(502).json({ error: (e as Error).message })
  }
})

// ── Autonomous front door — the agent↔agent demo ────────────────────────────
let autonomousSid: string | null = null

/** Start (or reuse) a `[buyer-agent, seller-agent]` session — coral spawns both; the buyer pays the seller in a loop. */
app.post('/autonomous/start', async (_req, res) => {
  try {
    if (!SELLER_WALLET || !BUYER_KEYPAIR_B58) {
      return res.status(400).json({ error: 'SELLER_WALLET and BUYER_KEYPAIR_B58 must be set for the autonomous demo' })
    }
    if (autonomousSid) return res.json({ sessionId: autonomousSid, reused: true })

    const sellerOpts: Record<string, unknown> = { SELLER_WALLET: str(SELLER_WALLET), SOLANA_RPC_URL: str(RPC), SERVICE: str(SERVICE) }
    const buyerOpts: Record<string, unknown> = { BUYER_KEYPAIR_B58: str(BUYER_KEYPAIR_B58), SOLANA_RPC_URL: str(RPC), BUYER_MAX_SOL: f64(BUYER_MAX_SOL) }
    addSellerKeys(sellerOpts)
    if (ANTHROPIC) buyerOpts.ANTHROPIC_API_KEY = str(ANTHROPIC)

    const r = await fetch(`${BASE}/api/v1/local/session`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({
        agentGraphRequest: { agents: [localAgent('buyer-agent', buyerOpts), localAgent('seller-agent', sellerOpts)] },
        namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
        execution: { mode: 'immediate' },
      }),
    })
    if (!r.ok) throw new Error(`session create failed: ${r.status} ${await r.text()}`)
    autonomousSid = (await r.json() as { sessionId: string }).sessionId
    console.error(`[bridge] autonomous session ${autonomousSid}`)
    res.json({ sessionId: autonomousSid })
  } catch (e) {
    console.error(`[bridge] /autonomous/start error: ${e}`)
    res.status(502).json({ error: (e as Error).message })
  }
})

/** Live feed: the buyer⇄seller conversation, read from the session's extended state. */
app.get('/autonomous/feed', async (_req, res) => {
  if (!autonomousSid) return res.json({ running: false, messages: [] })
  try {
    const r = await fetch(`${BASE}/api/v1/local/session/${NS}/${autonomousSid}/extended`, { headers: AUTH })
    if (!r.ok) return res.json({ running: true, messages: [] })
    const messages = collectMessages(await r.json())
      .filter(m => m.sender === 'buyer-agent' || m.sender === 'seller-agent')
      .map(m => ({ sender: m.sender, text: m.text }))
    res.json({ running: true, messages })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
})

app.listen(PORT, () => {
  console.error(`[bridge] agent economy on :${PORT} — seller=${SELLER_WALLET || '(SELLER_WALLET unset!)'} service=${SERVICE}`)
})
