import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureWorkspacePermission,
  getWorkspaceMembership,
  listWorkspaceMemberships,
  upsertWorkspaceMembership,
} from './workspaceMembershipStore.js'

describe('workspaceMembershipStore', () => {
  afterEach(() => {
    delete process.env.WORKSPACE_AUTO_GRANT_FIRST_OWNER
  })

  it('auto-grants first signed writer as owner for a new workspace', async () => {
    const dataDir = await tempDataDir()
    const owner = await ensureWorkspacePermission({
      sessionId: 'session-1',
      publisherId: 'research-lead',
      action: 'edit',
      dataDir,
    })
    expect(owner).toMatchObject({ publisherId: 'research-lead', role: 'owner', status: 'active' })
    await expect(getWorkspaceMembership('session-1', 'research-lead', dataDir)).resolves.toMatchObject({ role: 'owner' })
  })

  it('requires editor-or-better for memo edits', async () => {
    const dataDir = await tempDataDir()
    await upsertWorkspaceMembership('session-1', { publisherId: 'lead', role: 'owner' }, dataDir)
    await upsertWorkspaceMembership('session-1', { publisherId: 'observer', role: 'viewer' }, dataDir)
    await expect(ensureWorkspacePermission({ sessionId: 'session-1', publisherId: 'observer', action: 'edit', dataDir }))
      .rejects.toThrow(/permission denied/)
    await expect(ensureWorkspacePermission({ sessionId: 'session-1', publisherId: 'lead', action: 'admin', dataDir }))
      .resolves.toMatchObject({ role: 'owner' })
  })

  it('persists latest membership role per publisher', async () => {
    const dataDir = await tempDataDir()
    await upsertWorkspaceMembership('session-1', { publisherId: 'analyst', role: 'viewer' }, dataDir)
    await upsertWorkspaceMembership('session-1', { publisherId: 'analyst', role: 'editor', grantedBy: 'lead' }, dataDir)
    const members = await listWorkspaceMemberships('session-1', dataDir)
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ publisherId: 'analyst', role: 'editor', grantedBy: 'lead' })
  })
})

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'omniquant-members-'))
}
