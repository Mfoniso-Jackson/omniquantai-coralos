import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OrganizationSessionRecord, OrganizationWorkspaceRecord } from './models.js'
import { mirrorCollectionRecord, readCollectionRecord, readCollectionRecords } from './supabasePersistence.js'

function dataDirFromEnv(): string {
  return process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
}

export interface OrganizationPatch {
  id?: string
  name: string
  slug?: string
  status?: 'active' | 'archived'
  createdBy?: string
}

export async function listOrganizations(dataDir = dataDirFromEnv()): Promise<OrganizationWorkspaceRecord[]> {
  const records = await readRecords<OrganizationWorkspaceRecord>(dataDir, 'organization_workspaces')
  return latestBy(records, (record) => record.id, (record) => record.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getOrganization(id: string, dataDir = dataDirFromEnv()): Promise<OrganizationWorkspaceRecord | undefined> {
  return (await listOrganizations(dataDir)).find((record) => record.id === id || record.slug === id)
}

export async function upsertOrganization(
  patch: OrganizationPatch,
  dataDir = dataDirFromEnv(),
): Promise<OrganizationWorkspaceRecord> {
  if (!patch.name?.trim()) throw new Error('organization name is required')
  const now = new Date().toISOString()
  const slug = cleanSlug(patch.slug ?? patch.name)
  const id = patch.id?.trim() || slug
  const current = await getOrganization(id, dataDir)
  const next: OrganizationWorkspaceRecord = {
    id,
    name: patch.name.trim(),
    slug,
    status: patch.status ?? current?.status ?? 'active',
    createdBy: cleanOptional(patch.createdBy) ?? current?.createdBy,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  }
  await writeRecord(dataDir, 'organization_workspaces', next)
  return next
}

export async function assignSessionToOrganization(input: {
  organizationId: string
  sessionId: string
  assignedBy?: string
  dataDir?: string
}): Promise<OrganizationSessionRecord> {
  const dataDir = input.dataDir ?? dataDirFromEnv()
  if (!input.organizationId.trim()) throw new Error('organizationId is required')
  if (!input.sessionId.trim()) throw new Error('sessionId is required')
  const organization = await getOrganization(input.organizationId, dataDir)
  if (!organization) throw new Error(`organization not found: ${input.organizationId}`)
  const now = new Date().toISOString()
  const current = await getSessionOrganization(input.sessionId, dataDir)
  const next: OrganizationSessionRecord = {
    id: `${organization.id}:session:${input.sessionId}`,
    organizationId: organization.id,
    sessionId: input.sessionId,
    assignedBy: cleanOptional(input.assignedBy) ?? current?.assignedBy,
    assignedAt: current?.assignedAt ?? now,
    updatedAt: now,
  }
  await writeRecord(dataDir, 'organization_sessions', next)
  return next
}

export async function listOrganizationSessions(organizationId: string, dataDir = dataDirFromEnv()): Promise<OrganizationSessionRecord[]> {
  const organization = await getOrganization(organizationId, dataDir)
  if (!organization) return []
  const records = await readRecords<OrganizationSessionRecord>(dataDir, 'organization_sessions', { column: 'organization_id', value: organization.id })
  return latestBy(
    records.filter((record) => record.organizationId === organization.id),
    (record) => record.sessionId,
    (record) => record.updatedAt,
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function listOrganizationAssignments(dataDir = dataDirFromEnv()): Promise<OrganizationSessionRecord[]> {
  const records = await readRecords<OrganizationSessionRecord>(dataDir, 'organization_sessions')
  return latestBy(records, (record) => record.sessionId, (record) => record.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getSessionOrganization(sessionId: string, dataDir = dataDirFromEnv()): Promise<OrganizationSessionRecord | undefined> {
  return (await listOrganizationAssignments(dataDir)).find((record) => record.sessionId === sessionId)
}

async function writeRecord(dataDir: string, collection: string, value: unknown): Promise<void> {
  if (process.env.OMNIQUANT_PERSIST === '0') return
  await mkdir(dataDir, { recursive: true })
  await appendFile(join(dataDir, `${collection}.jsonl`), `${JSON.stringify(value)}\n`, 'utf8')
  await mirrorCollectionRecord(collection, value)
}

async function readJsonl<T>(dataDir: string, collection: string): Promise<T[]> {
  try {
    const text = await readFile(join(dataDir, `${collection}.jsonl`), 'utf8')
    return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readRecords<T>(dataDir: string, collection: string, filter?: { column: string; value: string }): Promise<T[]> {
  try {
    const records = filter
      ? await readCollectionRecord<T>(collection, filter.column, filter.value)
      : await readCollectionRecords<T>(collection)
    if (records) return records
  } catch (error) {
    console.error(`[feed] supabase read failed collection=${collection}: ${(error as Error).message}; falling back to JSONL`)
  }
  return readJsonl<T>(dataDir, collection)
}

function latestBy<T>(items: T[], keyFn: (item: T) => string, timeFn: (item: T) => string | undefined): T[] {
  const byKey = new Map<string, T>()
  for (const item of items) {
    const key = keyFn(item)
    const current = byKey.get(key)
    if (!current || (timeFn(item) ?? '').localeCompare(timeFn(current) ?? '') >= 0) byKey.set(key, item)
  }
  return [...byKey.values()]
}

function cleanSlug(value: string): string {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) throw new Error('organization slug is required')
  return slug
}

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
