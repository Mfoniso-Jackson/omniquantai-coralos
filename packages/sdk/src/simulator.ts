import type { FinancialAgent } from './agent.js'
import type { BidResponse, MarketContext, MemoResponse, VerificationResponse } from './types.js'

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
