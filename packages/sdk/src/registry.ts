import type { AgentManifest, AgentRegistration, AgentStatus, Capability } from './types.js'
import { supportsCapability, validateAgentManifest } from './manifest.js'

export class AgentRegistry {
  private readonly agents = new Map<string, AgentRegistration>()

  register(manifest: AgentManifest, status: AgentStatus = 'pending'): AgentRegistration {
    const result = validateAgentManifest(manifest)
    if (!result.ok) throw new Error(`Invalid agent manifest: ${result.errors.join('; ')}`)
    const registration: AgentRegistration = { manifest, status, registeredAt: new Date().toISOString() }
    this.agents.set(manifest.id, registration)
    return registration
  }

  update(manifest: AgentManifest, status?: AgentStatus): AgentRegistration {
    const existing = this.agents.get(manifest.id)
    const result = validateAgentManifest(manifest)
    if (!result.ok) throw new Error(`Invalid agent manifest: ${result.errors.join('; ')}`)
    const registration: AgentRegistration = {
      manifest,
      status: status ?? existing?.status ?? 'pending',
      registeredAt: existing?.registeredAt ?? new Date().toISOString(),
    }
    this.agents.set(manifest.id, registration)
    return registration
  }

  get(id: string): AgentRegistration | undefined {
    return this.agents.get(id)
  }

  list(): AgentRegistration[] {
    return [...this.agents.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
  }

  discover(input: { market?: string; capabilities?: Capability[] }): AgentRegistration[] {
    return this.list().filter((registration) => {
      if (registration.status !== 'active' && registration.status !== 'verified') return false
      if (input.market && !registration.manifest.supportedMarkets.includes(input.market)) return false
      if (input.capabilities && !supportsCapability(registration.manifest, input.capabilities)) return false
      return true
    })
  }
}
