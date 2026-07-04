/**
 * Marketplace starter — the headline example.
 *
 * Launches one session graph: a market buyer + four financial-intelligence seller personas. coral-server spawns each
 * as a container; the buyer broadcasts a WANT, the sellers compete with LLM bids, and the winner is
 * settled through the escrow contract. All sellers reuse the seller-agent image and share the receive
 * wallet — differentiation is persona/floor/inventory (set in each coral-agent.toml), not code.
 *
 *   CORAL_SERVER_URL  default http://localhost:5555
 *   CORAL_TOKEN       default dev   (must be in coral.toml [auth] keys)
 *
 * Run from the host after `docker compose up coral`:  npm install && npm start
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = 'default'
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// ── Load repo-root .env (2 levels up: marketplace → examples → root) ──
function loadEnv(): Record<string, string> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env — rely on process.env */ }
  return env
}

// ── Typed coral option values ──
const str = (value: string) => ({ type: 'string', value })
const f64 = (value: number) => ({ type: 'f64', value })

const agent = (name: string, options: Record<string, unknown>) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name,
  provider: { type: 'local', runtime: 'docker' },
  options,
})

async function main() {
  const env = loadEnv()
  const wallet = env.WALLET
  const keypair = env.BUYER_KEYPAIR_B58
  if (!wallet || !keypair) {
    throw new Error('WALLET and BUYER_KEYPAIR_B58 must be set in .env — run `node scripts/setup.js`')
  }
  const rpc = env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const trace = env.TRACE ?? ''

  // LLM provider — the kit uses Venice AI; flip the whole market with LLM_PROVIDER in .env (see LLM.md).
  const llmOpts: Record<string, unknown> = {}
  if (env.VENICE_API_KEY) llmOpts.VENICE_API_KEY = str(env.VENICE_API_KEY)
  if (env.OPENAI_API_KEY) llmOpts.OPENAI_API_KEY = str(env.OPENAI_API_KEY)
  if (env.ANTHROPIC_API_KEY) llmOpts.ANTHROPIC_API_KEY = str(env.ANTHROPIC_API_KEY)
  if (env.LLM_PROVIDER) llmOpts.LLM_PROVIDER = str(env.LLM_PROVIDER)
  if (env.LLM_MODEL) llmOpts.LLM_MODEL = str(env.LLM_MODEL)
  if (trace) llmOpts.TRACE = str(trace)

  // Every seller is an OmniQuantAI specialist sharing the receive wallet; they compete on persona,
  // quality metrics, speed, and floor price. The buyer awards best value and settles via escrow.
  const seller = (
    name: string,
    persona: string,
    floorSol: number,
    metrics: { relevance: number; quality: number; confidence: number; fit: number; speed: number; explanation: number },
  ) =>
    agent(name, {
      SELLER_WALLET: str(wallet), SOLANA_RPC_URL: str(rpc), AGENT_NAME: str(name),
      SERVICES: str('omniquant'), SERVICE: str('omniquant'), PERSONA: str(persona), FLOOR_SOL: f64(floorSol),
      RELEVANCE: f64(metrics.relevance), EXPECTED_QUALITY: f64(metrics.quality), CONFIDENCE: f64(metrics.confidence),
      DOMAIN_FIT: f64(metrics.fit), SPEED_SECONDS: f64(metrics.speed), EXPLANATION_QUALITY: f64(metrics.explanation),
      ...llmOpts,
    })

  const sellers = ['market-analyst', 'news-earnings', 'macro-risk', 'portfolio-risk']

  // Optional broker swarm (ENABLE_BROKER=1, see coral-agents/broker/README.md): the buyer buys from a
  // broker, which resells from the real sellers. Needs a funded broker wallet + seller receive wallets —
  // `node scripts/provision-swarm.js`.
  const brokerWanted = env.ENABLE_BROKER === '1'
  const brokerReady = brokerWanted && !!env.BROKER_KEYPAIR_B58 && !!env.BROKER_WALLET
  if (brokerWanted && !brokerReady) {
    console.warn('[marketplace] ENABLE_BROKER=1 but BROKER_KEYPAIR_B58/BROKER_WALLET missing — run `node scripts/provision-swarm.js`. Skipping broker.')
  }
  const brokerAgents = brokerReady
    ? [agent('broker', {
        BROKER_KEYPAIR_B58: str(env.BROKER_KEYPAIR_B58), BROKER_WALLET: str(env.BROKER_WALLET),
        AGENT_NAME: str('broker'), SOLANA_RPC_URL: str(rpc), UPSTREAM_SELLERS: str(sellers.join(',')),
        ...(env.BROKER_MARGIN_SOL ? { BROKER_MARGIN_SOL: f64(Number(env.BROKER_MARGIN_SOL)) } : {}),
        ...llmOpts,
      })]
    : []
  // Who the buyer shops + the payout wallet it binds the escrow to (F3): the broker if enabled, else the sellers.
  const buyerSellers = brokerReady ? ['broker'] : sellers
  const buyerExpectedWallet = brokerReady ? env.BROKER_WALLET : wallet

  // The buyer shops for a paid financial intelligence report.
  const buyerService = env.BUYER_SERVICE ?? 'omniquant'
  const buyerArg = env.BUYER_ARG ?? 'nvda-3-6m-exposure'
  const buyerArgs = env.BUYER_ARGS ?? ''

  const buyerOpts: Record<string, unknown> = {
    BUYER_KEYPAIR_B58: str(keypair),
    AGENT_NAME: str('buyer-agent'),
    SOLANA_RPC_URL: str(rpc),
    // F3: the expected seller payout wallet — the buyer binds the escrow seller= to it (broker if enabled).
    SELLER_WALLET: str(buyerExpectedWallet),
    BUYER_MAX_SOL: f64(Number(env.BUYER_MAX_SOL ?? '0.03')),
    BUYER_SERVICE: str(buyerService),
    BUYER_ARG: str(buyerArg),
    ...(buyerArgs ? { BUYER_ARGS: str(buyerArgs) } : {}),
    MARKET_SELLERS: str(buyerSellers.join(',')),
    ...llmOpts,
  }

  // coral-server spawns one container per agent in this graph. Docs:
  //   create-session   https://docs.coralos.ai/api-reference/local/create-session
  //   agent graph      https://docs.coralos.ai/api-reference/models/GraphAgentRequest
  const sres = await fetch(`${BASE}/api/v1/local/session`, {
    method: 'POST', headers: AUTH,
    body: JSON.stringify({
      agentGraphRequest: {
        agents: [
          agent('buyer-agent', buyerOpts),
          seller('market-analyst', 'Market Analyst Agent: price action, momentum, valuation snapshot, and market structure.', 0.012, {
            relevance: 92, quality: 86, confidence: 78, fit: 96, speed: 18, explanation: 82,
          }),
          seller('news-earnings', 'News & Earnings Agent: recent news, earnings themes, analyst sentiment, and company developments.', 0.011, {
            relevance: 90, quality: 88, confidence: 80, fit: 94, speed: 22, explanation: 86,
          }),
          seller('macro-risk', 'Macro Risk Agent: rates, inflation, liquidity, and macro risk for growth equities.', 0.009, {
            relevance: 82, quality: 80, confidence: 74, fit: 88, speed: 16, explanation: 78,
          }),
          seller('portfolio-risk', 'Portfolio Risk Agent: downside scenarios, concentration risk, risk controls, and invalidation triggers.', 0.014, {
            relevance: 95, quality: 92, confidence: 84, fit: 98, speed: 24, explanation: 90,
          }),
          ...brokerAgents,
        ],
      },
      namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
      execution: { mode: 'immediate' },
    }),
  })
  if (!sres.ok) throw new Error(`session create failed: ${sres.status} ${await sres.text()}`)
  const { sessionId } = await sres.json() as { sessionId: string }

  const lineup = brokerReady ? `broker (reselling ${sellers.join(', ')})` : sellers.join(', ')
  console.log(`\n✅ OmniQuantAI market session ${sessionId} — buyer + ${lineup}.`)
  console.log(`   receive wallet: ${wallet}`)
  console.log('   The buyer requests NVDA financial intelligence; sellers bid; the winner settles via escrow.\n')
  console.log('   Watch the market:')
  console.log('     docker logs -f buyer-agent      # WANT → AWARD (with a reason) → DEPOSITED → VERIFIED → RELEASED')
  console.log('     docker logs -f portfolio-risk   # BID → ESCROW_REQUIRED → DELIVERED')
  console.log('   Set TRACE=1 in .env to see the coral_* calls + Explorer links for deposit/release.\n')
}

main().catch((e) => { console.error(`[marketplace] ${e}`); process.exitCode = 1 })
