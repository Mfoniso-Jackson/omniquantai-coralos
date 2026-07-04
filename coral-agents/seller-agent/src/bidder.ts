/**
 * LLM bidding - the seller's brain in the marketplace.
 *
 * On a WANT, the seller asks the LLM whether to bid and at what price, given its persona and cost
 * floor. The model PROPOSES; this code ENFORCES the economics, mirroring llm_buyer.ts:
 *   - never bid on a service it doesn't carry
 *   - never below its cost floor, never above the buyer's budget
 *   - if the floor exceeds the budget, sit the round out
 * A prompt injection inside a WANT therefore can't make the seller bid at a loss.
 */
import { complete, parseJsonReply, type Want, type CompleteOpts } from '@pay/agent-runtime'

export interface SellerConfig {
  name: string
  services: string[]
  floorSol: number
  persona: string
  relevance: number
  expectedQuality: number
  confidence: number
  domainFit: number
  speedSeconds: number
  explanationQuality: number
}

export interface BidDecision {
  bid: boolean
  priceSol: number
  note: string
}

/** Build a seller's market config from its env (set per persona in coral-agent.toml). */
export function sellerConfigFromEnv(name: string): SellerConfig {
  return {
    name,
    services: (process.env.SERVICES ?? 'txline').split(',').map((s) => s.trim()).filter(Boolean),
    floorSol: Number(process.env.FLOOR_SOL ?? '0.0003'),
    persona: process.env.PERSONA ?? 'a TxODDS specialist selling verified fair-line reads',
    relevance: Number(process.env.RELEVANCE ?? '80'),
    expectedQuality: Number(process.env.EXPECTED_QUALITY ?? '80'),
    confidence: Number(process.env.CONFIDENCE ?? '76'),
    domainFit: Number(process.env.DOMAIN_FIT ?? '80'),
    speedSeconds: Number(process.env.SPEED_SECONDS ?? '20'),
    explanationQuality: Number(process.env.EXPLANATION_QUALITY ?? '80'),
  }
}

type Llm = (opts: CompleteOpts) => Promise<string>

/** Decide whether/how to bid. `llm` is injectable so tests run without the network. */
export async function decideBid(want: Want, cfg: SellerConfig, llm: Llm = complete): Promise<BidDecision> {
  // Hard guards first - no LLM call needed to refuse impossible jobs.
  if (!cfg.services.includes(want.service)) return { bid: false, priceSol: 0, note: 'not in inventory' }
  if (cfg.floorSol > want.budgetSol) return { bid: false, priceSol: 0, note: 'budget below floor' }

  const system =
    `You are ${cfg.name}, ${cfg.persona}. You sell financial intelligence services. Decide whether to bid on a ` +
    `request and at what price in SOL. Your cost floor is ${cfg.floorSol} SOL - never propose below it; ` +
    `the buyer's budget caps the price. Reply ONLY with JSON: {"bid": boolean, "price": number, ` +
    `"note": string}. Keep note under 8 words and state your specialist value.`
  const user = `service=${want.service} arg=${want.arg} budget=${want.budgetSol} floor=${cfg.floorSol}`

  let proposed: number | undefined
  let note = ''
  try {
    const parsed = parseJsonReply<{ bid?: boolean; price?: number; note?: string }>(
      await llm({ system, user, maxTokens: 120 }),
    )
    if (parsed) {
      if (parsed.bid === false) return { bid: false, priceSol: 0, note: (parsed.note ?? 'declined').slice(0, 60) }
      proposed = typeof parsed.price === 'number' ? parsed.price : undefined
      note = (parsed.note ?? '').slice(0, 60)
    }
  } catch {
    // LLM unavailable -> deterministic fallback below (bid at floor).
  }

  // Enforce the economics: clamp the price into [floor, budget].
  const priceSol = Math.min(want.budgetSol, Math.max(cfg.floorSol, proposed ?? cfg.floorSol))
  const value = note || cfg.persona.split(':').at(0) || cfg.name
  const metrics =
    `value=${value}; confidence=${cfg.confidence}; delivery=${cfg.speedSeconds}s; ` +
    `reasoning=${cfg.explanationQuality}; rel=${cfg.relevance} qual=${cfg.expectedQuality} ` +
    `conf=${cfg.confidence} fit=${cfg.domainFit} speed=${cfg.speedSeconds} explain=${cfg.explanationQuality}`
  return { bid: true, priceSol, note: metrics }
}
