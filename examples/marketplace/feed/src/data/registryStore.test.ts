import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  discoverRegisteredAgents,
  getRegisteredAgent,
  listRegisteredAgents,
  registerAgentManifest,
  transitionAgentStatus,
  updateAgentManifest,
  validateManifest,
  type AgentManifestRecord,
} from './registryStore.js'

const manifest: AgentManifestRecord = {
  id: 'valuation-agent',
  name: 'Valuation Agent',
  version: '0.1.0',
  author: 'OmniQuantAI',
  description: 'A valuation specialist.',
  specialization: 'Equity valuation',
  supportedMarkets: ['omniquant'],
  capabilities: ['equities', 'valuation'],
  pricing: { floorSol: 0.01, suggestedSol: 0.012, currency: 'SOL' },
  riskLevel: 'medium',
  license: 'MIT',
}

describe('registryStore', () => {
  it('validates manifests', () => {
    expect(validateManifest(manifest)).toEqual([])
    expect(validateManifest({ ...manifest, capabilities: ['nope'] })).toContain('unsupported capability: nope')
  })

  it('registers, updates, and preserves registeredAt', async () => {
    const dataDir = await tempDataDir()
    const registered = await registerAgentManifest(manifest, { dataDir, status: 'pending' })
    const updated = await updateAgentManifest(manifest.id, { ...manifest, version: '0.1.1' }, { dataDir, status: 'active' })
    expect(updated.registeredAt).toBe(registered.registeredAt)
    expect(updated.status).toBe('active')
    expect((await getRegisteredAgent(manifest.id, dataDir))?.manifest.version).toBe('0.1.1')
  })

  it('discovers active agents by market and capability', async () => {
    const dataDir = await tempDataDir()
    await registerAgentManifest(manifest, { dataDir, status: 'active' })
    expect(await listRegisteredAgents(dataDir)).toHaveLength(1)
    expect(await discoverRegisteredAgents({ market: 'omniquant', capabilities: ['valuation'] }, dataDir)).toHaveLength(1)
    expect(await discoverRegisteredAgents({ market: 'omniquant', capabilities: ['macro'] }, dataDir)).toHaveLength(0)
  })

  it('persists admin status transitions', async () => {
    const dataDir = await tempDataDir()
    await registerAgentManifest(manifest, { dataDir, status: 'pending' })
    await transitionAgentStatus(manifest.id, 'active', { dataDir })
    const verified = await transitionAgentStatus(manifest.id, 'verified', { dataDir })
    expect(verified.status).toBe('verified')
    await expect(transitionAgentStatus(manifest.id, 'pending', { dataDir })).rejects.toThrow(/invalid registry status transition/)
  })
})

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'omniquant-registry-'))
}
