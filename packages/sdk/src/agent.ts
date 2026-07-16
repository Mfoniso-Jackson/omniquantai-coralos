import type {
  AgentEvaluation,
  AgentManifest,
  BidResponse,
  Capability,
  MarketContext,
  MemoInput,
  MemoResponse,
  VerificationResponse,
} from './types.js'
import { validateAgentManifest } from './manifest.js'

export abstract class FinancialAgent {
  readonly manifest: AgentManifest

  protected constructor(manifest: AgentManifest) {
    const result = validateAgentManifest(manifest)
    if (!result.ok) throw new Error(`Invalid agent manifest: ${result.errors.join('; ')}`)
    this.manifest = manifest
  }

  get id(): string { return this.manifest.id }
  get name(): string { return this.manifest.name }
  get description(): string { return this.manifest.description }
  get capabilities(): Capability[] { return this.manifest.capabilities }
  get markets(): string[] { return this.manifest.supportedMarkets }
  get version(): string { return this.manifest.version }
  get author(): string { return this.manifest.author }

  abstract evaluate(context: MarketContext): Promise<AgentEvaluation>
  abstract bid(context: MarketContext): Promise<BidResponse>
  abstract generateMemo(context: MarketContext): Promise<MemoResponse>

  async verify(memo: MemoResponse): Promise<VerificationResponse> {
    const checks = [
      memo.executiveSummary ? 'PASS: executive summary present' : 'FAIL: executive summary missing',
      memo.recommendation ? 'PASS: recommendation present' : 'FAIL: recommendation missing',
      memo.notFinancialAdvice ? 'PASS: disclaimer flag present' : 'FAIL: disclaimer flag missing',
    ]
    const pass = checks.every((check) => check.startsWith('PASS'))
    return { status: pass ? 'PASS' : 'FAIL', score: pass ? 100 : 60, checks, decision: pass ? 'Release escrow' : 'Hold for review' }
  }

  protected createBid(context: MarketContext, input: Omit<BidResponse, 'agentId' | 'capabilities'>): BidResponse {
    const priceSol = Math.min(context.budgetSol, Math.max(this.manifest.pricing.floorSol, input.priceSol))
    return {
      agentId: this.id,
      priceSol,
      confidence: input.confidence,
      deliveryTimeSeconds: input.deliveryTimeSeconds,
      reasoning: input.reasoning,
      capabilities: this.capabilities,
    }
  }

  protected createMemo(_context: MarketContext, input: MemoInput): MemoResponse {
    return {
      ...input,
      agentId: this.id,
      generatedAt: new Date().toISOString(),
      notFinancialAdvice: true,
      disclaimer: input.disclaimer ?? 'Not financial advice. Research support only.',
    }
  }
}
