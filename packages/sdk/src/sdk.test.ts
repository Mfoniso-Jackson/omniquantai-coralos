import test from 'node:test'
import assert from 'node:assert/strict'
import { FinancialAgent } from './agent.js'
import { AgentRegistry } from './registry.js'
import { defaultSimulationContext, simulateManifest, simulateMarket } from './simulator.js'
import { validateAgentManifest } from './manifest.js'
import { signedAuthHeaders, signingPayload } from './auth.js'
import type { AgentManifest, MarketContext } from './types.js'

const manifest: AgentManifest = {
  id: 'test-agent',
  name: 'Test Agent',
  version: '0.1.0',
  author: 'OmniQuantAI',
  description: 'Test financial intelligence agent.',
  specialization: 'Testing',
  supportedMarkets: ['omniquant'],
  capabilities: ['equities', 'valuation'],
  pricing: { floorSol: 0.01, suggestedSol: 0.012, currency: 'SOL' },
  riskLevel: 'low',
  license: 'MIT',
}

class TestAgent extends FinancialAgent {
  constructor() {
    super(manifest)
  }

  async evaluate() {
    return { supported: true, confidence: 80, rationale: 'supported' }
  }

  async bid(context: MarketContext) {
    return this.createBid(context, { priceSol: 0.012, confidence: 80, deliveryTimeSeconds: 20, reasoning: 'test edge' })
  }

  async generateMemo(context: MarketContext) {
    return this.createMemo(context, { recommendation: 'HOLD', confidence: 70, executiveSummary: 'test memo' })
  }
}

test('validates manifests and rejects unsupported capabilities', () => {
  assert.equal(validateAgentManifest(manifest).ok, true)
  assert.deepEqual(validateAgentManifest(null), { ok: false, errors: ['manifest must be an object'] })
  const invalid = validateAgentManifest({ ...manifest, capabilities: ['unknown'] })
  assert.equal(invalid.ok, false)
  assert.match(invalid.errors.join('\n'), /unsupported capability/)
})

test('registry discovers active agents by capability', () => {
  const registry = new AgentRegistry()
  registry.register(manifest, 'active')
  assert.equal(registry.discover({ market: 'omniquant', capabilities: ['valuation'] }).length, 1)
  assert.equal(registry.discover({ market: 'omniquant', capabilities: ['macro'] }).length, 0)
})

test('registry updates preserve registration time', () => {
  const registry = new AgentRegistry()
  const registered = registry.register(manifest, 'pending')
  const updated = registry.update({ ...manifest, version: '0.1.1' }, 'active')
  assert.equal(updated.registeredAt, registered.registeredAt)
  assert.equal(registry.get(manifest.id)?.registeredAt, registered.registeredAt)
  assert.equal(registry.get(manifest.id)?.status, 'active')
})

test('simulates a complete agent lifecycle', async () => {
  const result = await simulateMarket(new TestAgent(), {
    sessionId: 's',
    round: 1,
    service: 'omniquant',
    argument: 'nvda-3-6m-exposure',
    budgetSol: 0.03,
    asset: 'NVDA',
  })
  assert.equal(result.bid.agentId, 'test-agent')
  assert.equal(result.memo.notFinancialAdvice, true)
  assert.equal(result.verification.status, 'PASS')
})

test('simulates a manifest without importing third-party agent code', async () => {
  const result = await simulateManifest(manifest, defaultSimulationContext({ capabilitiesRequested: ['valuation'] }))
  assert.equal(result.bid.agentId, 'test-agent')
  assert.equal(result.memo.recommendation, 'HOLD')
})

test('creates signed publisher auth headers', () => {
  const headers = signedAuthHeaders({
    method: 'POST',
    path: '/api/agents/register',
    body: '{"ok":true}',
    publisherId: 'publisher',
    secret: 'secret',
    timestamp: '2026-07-17T00:00:00.000Z',
  })
  assert.equal(headers['x-oq-publisher'], 'publisher')
  assert.equal(headers['x-oq-timestamp'], '2026-07-17T00:00:00.000Z')
  assert.match(headers['x-oq-signature'], /^[a-f0-9]{64}$/)
  assert.equal(signingPayload('post', '/p', 't', 'b'), 'POST\n/p\nt\nb')
})
