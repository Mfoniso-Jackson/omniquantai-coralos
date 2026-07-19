import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  WorkspaceMembershipAuditAction,
  WorkspaceMembershipAuditRecord,
  WorkspaceMembershipRecord,
  WorkspaceRole,
} from './models.js'

const roles = new Set<WorkspaceRole>(['owner', 'admin', 'editor', 'viewer'])
const editableRoles = new Set<WorkspaceRole>(['owner', 'admin', 'editor'])
const adminRoles = new Set<WorkspaceRole>(['owner', 'admin'])

function dataDirFromEnv(): string {
  return process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
}

export interface MembershipPatch {
  publisherId: string
  role: WorkspaceRole
  displayName?: string
  status?: 'active' | 'revoked'
  grantedBy?: string
}

export async function listWorkspaceMemberships(sessionId: string, dataDir = dataDirFromEnv()): Promise<WorkspaceMembershipRecord[]> {
  const records = await readJsonl<WorkspaceMembershipRecord>(dataDir, 'workspace_memberships')
  return latestBy(
    records.filter((record) => record.sessionId === sessionId),
    (record) => `${record.sessionId}:${record.publisherId}`,
    (record) => record.updatedAt,
  ).sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.publisherId.localeCompare(b.publisherId))
}

export async function listWorkspaceMembershipAudit(sessionId: string, dataDir = dataDirFromEnv()): Promise<WorkspaceMembershipAuditRecord[]> {
  const records = await readJsonl<WorkspaceMembershipAuditRecord>(dataDir, 'workspace_membership_audit')
  return records
    .filter((record) => record.sessionId === sessionId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function getWorkspaceMembership(
  sessionId: string,
  publisherId: string,
  dataDir = dataDirFromEnv(),
): Promise<WorkspaceMembershipRecord | undefined> {
  return (await listWorkspaceMemberships(sessionId, dataDir))
    .find((record) => record.publisherId === publisherId && record.status === 'active')
}

async function getLatestWorkspaceMembership(
  sessionId: string,
  publisherId: string,
  dataDir = dataDirFromEnv(),
): Promise<WorkspaceMembershipRecord | undefined> {
  return (await listWorkspaceMemberships(sessionId, dataDir))
    .find((record) => record.publisherId === publisherId)
}

export async function upsertWorkspaceMembership(
  sessionId: string,
  patch: MembershipPatch,
  dataDir = dataDirFromEnv(),
): Promise<WorkspaceMembershipRecord> {
  validateMembershipPatch(patch)
  const now = new Date().toISOString()
  const current = await getLatestWorkspaceMembership(sessionId, patch.publisherId, dataDir)
  const next: WorkspaceMembershipRecord = {
    id: current?.id ?? `${sessionId}:member:${patch.publisherId}`,
    sessionId,
    publisherId: patch.publisherId.trim(),
    role: patch.role,
    displayName: cleanOptional(patch.displayName) ?? current?.displayName,
    status: patch.status ?? current?.status ?? 'active',
    grantedBy: cleanOptional(patch.grantedBy) ?? current?.grantedBy,
    grantedAt: current?.grantedAt ?? now,
    updatedAt: now,
  }
  if (process.env.OMNIQUANT_PERSIST !== '0') {
    await mkdir(dataDir, { recursive: true })
    await appendFile(join(dataDir, 'workspace_memberships.jsonl'), `${JSON.stringify(next)}\n`, 'utf8')
    await appendFile(join(dataDir, 'workspace_membership_audit.jsonl'), `${JSON.stringify(auditRecord(sessionId, current, next, now))}\n`, 'utf8')
  }
  return next
}

export async function ensureWorkspacePermission(input: {
  sessionId: string
  publisherId?: string
  action: 'edit' | 'admin'
  dataDir?: string
}): Promise<WorkspaceMembershipRecord | undefined> {
  if (!input.publisherId) return undefined
  const dataDir = input.dataDir ?? dataDirFromEnv()
  const members = await listWorkspaceMemberships(input.sessionId, dataDir)
  const activeMembers = members.filter((member) => member.status === 'active')
  if (activeMembers.length === 0 && process.env.WORKSPACE_AUTO_GRANT_FIRST_OWNER !== '0') {
    return upsertWorkspaceMembership(input.sessionId, {
      publisherId: input.publisherId,
      role: 'owner',
      grantedBy: 'system:first-signed-writer',
    }, dataDir)
  }
  const member = activeMembers.find((record) => record.publisherId === input.publisherId)
  if (!member) throw new Error(`workspace membership required for publisher ${input.publisherId}`)
  const allowed = input.action === 'admin' ? adminRoles.has(member.role) : editableRoles.has(member.role)
  if (!allowed) throw new Error(`workspace ${input.action} permission denied for role ${member.role}`)
  return member
}

function validateMembershipPatch(patch: MembershipPatch): void {
  if (!patch.publisherId?.trim()) throw new Error('publisherId is required')
  if (!roles.has(patch.role)) throw new Error(`invalid workspace role: ${String(patch.role)}`)
  if (patch.status !== undefined && patch.status !== 'active' && patch.status !== 'revoked') throw new Error(`invalid membership status: ${String(patch.status)}`)
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

function latestBy<T>(items: T[], keyFn: (item: T) => string, timeFn: (item: T) => string | undefined): T[] {
  const byKey = new Map<string, T>()
  for (const item of items) {
    const key = keyFn(item)
    const current = byKey.get(key)
    if (!current || (timeFn(item) ?? '').localeCompare(timeFn(current) ?? '') >= 0) byKey.set(key, item)
  }
  return [...byKey.values()]
}

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function roleRank(role: WorkspaceRole): number {
  return role === 'owner' ? 0 : role === 'admin' ? 1 : role === 'editor' ? 2 : 3
}

function auditRecord(
  sessionId: string,
  current: WorkspaceMembershipRecord | undefined,
  next: WorkspaceMembershipRecord,
  timestamp: string,
): WorkspaceMembershipAuditRecord {
  return {
    id: `${sessionId}:membership-audit:${next.publisherId}:${timestamp}`,
    sessionId,
    publisherId: next.publisherId,
    action: auditAction(current, next),
    fromRole: current?.role,
    toRole: next.role,
    fromStatus: current?.status,
    toStatus: next.status,
    actor: next.grantedBy,
    displayName: next.displayName,
    timestamp,
  }
}

function auditAction(current: WorkspaceMembershipRecord | undefined, next: WorkspaceMembershipRecord): WorkspaceMembershipAuditAction {
  if (!current) return 'invited'
  if (current.status === 'revoked' && next.status === 'active') return 'restored'
  if (next.status === 'revoked' && current.status !== 'revoked') return 'revoked'
  if (current.role === next.role) return 'role_changed'
  const currentRank = roleRank(current.role)
  const nextRank = roleRank(next.role)
  if (nextRank < currentRank) return 'promoted'
  if (nextRank > currentRank) return 'demoted'
  return 'role_changed'
}
