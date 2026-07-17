import { FinancialAgent } from './agent.js'
import type { AgentManifest, BidResponse, MarketContext, MemoResponse, VerificationResponse } from './types.js'

export interface SimulatedMarketResult {
  context: MarketContext
  bid: BidResponse
  memo: MemoResponse
  verification: VerificationResponse
}

export async function simulateMarket(agent: FinancialAgent, context: MarketContext): Promise<SimulatedMarketResult> {
  const evaluation = await agent.evaluate(context)
  if (!evaluation.supported) throw new Error(`Agent does not support market: ${evaluation.unsupportedReason ?? evaluation.rationale}`)
  const bid = await agent.bid(context)
  const memo = await agent.generateMemo(context)
  const verification = await agent.verify(memo)
  return { context, bid, memo, verification }
}

export function defaultSimulationContext(input: Partial<MarketContext> = {}): MarketContext {
  return {
    sessionId: input.sessionId ?? 'local-simulation',
    round: input.round ?? 1,
    service: input.service ?? 'omniquant',
    argument: input.argument ?? 'Should our fund increase exposure to Nvidia over the next 3-6 months?',
    asset: input.asset ?? 'NVDA',
    budgetSol: input.budgetSol ?? 0.03,
    capabilitiesRequested: input.capabilitiesRequested,
    dataSources: input.dataSources,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

export async function simulateManifest(manifest: AgentManifest, context: MarketContext = defaultSimulationContext()): Promise<SimulatedMarketResult> {
  return simulateMarket(new ManifestSimulationAgent(manifest), context)
}

class ManifestSimulationAgent extends FinancialAgent {
  constructor(manifest: AgentManifest) {
    super(manifest)
  }

  async evaluate(context: MarketContext) {
    const capabilityMatch = !context.capabilitiesRequested?.length
      || context.capabilitiesRequested.some((capability) => this.capabilities.includes(capability))
    const marketMatch = this.markets.includes(context.service)
    const supported = marketMatch && capabilityMatch
    return {
      supported,
      confidence: supported ? 76 : 42,
      rationale: supported
        ? `${this.name} supports ${context.service} with ${this.capabilities.join(', ')} capabilities.`
        : `${this.name} does not match requested market or capabilities.`,
      unsupportedReason: supported ? undefined : 'market or capability mismatch',
    }
  }

  async bid(context: MarketContext) {
    return this.createBid(context, {
      priceSol: this.manifest.pricing.suggestedSol ?? this.manifest.pricing.floorSol,
      confidence: 76,
      deliveryTimeSeconds: 30,
      reasoning: `Simulated bid from ${this.name}: ${this.manifest.specialization}`,
    })
  }

  async generateMemo(context: MarketContext) {
    return this.createMemo(context, {
      recommendation: 'HOLD',
      confidence: 70,
      executiveSummary: `${this.name} generated a local simulation memo for ${context.asset ?? context.argument}.`,
      baseCase: `${this.manifest.specialization} supports maintaining exposure until live evidence changes the view.`,
      risks: ['Simulation uses manifest metadata only', 'No live market data fetched', 'No trade execution'],
      evidence: [
        { source: 'agent.json', label: 'capabilities', value: this.capabilities },
        { source: 'agent.json', label: 'pricing', value: this.manifest.pricing },
      ],
      disclaimer: 'Not financial advice. Local SDK simulation only.',
    })
  }
}
