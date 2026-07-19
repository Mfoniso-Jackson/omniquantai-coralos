import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getMemoWorkspace, listMemoWorkspaces, upsertMemoWorkspace } from './workspaceStore.js'

describe('workspaceStore', () => {
  it('persists latest memo review state by session', async () => {
    const dataDir = await tempDataDir()
    await upsertMemoWorkspace('session-1', {
      memoId: 'memo-1',
      reviewStatus: 'Needs Review',
      reviewer: 'Analyst A',
      note: 'Initial read.',
      exportReady: false,
    }, dataDir)
    await upsertMemoWorkspace('session-1', {
      reviewStatus: 'Approved',
      note: 'Approved for IC packet.',
      exportReady: true,
      recordExport: true,
      exportNote: 'Shared with design partner.',
      actor: 'Analyst A',
    }, dataDir)

    await expect(getMemoWorkspace('session-1', dataDir)).resolves.toMatchObject({
      sessionId: 'session-1',
      memoId: 'memo-1',
      reviewStatus: 'Approved',
      note: 'Approved for IC packet.',
      exportReady: true,
      exportHistory: [{ actor: 'Analyst A', note: 'Shared with design partner.' }],
    })
  })

  it('lists one latest workspace record per session', async () => {
    const dataDir = await tempDataDir()
    await upsertMemoWorkspace('session-1', { reviewStatus: 'Watchlist' }, dataDir)
    await upsertMemoWorkspace('session-2', { reviewStatus: 'Rejected' }, dataDir)
    await upsertMemoWorkspace('session-1', { reviewStatus: 'Approved' }, dataDir)

    const records = await listMemoWorkspaces(dataDir)
    expect(records).toHaveLength(2)
    expect(records.find((record) => record.sessionId === 'session-1')?.reviewStatus).toBe('Approved')
  })
})

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'omniquant-workspace-'))
}
