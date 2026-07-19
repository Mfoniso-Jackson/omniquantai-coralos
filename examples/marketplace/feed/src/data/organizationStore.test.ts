import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  assignSessionToOrganization,
  getSessionOrganization,
  listOrganizationAssignments,
  listOrganizationSessions,
  listOrganizations,
  upsertOrganization,
} from './organizationStore.js'

describe('organizationStore', () => {
  it('persists pilot workspaces and assigns sessions', async () => {
    const dataDir = await tempDataDir()
    const org = await upsertOrganization({ name: 'Northstar Capital Pilot', createdBy: 'research-lead' }, dataDir)
    await assignSessionToOrganization({ organizationId: org.id, sessionId: 'session-1', assignedBy: 'research-lead', dataDir })

    await expect(listOrganizations(dataDir)).resolves.toMatchObject([{ id: 'northstar-capital-pilot', name: 'Northstar Capital Pilot' }])
    await expect(getSessionOrganization('session-1', dataDir)).resolves.toMatchObject({
      organizationId: org.id,
      sessionId: 'session-1',
    })
    await expect(listOrganizationSessions(org.id, dataDir)).resolves.toHaveLength(1)
  })

  it('keeps only the latest assignment for a session', async () => {
    const dataDir = await tempDataDir()
    const first = await upsertOrganization({ name: 'Alpha Fund' }, dataDir)
    const second = await upsertOrganization({ name: 'Beta Fund' }, dataDir)
    await assignSessionToOrganization({ organizationId: first.id, sessionId: 'session-1', dataDir })
    await assignSessionToOrganization({ organizationId: second.id, sessionId: 'session-1', dataDir })

    const assignments = await listOrganizationAssignments(dataDir)
    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({ organizationId: second.id, sessionId: 'session-1' })
  })
})

async function tempDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'omniquant-orgs-'))
}
