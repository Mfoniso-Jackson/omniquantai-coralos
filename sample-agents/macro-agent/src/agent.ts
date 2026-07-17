import { FinancialAgent, type MarketContext } from '../../../packages/sdk/src/index.js'
import manifest from '../agent.json' assert { type: 'json' }

export class MacroRegimeAgent extends FinancialAgent {
  constructor() {
    super(manifest)
  }

  async evaluate(context: MarketContext) {
    const relevant = /rates|macro|liquidity|inflation|exposure|nvda|nvidia/i.test(context.argument)
    return {
      supported: context.service === 'omniquant' && relevant,
      confidence: relevant ? 79 : 52,
      rationale: relevant
        ? 'The request needs macro regime context before changing exposure.'
        : 'The request has limited explicit macro content.',
    }
  }

  async bid(context: MarketContext) {
    return this.createBid(context, {
      priceSol: manifest.pricing.suggestedSol ?? manifest.pricing.floorSol,
      confidence: 79,
      deliveryTimeSeconds: 28,
      reasoning: 'Adds rates, liquidity, inflation, and growth-equity regime risk to the memo.',
    })
  }

  async generateMemo(context: MarketContext) {
    return this.createMemo(context, {
      recommendation: 'HOLD',
      confidence: 73,
      executiveSummary: 'Macro conditions are supportive enough to maintain exposure, but rate and liquidity sensitivity argue against aggressive sizing without confirmation.',
      bullCase: ['Liquidity improves and long-duration growth multiples expand.', 'AI capex remains resilient through the next earnings cycle.'],
      baseCase: ['Maintain exposure while monitoring rates, credit spreads, and dollar strength.'],
      bearCase: ['Higher real yields compress valuation multiples and reduce tolerance for crowded positioning.'],
      risks: ['Rate volatility', 'USD strength', 'Risk-off liquidity shocks', 'Capex digestion'],
      whatWouldChangeView: ['Sustained easing in real yields', 'Broadening market participation', 'Evidence of AI demand resilience through macro pressure'],
      disclaimer: 'Not financial advice. Research support only.',
    })
  }
}
