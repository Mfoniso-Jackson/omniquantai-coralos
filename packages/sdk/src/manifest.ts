import type { AgentManifest, Capability } from './types.js'

export const capabilities: Capability[] = [
  'equities',
  'crypto',
  'macro',
  'commodities',
  'options',
  'fx',
  'valuation',
  'sentiment',
  'portfolio-construction',
  'verification',
  'summarization',
  'screening',
  'risk-analysis',
  'technical-analysis',
  'news-analysis',
]

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateAgentManifest(input: unknown): ValidationResult {
  const errors: string[] = []
  if (!input || typeof input !== 'object') return { ok: false, errors: ['manifest must be an object'] }
  const manifest = input as Partial<AgentManifest>
  requiredString(errors, manifest.id, 'id')
  requiredString(errors, manifest.name, 'name')
  requiredString(errors, manifest.version, 'version')
  requiredString(errors, manifest.author, 'author')
  requiredString(errors, manifest.description, 'description')
  requiredString(errors, manifest.specialization, 'specialization')
  requiredString(errors, manifest.license, 'license')
  if (!Array.isArray(manifest.supportedMarkets) || manifest.supportedMarkets.length === 0) errors.push('supportedMarkets must be a non-empty array')
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    errors.push('capabilities must be a non-empty array')
  } else {
    for (const capability of manifest.capabilities) {
      if (!capabilities.includes(capability as Capability)) errors.push(`unsupported capability: ${String(capability)}`)
    }
  }
  if (!manifest.pricing || typeof manifest.pricing.floorSol !== 'number' || manifest.pricing.floorSol < 0) {
    errors.push('pricing.floorSol must be a non-negative number')
  }
  if (!['low', 'medium', 'high'].includes(String(manifest.riskLevel))) errors.push('riskLevel must be low, medium, or high')
  return { ok: errors.length === 0, errors }
}

export function supportsCapability(manifest: AgentManifest, requested: Capability[]): boolean {
  return requested.every((capability) => manifest.capabilities.includes(capability))
}

function requiredString(errors: string[], value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${field} is required`)
}
