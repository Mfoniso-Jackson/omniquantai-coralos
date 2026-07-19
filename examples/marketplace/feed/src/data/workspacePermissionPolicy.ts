import { getSessionOrganization } from './organizationStore.js'
import {
  ensureWorkspacePermission,
  getWorkspaceMembership,
  type WorkspacePermissionAction,
} from './workspaceMembershipStore.js'

export function organizationScope(organizationId: string): string {
  return `organization:${organizationId}`
}

export async function ensureSessionOrOrganizationPermission(input: {
  sessionId: string
  publisherId?: string
  action: WorkspacePermissionAction
  dataDir?: string
}): Promise<void> {
  if (!input.publisherId) return
  const directMember = await getWorkspaceMembership(input.sessionId, input.publisherId, input.dataDir)
  if (directMember) {
    await ensureWorkspacePermission({
      sessionId: input.sessionId,
      publisherId: input.publisherId,
      action: input.action,
      dataDir: input.dataDir,
      autoGrantFirstOwner: false,
    })
    return
  }
  const assignment = await getSessionOrganization(input.sessionId, input.dataDir)
  if (assignment) {
    await ensureWorkspacePermission({
      sessionId: organizationScope(assignment.organizationId),
      publisherId: input.publisherId,
      action: input.action,
      dataDir: input.dataDir,
      autoGrantFirstOwner: false,
    })
    return
  }
  await ensureWorkspacePermission({
    sessionId: input.sessionId,
    publisherId: input.publisherId,
    action: input.action,
    dataDir: input.dataDir,
  })
}
