import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assignSessionToOrganization, upsertOrganization } from './organizationStore.js'
import { upsertWorkspaceMembership } from './workspaceMembershipStore.js'
import { ensureSessionOrOrganizationPermission, organizationScope } from './workspacePermissionPolicy.js'

describe('workspacePermissionPolicy', () => {
  it('allows organization editors to edit assigned sessions', async () => {
    const dataDir = await tempDataDir()
    const organization = await upsertOrganization({ name: 'Northstar Capital Pilot' }, dataDir)
    await assignSessionToOrganization({ organizationId: organization.id, sessionId: 'session-1', dataDir })
    await upsertWorkspaceMembership(organizationScope(organization.id), { publisherId: 'analyst', role: 'editor' }, dataDir)

    await expect(ensureSessionOrOrganizationPermission({
      sessionId: 'session-1',
      publisherId: 'analyst',
      action: 'edit',
      dataDir,
    })).resolves.toBeUndefined()
  })

  it('keeps explicit session membership stricter than organization membership', async () => {
    const dataDir = await tempDataDir()
    const organization = await upsertOrganization({ name: 'Northstar Capital Pilot' }, dataDir)
    await assignSessionToOrganization({ organizationId: organization.id, sessionId: 'session-1', dataDir })
    await upsertWorkspaceMembership(organizationScope(organization.id), { publisherId: 'analyst', role: 'editor' }, dataDir)
    await upsertWorkspaceMembership('session-1', { publisherId: 'analyst', role: 'viewer' }, dataDir)

    await expect(ensureSessionOrOrganizationPermission({
      sessionId: 'session-1',
      publisherId: 'analyst',
      action: 'edit',
      dataDir,
    })).rejects.toThrow(/permission denied/)
  })

  it('does not auto-grant organization access during inherited permission checks', async () => {
    const dataDir = await tempDataDir()
    const organization = await upsertOrganization({ name: 'Northstar Capital Pilot' }, dataDir)
    await assignSessionToOrganization({ organizationId: organization.id, sessionId: 'session-1', dataDir })

    await expect(ensureSessionOrOrganizationPermission({
      sessionId: 'session-1',
      publisherId: 'stranger',
      action: 'edit',
      dataDir,
    })).rejects.toThrow(/workspace membership required/)
  })
})

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'omniquant-policy-'))
}
