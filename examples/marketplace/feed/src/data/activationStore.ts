import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  ResearchActivationEventRecord,
  ResearchActivationEventType,
  ResearchFeedbackRecord,
} from './models.js'

const activationEventTypes = new Set<ResearchActivationEventType>([
  'workspace_selected',
  'workspace_created',
  'research_started',
  'memo_saved',
  'feedback_submitted',
])

function dataDirFromEnv(): string {
  return process.env.OMNIQUANT_DATA_DIR ?? '.omniquant-data'
}

export interface ActivationEventPatch {
  type: ResearchActivationEventType
  organizationId?: string
  sessionId?: string
  asset?: string
  objective?: string
  question?: string
  actor?: string
  metadata?: Record<string, unknown>
}

export interface FeedbackPatch {
  sessionId: string
  organizationId?: string
  rating: number
  outcome?: 'useful' | 'needs_follow_up' | 'not_useful'
  comment?: string
  reviewer?: string
  asset?: string
  objective?: string
}

export async function recordActivationEvent(
  patch: ActivationEventPatch,
  dataDir = dataDirFromEnv(),
): Promise<ResearchActivationEventRecord> {
  if (!activationEventTypes.has(patch.type)) throw new Error(`invalid activation event type: ${String(patch.type)}`)
  const now = new Date().toISOString()
  const record: ResearchActivationEventRecord = {
    id: `${patch.type}:${patch.sessionId ?? patch.organizationId ?? 'workspace'}:${now}:${randomUUID()}`,
    type: patch.type,
    organizationId: cleanOptional(patch.organizationId),
    sessionId: cleanOptional(patch.sessionId),
    asset: cleanOptional(patch.asset)?.toUpperCase(),
    objective: cleanOptional(patch.objective),
    question: cleanOptional(patch.question),
    actor: cleanOptional(patch.actor),
    metadata: patch.metadata,
    createdAt: now,
  }
  await appendRecord(dataDir, 'research_activation_events', record)
  return record
}

export async function listActivationEvents(dataDir = dataDirFromEnv()): Promise<ResearchActivationEventRecord[]> {
  return readJsonl<ResearchActivationEventRecord>(dataDir, 'research_activation_events')
}

export async function recordResearchFeedback(
  patch: FeedbackPatch,
  dataDir = dataDirFromEnv(),
): Promise<ResearchFeedbackRecord> {
  if (!cleanOptional(patch.sessionId)) throw new Error('sessionId is required')
  if (!Number.isFinite(patch.rating) || patch.rating < 1 || patch.rating > 5) throw new Error('rating must be between 1 and 5')
  const now = new Date().toISOString()
  const record: ResearchFeedbackRecord = {
    id: `feedback:${patch.sessionId}:${now}:${randomUUID()}`,
    sessionId: patch.sessionId.trim(),
    organizationId: cleanOptional(patch.organizationId),
    rating: Math.round(patch.rating),
    outcome: patch.outcome,
    comment: cleanOptional(patch.comment),
    reviewer: cleanOptional(patch.reviewer),
    asset: cleanOptional(patch.asset)?.toUpperCase(),
    objective: cleanOptional(patch.objective),
    createdAt: now,
  }
  await appendRecord(dataDir, 'research_feedback', record)
  return record
}

export async function listResearchFeedback(dataDir = dataDirFromEnv()): Promise<ResearchFeedbackRecord[]> {
  return readJsonl<ResearchFeedbackRecord>(dataDir, 'research_feedback')
}

async function appendRecord(dataDir: string, collection: string, record: unknown): Promise<void> {
  if (process.env.OMNIQUANT_PERSIST === '0') return
  await mkdir(dataDir, { recursive: true })
  await appendFile(join(dataDir, `${collection}.jsonl`), `${JSON.stringify(record)}\n`, 'utf8')
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

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
