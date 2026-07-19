import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MemoReviewStatus, MemoWorkspaceRecord } from './models.js'
import { mirrorCollectionRecord, readCollectionRecord, readCollectionRecords } from './supabasePersistence.js'

const statuses = new Set<MemoReviewStatus>(['Needs Review', 'Approved', 'Watchlist', 'Rejected'])

function dataDirFromEnv(): string {
  return process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
}

export interface WorkspacePatch {
  memoId?: string
  reviewStatus?: MemoReviewStatus
  note?: string
  reviewer?: string
  exportReady?: boolean
  recordExport?: boolean
  exportNote?: string
  actor?: string
}

export async function listMemoWorkspaces(dataDir = dataDirFromEnv()): Promise<MemoWorkspaceRecord[]> {
  const records = await readRecords<MemoWorkspaceRecord>(dataDir, 'memo_workspace')
  return latestBy(records, (record) => record.sessionId, (record) => record.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getMemoWorkspace(sessionId: string, dataDir = dataDirFromEnv()): Promise<MemoWorkspaceRecord | undefined> {
  const records = await readRecords<MemoWorkspaceRecord>(dataDir, 'memo_workspace', { column: 'session_id', value: sessionId })
  return latestBy(records, (record) => record.sessionId, (record) => record.updatedAt)[0]
}

export async function upsertMemoWorkspace(
  sessionId: string,
  patch: WorkspacePatch,
  dataDir = dataDirFromEnv(),
): Promise<MemoWorkspaceRecord> {
  validatePatch(patch)
  const now = new Date().toISOString()
  const current = await getMemoWorkspace(sessionId, dataDir)
  const exportHistory = current?.exportHistory ? [...current.exportHistory] : []
  if (patch.recordExport) {
    exportHistory.push({
      id: `${sessionId}:export:${now}`,
      timestamp: now,
      actor: cleanOptional(patch.actor) ?? cleanOptional(patch.reviewer),
      note: cleanOptional(patch.exportNote),
    })
  }
  const next: MemoWorkspaceRecord = {
    id: current?.id ?? `${sessionId}:workspace`,
    sessionId,
    memoId: cleanOptional(patch.memoId) ?? current?.memoId,
    reviewStatus: patch.reviewStatus ?? current?.reviewStatus ?? 'Needs Review',
    note: typeof patch.note === 'string' ? patch.note : current?.note ?? '',
    reviewer: cleanOptional(patch.reviewer) ?? current?.reviewer,
    exportReady: typeof patch.exportReady === 'boolean' ? patch.exportReady : current?.exportReady ?? false,
    exportHistory,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  }
  if (process.env.OMNIQUANT_PERSIST !== '0') {
    await mkdir(dataDir, { recursive: true })
    await appendFile(join(dataDir, 'memo_workspace.jsonl'), `${JSON.stringify(next)}\n`, 'utf8')
    await mirrorCollectionRecord('memo_workspace', next)
  }
  return next
}

function validatePatch(patch: WorkspacePatch): void {
  if (patch.reviewStatus !== undefined && !statuses.has(patch.reviewStatus)) {
    throw new Error(`invalid review status: ${String(patch.reviewStatus)}`)
  }
  if (patch.note !== undefined && typeof patch.note !== 'string') throw new Error('note must be a string')
  if (patch.reviewer !== undefined && typeof patch.reviewer !== 'string') throw new Error('reviewer must be a string')
  if (patch.exportReady !== undefined && typeof patch.exportReady !== 'boolean') throw new Error('exportReady must be a boolean')
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

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
