import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dataDirFromEnv } from './history.js'

export type RegistryStatus = 'pending' | 'active' | 'verified' | 'suspended'

export interface AgentManifestRecord {
  id: string
  name: string
  version: string
  author: string
  description: string
  specialization: string
  supportedMarkets: string[]
  capabilities: string[]
  pricing: {
    floorSol: number
    suggestedSol?: number
    currency: string
  }
  dependencies?: string[]
  requiredData?: string[]
  riskLevel: 'low' | 'medium' | 'high'
  homepage?: string
  repository?: string
  license: string
}

export interface AgentRegistrationRecord {
  manifest: AgentManifestRecord
  status: RegistryStatus
  registeredAt: string
  updatedAt: string
}

export interface RegistryDiscoveryInput {
  market?: string
  capabilities?: string[]
}

const KNOWN_CAPABILITIES = new Set([
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
])

export async function registerAgentManifest(
  manifest: unknown,
  input: { status?: RegistryStatus; dataDir?: string } = {},
): Promise<AgentRegistrationRecord> {
  const validManifest = validateManifestOrThrow(manifest)
  const existing = await getRegisteredAgent(validManifest.id, input.dataDir)
  const now = new Date().toISOString()
  const registration: AgentRegistrationRecord = {
    manifest: validManifest,
    status: input.status ?? existing?.status ?? 'pending',
    registeredAt: existing?.registeredAt ?? now,
    updatedAt: now,
  }
  await appendRegistryRecord(registration, input.dataDir)
  return registration
}

export async function updateAgentManifest(
  id: string,
  manifest: unknown,
  input: { status?: RegistryStatus; dataDir?: string } = {},
): Promise<AgentRegistrationRecord> {
  const validManifest = validateManifestOrThrow(manifest)
  if (validManifest.id !== id) throw new Error(`manifest id ${validManifest.id} does not match route id ${id}`)
  return registerAgentManifest(validManifest, input)
}

export async function listRegisteredAgents(dataDir = dataDirFromEnv()): Promise<AgentRegistrationRecord[]> {
  const records = await readRegistryRecords(dataDir)
  const byAgent = new Map<string, AgentRegistrationRecord>()
  for (const record of records) {
    const current = byAgent.get(record.manifest.id)
    if (!current || record.updatedAt.localeCompare(current.updatedAt) >= 0) byAgent.set(record.manifest.id, record)
  }
  return [...byAgent.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}

export async function getRegisteredAgent(id: string, dataDir = dataDirFromEnv()): Promise<AgentRegistrationRecord | undefined> {
  return (await listRegisteredAgents(dataDir)).find((agent) => agent.manifest.id === id)
}

export async function discoverRegisteredAgents(
  input: RegistryDiscoveryInput,
  dataDir = dataDirFromEnv(),
): Promise<AgentRegistrationRecord[]> {
  return (await listRegisteredAgents(dataDir)).filter((agent) => {
    if (agent.status !== 'active' && agent.status !== 'verified') return false
    if (input.market && !agent.manifest.supportedMarkets.includes(input.market)) return false
    if (input.capabilities?.length && !input.capabilities.every((capability) => agent.manifest.capabilities.includes(capability))) return false
    return true
  })
}

function validateManifestOrThrow(input: unknown): AgentManifestRecord {
  const errors = validateManifest(input)
  if (errors.length > 0) throw new Error(`Invalid agent manifest: ${errors.join('; ')}`)
  return input as AgentManifestRecord
}

export function validateManifest(input: unknown): string[] {
  const errors: string[] = []
  if (!input || typeof input !== 'object') return ['manifest must be an object']
  const manifest = input as Partial<AgentManifestRecord>
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
      if (!KNOWN_CAPABILITIES.has(String(capability))) errors.push(`unsupported capability: ${String(capability)}`)
    }
  }
  if (!manifest.pricing || typeof manifest.pricing.floorSol !== 'number' || manifest.pricing.floorSol < 0) errors.push('pricing.floorSol must be a non-negative number')
  if (manifest.pricing && manifest.pricing.currency !== 'SOL') errors.push('pricing.currency must be SOL')
  if (!['low', 'medium', 'high'].includes(String(manifest.riskLevel))) errors.push('riskLevel must be low, medium, or high')
  return errors
}

async function appendRegistryRecord(record: AgentRegistrationRecord, dataDir = dataDirFromEnv()): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await appendFile(join(dataDir, 'agent_registry.jsonl'), `${JSON.stringify(record)}\n`, 'utf8')
}

async function readRegistryRecords(dataDir: string): Promise<AgentRegistrationRecord[]> {
  try {
    const text = await readFile(join(dataDir, 'agent_registry.jsonl'), 'utf8')
    return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as AgentRegistrationRecord)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function requiredString(errors: string[], value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${field} is required`)
}
