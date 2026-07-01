/**
 * `deliverService()` — THE fork point. This is the one function you replace to sell your own thing.
 *
 * A seller gets a paid request and returns the string the buyer paid for. The default body below sells
 * verified TxLINE World Cup data (fixtures / odds / an LLM "edge" read) — that's just the demo that
 * proves the rails. To build your own agent economy, return your own value here (ad copy, a research
 * brief, a routed job, a verified fact), give the seller a persona (`coral-agent.toml`), and tell the
 * buyer how to value bids. The escrow, market, Solana Pay, and LLM shim don't change.
 *
 * The live web demo serves this same transform through the proxy (`server/proxy.ts` → `/api/edge`) via
 * `analyzeEdge()` in `agent/edge.ts`; this module is the standalone, minimal version — read it to
 * understand the shape, then wire your delivery in as `case 'yourservice': return deliverYours(payload)`.
 *
 * Request grammar (the buyer's request string after the service keyword):
 *   "fixtures"          -> upcoming World Cup / Int Friendlies fixtures              (data only)
 *   "odds <fixtureId>"  -> de-margined StablePrice odds for a fixture                (data only)
 *   "edge <fixtureId>"  -> odds + fair (break-even) odds + an LLM read               (the full loop)
 *
 * Pillars in play (all reusable for your own service):
 *   - Data     verified TxLINE fixtures/odds, fetched on devnet (TxLineClient).
 *   - LLM      turns raw data into a sellable insight (Venice AI via `analyzeEdge` → `complete()`).
 *   - Solana   the buyer escrow settles delivery on-chain (see ../server/proxy.ts `/api/settle`).
 */
import { TxLineClient } from './txline.js'
import { analyzeEdge } from './edge.js'

export async function deliverService(request: string): Promise<string> {
  const tokens = request.trim().split(/\s+/).filter(Boolean)
  // A bare fixture id (single numeric token) is treated as `edge <id>` — the on-thesis product (so a
  // caller can pass just a fixture id, e.g. "17588245").
  let verb = (tokens[0] ?? 'fixtures').toLowerCase()
  let rest = tokens.slice(1)
  if (/^\d+$/.test(verb)) { rest = [verb]; verb = 'edge' }
  const client = new TxLineClient()

  try {
    switch (verb) {
      case 'fixtures': {
        const fixtures = await client.fixtures()
        return JSON.stringify({
          service: 'txline-fixtures',
          count: fixtures.length,
          fixtures: fixtures.slice(0, 10),
          timestamp: new Date().toISOString(),
        })
      }

      case 'odds': {
        const fixtureId = Number(rest[0])
        if (!fixtureId) return JSON.stringify({ error: 'usage: odds <fixtureId>' })
        const odds = await client.odds(fixtureId)
        return JSON.stringify({ service: 'txline-odds', fixtureId, odds, timestamp: new Date().toISOString() })
      }

      // The on-thesis product: verified data in, LLM-shaped insight out, paid in SOL.
      case 'edge': {
        const fixtureId = Number(rest[0])
        if (!fixtureId) return JSON.stringify({ error: 'usage: edge <fixtureId>' })
        const [odds, fixtures] = await Promise.all([client.odds(fixtureId), client.fixtures()])
        const edge = await analyzeEdge({ fixtureId, odds, fixtures }) // shared with the web proxy's /api/edge
        return JSON.stringify({ service: 'txline-edge', ...edge, timestamp: new Date().toISOString() })
      }

      default:
        return JSON.stringify({ error: `unknown txline verb: ${verb} (try: fixtures | odds | edge)` })
    }
  } catch (e) {
    // Match the kit convention: failures come back as a string the buyer can read, not a throw.
    return JSON.stringify({ error: `txline delivery failed: ${(e as Error).message}` })
  }
}
