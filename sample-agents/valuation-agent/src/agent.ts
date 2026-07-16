import { FinancialAgent, type MarketContext } from '../../../packages/sdk/src/index.js'
import manifest from '../agent.json' assert { type: 'json' }

export class ValuationAgent extends FinancialAgent {
  constructor() {
    super(manifest)
  }

  async evaluate(context: MarketContext) {
    const supported = context.service === 'omniquant' && context.budgetSol >= manifest.pricing.floorSol
    return {
      supported,
      confidence: supported ? 84 : 0,
      rationale: supported ? 'Equity valuation request fits my capabilities.' : 'Unsupported service or budget below floor.',
      unsupportedReason: supported ? undefined : 'Unsupported market context.',
    }
  }

  async bid(context: MarketContext) {
    return this.createBid(context, {
      priceSol: manifest.pricing.suggestedSol ?? manifest.pricing.floorSol,
      confidence: 84,
      deliveryTimeSeconds: 35,
      reasoning: 'Valuation and margin-of-safety specialist.',
    })
  }

  async generateMemo(context: MarketContext) {
    return this.createMemo(context, {
      recommendation: 'HOLD',
      confidence: 73,
      executiveSummary: `${context.asset ?? 'The asset'} has durable fundamentals, but valuation risk limits aggressive position sizing.`,
      bullCase: 'Earnings revisions and cash-flow durability can justify a premium multiple.',
      baseCase: 'Fundamentals remain strong but forward returns depend on valuation discipline.',
      bearCase: 'Multiple compression can overwhelm fundamental growth over the next 3-6 months.',
      risks: ['Valuation compression', 'Consensus revision risk', 'Crowded positioning'],
      evidence: [{ source: 'valuation-agent', finding: 'Margin of safety is moderate, not extreme.' }],
      disclaimer: 'Not financial advice. Research support only.',
    })
  }
}
