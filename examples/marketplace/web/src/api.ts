import { useEffect, useRef, useState } from 'react'
import type { AgentRegistration, Feed, FeedDiagnostics } from './types'

const FEED_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_FEED_URL ?? ''
const REGISTRY_ADMIN_TOKEN = import.meta.env.VITE_REGISTRY_ADMIN_TOKEN ?? ''
const REGISTRY_PUBLISHER_ID = import.meta.env.VITE_REGISTRY_PUBLISHER_ID ?? 'dashboard-admin'
const WORKSPACE_API_TOKEN = import.meta.env.VITE_WORKSPACE_API_TOKEN ?? ''
const WORKSPACE_PUBLISHER_ID = import.meta.env.VITE_WORKSPACE_PUBLISHER_ID ?? REGISTRY_PUBLISHER_ID
export const API_BASE_URL = FEED_URL || 'same-origin /api proxy'
export const LIVE_API_MODE = Boolean(FEED_URL)
export const REGISTRY_ADMIN_ENABLED = Boolean(REGISTRY_ADMIN_TOKEN)
const HEALTH_TIMEOUT_MS = 2500

export interface UiError {
  title: string
  what: string
  likelyCause: string
  suggestedFix: string
}

export interface ApiHealthState {
  status: 'checking' | 'online' | 'offline'
  apiUrl: string
  detail?: string
}

export interface RegistryState {
  agents: AgentRegistration[]
  discoverable: AgentRegistration[]
  pending: AgentRegistration[]
  status: 'checking' | 'online' | 'offline'
  error?: UiError
  updatedAt?: string
}

export interface MarketSessionSummary {
  id: string
  sessionId: string
  namespace: string
  status: string
  currentStage: string
  createdAt: string
  completedAt?: string
  winningAgentId?: string
  settlementStatus?: string
  dataSource?: string
  updatedAt: string
}

export interface SavedMemoRecord {
  id: string
  sessionId: string
  round: number
  memoId: string
  agentId?: string
  question?: string
  recommendation?: string
  confidence?: number
  dataSources: unknown[]
  providerObservability: unknown[]
  memo: unknown
  createdAt: string
}

export interface SavedSettlementRecord {
  id: string
  sessionId: string
  round: number
  status: 'REQUESTED' | 'DEPOSITED' | 'VERIFIED' | 'RELEASED' | 'REFUNDED'
  reference?: string
  depositSignature?: string
  releaseSignature?: string
  amountSol?: number
  sellerWallet?: string
  timestamp: string
}

export type ReviewStatus = 'Needs Review' | 'Approved' | 'Watchlist' | 'Rejected'

export interface MemoExportHistoryRecord {
  id: string
  timestamp: string
  actor?: string
  note?: string
}

export interface MemoWorkspaceRecord {
  id: string
  sessionId: string
  memoId?: string
  reviewStatus: ReviewStatus
  note: string
  reviewer?: string
  exportReady: boolean
  exportHistory: MemoExportHistoryRecord[]
  createdAt: string
  updatedAt: string
}

export interface MemoWorkspacePatch {
  memoId?: string
  reviewStatus?: ReviewStatus
  note?: string
  reviewer?: string
  exportReady?: boolean
  exportNote?: string
  actor?: string
}

export interface OrganizationWorkspaceRecord {
  id: string
  name: string
  slug: string
  status: 'active' | 'archived'
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationSessionRecord {
  id: string
  organizationId: string
  sessionId: string
  assignedBy?: string
  assignedAt: string
  updatedAt: string
}

export interface OrganizationPatch {
  name: string
  slug?: string
  status?: 'active' | 'archived'
}

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface WorkspaceMembershipRecord {
  id: string
  sessionId: string
  publisherId: string
  role: WorkspaceRole
  displayName?: string
  status: 'active' | 'revoked'
  grantedBy?: string
  grantedAt: string
  updatedAt: string
}

export type WorkspaceMembershipAuditAction = 'invited' | 'promoted' | 'demoted' | 'role_changed' | 'revoked' | 'restored'

export interface WorkspaceMembershipAuditRecord {
  id: string
  sessionId: string
  publisherId: string
  action: WorkspaceMembershipAuditAction
  fromRole?: WorkspaceRole
  toRole?: WorkspaceRole
  fromStatus?: 'active' | 'revoked'
  toStatus: 'active' | 'revoked'
  actor?: string
  displayName?: string
  timestamp: string
}

export interface WorkspaceMemberPatch {
  publisherId: string
  role: WorkspaceRole
  displayName?: string
  status?: 'active' | 'revoked'
}

export interface OrganizationDashboardSettlementProof {
  sessionId: string
  status: string
  reference?: string
  depositSignature?: string
  releaseSignature?: string
  depositExplorerUrl?: string
  releaseExplorerUrl?: string
  timestamp: string
}

export interface OrganizationDashboardExportReadyMemo {
  sessionId: string
  memoId?: string
  reviewStatus: ReviewStatus
  reviewer?: string
  updatedAt: string
  exportCount: number
}

export interface OrganizationDashboardSummary {
  sessions: number
  memos: number
  exportReady: number
  members: number
  settlementProof: number
}

export interface OrganizationDashboardRecord {
  organization: OrganizationWorkspaceRecord
  summary: OrganizationDashboardSummary
  sessions: MarketSessionSummary[]
  assignments: OrganizationSessionRecord[]
  memoStatusCounts: Record<ReviewStatus, number>
  reviewers: string[]
  exportReadyMemos: OrganizationDashboardExportReadyMemo[]
  settlementProof: OrganizationDashboardSettlementProof[]
  members: WorkspaceMembershipRecord[]
  audit: WorkspaceMembershipAuditRecord[]
  updatedAt: string
}

export interface SavedMarketDetail {
  session: MarketSessionSummary
  requests: {
    id: string
    sessionId: string
    round: number
    service: string
    argument: string
    budgetSol: number
    timestamp: string
  }[]
  bids: {
    id: string
    sessionId: string
    round: number
    sellerId: string
    bidPriceSol: number
    confidence?: number
    deliveryTimeSeconds?: number
    reasoning?: string
    timestamp: string
  }[]
  winners: { id: string; sessionId: string; round: number; sellerId: string; reason?: string; timestamp: string }[]
  memos: SavedMemoRecord[]
  settlements: SavedSettlementRecord[]
  timeline: { id: string; sessionId: string; round: number; type: string; timestamp: string; payload: unknown }[]
  workspace?: MemoWorkspaceRecord
  organization?: OrganizationWorkspaceRecord
  organizationAssignment?: OrganizationSessionRecord
}

export interface SessionHistoryState {
  status: 'checking' | 'online' | 'offline'
  sessions: MarketSessionSummary[]
  workspaces: MemoWorkspaceRecord[]
  organizations: OrganizationWorkspaceRecord[]
  organizationAssignments: OrganizationSessionRecord[]
  selectedSessionId?: string
  selected?: SavedMarketDetail
  loadingDetail: boolean
  error?: UiError
  updatedAt?: string
  workspaceSaving: boolean
  workspaceError?: UiError
  workspaceMembers: WorkspaceMembershipRecord[]
  workspaceMemberAudit: WorkspaceMembershipAuditRecord[]
  membersLoading: boolean
  membersSaving: boolean
  membersError?: UiError
  organizationMembers: WorkspaceMembershipRecord[]
  organizationMemberAudit: WorkspaceMembershipAuditRecord[]
  organizationDashboard?: OrganizationDashboardRecord
  organizationDashboardLoading: boolean
  organizationMembersLoading: boolean
  organizationMembersSaving: boolean
  organizationSaving: boolean
  organizationError?: UiError
  selectSession: (sessionId: string) => void
  refresh: () => void
  updateWorkspace: (patch: MemoWorkspacePatch) => Promise<void>
  recordExport: (patch?: MemoWorkspacePatch) => Promise<void>
  upsertMember: (patch: WorkspaceMemberPatch) => Promise<void>
  createOrganization: (patch: OrganizationPatch) => Promise<OrganizationWorkspaceRecord | undefined>
  assignSessionToOrganization: (organizationId: string, sessionId?: string) => Promise<void>
  upsertOrganizationMember: (patch: WorkspaceMemberPatch, organizationId?: string) => Promise<void>
}

export function useApiHealth(intervalMs = 15000): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ status: 'checking', apiUrl: API_BASE_URL })

  useEffect(() => {
    let stopped = false
    const check = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
      try {
        const res = await fetch(`${FEED_URL}/api/health?quick=1`, { signal: controller.signal })
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; build?: string; error?: string }
        if (!stopped) {
          setState({
            status: res.ok && body.ok !== false ? 'online' : 'offline',
            apiUrl: API_BASE_URL,
            detail: body.build ?? body.error ?? `health ${res.status}`,
          })
        }
      } catch (error) {
        if (!stopped) {
          setState({
            status: 'offline',
            apiUrl: API_BASE_URL,
            detail: error instanceof Error ? error.message : 'API health check failed',
          })
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void check()
    const id = window.setInterval(check, intervalMs)
    return () => { stopped = true; window.clearInterval(id) }
  }, [intervalMs])

  return state
}

export function useAgentRegistry(apiHealth: ApiHealthState, intervalMs = 15000): RegistryState {
  const [state, setState] = useState<RegistryState>({
    agents: [],
    discoverable: [],
    pending: [],
    status: apiHealth.status === 'online' ? 'checking' : 'offline',
  })

  useEffect(() => {
    let stopped = false
    if (apiHealth.status !== 'online') {
      setState({ agents: [], discoverable: [], pending: [], status: 'offline' })
      return
    }
    const load = async () => {
      try {
        const [registeredRes, discoverRes] = await Promise.all([
          fetch(`${FEED_URL}/api/registry/agents`),
          fetch(`${FEED_URL}/api/registry/discover?market=omniquant`),
        ])
        const registeredBody = (await registeredRes.json().catch(() => ({}))) as { agents?: AgentRegistration[]; error?: string }
        const discoverBody = (await discoverRes.json().catch(() => ({}))) as { agents?: AgentRegistration[]; error?: string }
        if (!registeredRes.ok || !discoverRes.ok) {
          throw new Error(registeredBody.error ?? discoverBody.error ?? `registry ${registeredRes.status}/${discoverRes.status}`)
        }
        const agents = registeredBody.agents ?? []
        const discoverable = discoverBody.agents ?? []
        const pending = agents.filter((agent) => agent.status === 'pending')
        if (!stopped) {
          setState({ agents, discoverable, pending, status: 'online', updatedAt: new Date().toISOString() })
        }
      } catch (error) {
        if (!stopped) {
          setState((current) => ({
            ...current,
            status: 'offline',
            error: friendlyRegistryError(error),
            updatedAt: new Date().toISOString(),
          }))
        }
      }
    }
    void load()
    const id = window.setInterval(load, intervalMs)
    return () => { stopped = true; window.clearInterval(id) }
  }, [apiHealth.status, intervalMs])

  return state
}

export function useSessionHistory(apiHealth: ApiHealthState, intervalMs = 20000): SessionHistoryState {
  const [sessions, setSessions] = useState<MarketSessionSummary[]>([])
  const [workspaces, setWorkspaces] = useState<MemoWorkspaceRecord[]>([])
  const [organizations, setOrganizations] = useState<OrganizationWorkspaceRecord[]>([])
  const [organizationAssignments, setOrganizationAssignments] = useState<OrganizationSessionRecord[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>()
  const [selected, setSelected] = useState<SavedMarketDetail>()
  const [status, setStatus] = useState<SessionHistoryState['status']>(apiHealth.status === 'online' ? 'checking' : 'offline')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<UiError>()
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<UiError>()
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMembershipRecord[]>([])
  const [workspaceMemberAudit, setWorkspaceMemberAudit] = useState<WorkspaceMembershipAuditRecord[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersSaving, setMembersSaving] = useState(false)
  const [membersError, setMembersError] = useState<UiError>()
  const [organizationMembers, setOrganizationMembers] = useState<WorkspaceMembershipRecord[]>([])
  const [organizationMemberAudit, setOrganizationMemberAudit] = useState<WorkspaceMembershipAuditRecord[]>([])
  const [organizationDashboard, setOrganizationDashboard] = useState<OrganizationDashboardRecord>()
  const [organizationDashboardLoading, setOrganizationDashboardLoading] = useState(false)
  const [organizationMembersLoading, setOrganizationMembersLoading] = useState(false)
  const [organizationMembersSaving, setOrganizationMembersSaving] = useState(false)
  const [organizationSaving, setOrganizationSaving] = useState(false)
  const [organizationError, setOrganizationError] = useState<UiError>()
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let stopped = false
    if (apiHealth.status !== 'online') {
      setStatus('offline')
      setSessions([])
      setWorkspaces([])
      setOrganizations([])
      setOrganizationAssignments([])
      setSelected(undefined)
      setWorkspaceMembers([])
      setWorkspaceMemberAudit([])
      setOrganizationMembers([])
      setOrganizationMemberAudit([])
      setOrganizationDashboard(undefined)
      setError(undefined)
      return
    }
    const load = async () => {
      setStatus((current) => current === 'online' ? current : 'checking')
      try {
        const [marketsRes, workspaceRes, organizationRes] = await Promise.all([
          fetch(`${FEED_URL}/api/markets`),
          fetch(`${FEED_URL}/api/workspace/memos`),
          fetch(`${FEED_URL}/api/organizations`),
        ])
        const marketsBody = (await marketsRes.json().catch(() => ({}))) as { markets?: MarketSessionSummary[]; error?: string }
        const workspaceBody = (await workspaceRes.json().catch(() => ({}))) as { workspaces?: MemoWorkspaceRecord[]; error?: string }
        const organizationBody = (await organizationRes.json().catch(() => ({}))) as {
          organizations?: OrganizationWorkspaceRecord[]
          assignments?: OrganizationSessionRecord[]
          error?: string
        }
        if (!marketsRes.ok) throw new Error(marketsBody.error ?? `session history ${marketsRes.status}`)
        if (!workspaceRes.ok) throw new Error(workspaceBody.error ?? `workspace history ${workspaceRes.status}`)
        if (!organizationRes.ok) throw new Error(organizationBody.error ?? `organization history ${organizationRes.status}`)
        const nextSessions = marketsBody.markets ?? []
        if (!stopped) {
          setSessions(nextSessions)
          setWorkspaces(workspaceBody.workspaces ?? [])
          setOrganizations(organizationBody.organizations ?? [])
          setOrganizationAssignments(organizationBody.assignments ?? [])
          setStatus('online')
          setError(undefined)
          setOrganizationError(undefined)
          setUpdatedAt(new Date().toISOString())
          setSelectedSessionId((current) => current ?? nextSessions[0]?.sessionId)
        }
      } catch (loadError) {
        if (!stopped) {
          setStatus('offline')
          setError(friendlyHistoryError(loadError))
          setOrganizationError(friendlyOrganizationError(loadError))
          setUpdatedAt(new Date().toISOString())
        }
      }
    }
    void load()
    const id = window.setInterval(load, intervalMs)
    return () => { stopped = true; window.clearInterval(id) }
  }, [apiHealth.status, intervalMs, refreshNonce])

  useEffect(() => {
    let stopped = false
    if (apiHealth.status !== 'online' || !selectedSessionId) {
      setSelected(undefined)
      setWorkspaceMembers([])
      setWorkspaceMemberAudit([])
      setOrganizationMembers([])
      setOrganizationMemberAudit([])
      setOrganizationDashboard(undefined)
      setLoadingDetail(false)
      setMembersLoading(false)
      setOrganizationDashboardLoading(false)
      setOrganizationMembersLoading(false)
      return
    }
    const loadDetail = async () => {
      setLoadingDetail(true)
      setMembersLoading(true)
      setOrganizationDashboardLoading(true)
      setOrganizationMembersLoading(true)
      try {
        const [marketRes, membersRes, auditRes] = await Promise.all([
          fetch(`${FEED_URL}/api/markets/${encodeURIComponent(selectedSessionId)}`),
          fetch(`${FEED_URL}/api/workspace/memos/${encodeURIComponent(selectedSessionId)}/members`),
          fetch(`${FEED_URL}/api/workspace/memos/${encodeURIComponent(selectedSessionId)}/members/audit`),
        ])
        const body = (await marketRes.json().catch(() => ({}))) as SavedMarketDetail & { error?: string }
        const membersBody = (await membersRes.json().catch(() => ({}))) as { members?: WorkspaceMembershipRecord[]; error?: string }
        const auditBody = (await auditRes.json().catch(() => ({}))) as { audit?: WorkspaceMembershipAuditRecord[]; error?: string }
        if (!marketRes.ok) throw new Error(body.error ?? `saved market ${marketRes.status}`)
        if (!membersRes.ok) throw new Error(membersBody.error ?? `workspace members ${membersRes.status}`)
        if (!auditRes.ok) throw new Error(auditBody.error ?? `workspace member audit ${auditRes.status}`)
        const organizationId = body.organization?.id ?? body.organizationAssignment?.organizationId
        const organizationDashboardBody = organizationId ? await loadOrganizationDashboard(organizationId) : undefined
        if (!stopped) {
          setSelected(body)
          setWorkspaceMembers(membersBody.members ?? [])
          setWorkspaceMemberAudit(auditBody.audit ?? [])
          setOrganizationDashboard(organizationDashboardBody)
          setOrganizationMembers(organizationDashboardBody?.members ?? [])
          setOrganizationMemberAudit(organizationDashboardBody?.audit ?? [])
          setError(undefined)
          setWorkspaceError(undefined)
          setMembersError(undefined)
          setOrganizationError(undefined)
          setUpdatedAt(new Date().toISOString())
        }
      } catch (detailError) {
        if (!stopped) {
          setSelected(undefined)
          setError(friendlyHistoryError(detailError))
          setMembersError(friendlyMembersError(detailError))
          setOrganizationDashboard(undefined)
          setOrganizationMembers([])
          setOrganizationMemberAudit([])
          setOrganizationError(friendlyOrganizationError(detailError))
          setUpdatedAt(new Date().toISOString())
        }
      } finally {
        if (!stopped) {
          setLoadingDetail(false)
          setMembersLoading(false)
          setOrganizationDashboardLoading(false)
          setOrganizationMembersLoading(false)
        }
      }
    }
    void loadDetail()
    return () => { stopped = true }
  }, [apiHealth.status, selectedSessionId])

  const saveWorkspace = async (patch: MemoWorkspacePatch, exportAction = false) => {
    if (apiHealth.status !== 'online' || !selectedSessionId) return
    setWorkspaceSaving(true)
    setWorkspaceError(undefined)
    try {
      const latestMemo = selected?.memos ? [...selected.memos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] : undefined
      const path = exportAction
        ? `/api/workspace/memos/${encodeURIComponent(selectedSessionId)}/export`
        : `/api/workspace/memos/${encodeURIComponent(selectedSessionId)}`
      const requestBody = JSON.stringify({ memoId: latestMemo?.memoId, ...patch })
      const signedHeaders = await signedWorkspaceHeaders(exportAction ? 'POST' : 'PATCH', path, requestBody)
      const res = await fetch(`${FEED_URL}${path}`, {
        method: exportAction ? 'POST' : 'PATCH',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body: requestBody,
      })
      const responseBody = (await res.json().catch(() => ({}))) as { workspace?: MemoWorkspaceRecord; error?: string }
      if (!res.ok || !responseBody.workspace) throw new Error(responseBody.error ?? `workspace save ${res.status}`)
      setSelected((current) => current ? { ...current, workspace: responseBody.workspace } : current)
      setWorkspaceError(undefined)
      setUpdatedAt(new Date().toISOString())
      setRefreshNonce((value) => value + 1)
    } catch (saveError) {
      setWorkspaceError(friendlyWorkspaceError(saveError))
    } finally {
      setWorkspaceSaving(false)
    }
  }

  const saveMember = async (patch: WorkspaceMemberPatch) => {
    if (apiHealth.status !== 'online' || !selectedSessionId) return
    setMembersSaving(true)
    setMembersError(undefined)
    try {
      const path = `/api/workspace/memos/${encodeURIComponent(selectedSessionId)}/members`
      const requestBody = JSON.stringify(patch)
      const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
      const res = await fetch(`${FEED_URL}${path}`, {
        method: 'POST',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body: requestBody,
      })
      const responseBody = (await res.json().catch(() => ({}))) as { membership?: WorkspaceMembershipRecord; error?: string }
      if (!res.ok || !responseBody.membership) throw new Error(responseBody.error ?? `workspace member save ${res.status}`)
      const savedMembership = responseBody.membership
      setWorkspaceMembers((current) => {
        const rest = current.filter((member) => member.publisherId !== savedMembership.publisherId)
        return [...rest, savedMembership].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.publisherId.localeCompare(b.publisherId))
      })
      setMembersError(undefined)
      setUpdatedAt(new Date().toISOString())
      void refreshMemberAudit(selectedSessionId)
    } catch (memberError) {
      setMembersError(friendlyMembersError(memberError))
    } finally {
      setMembersSaving(false)
    }
  }

  const createOrganization = async (patch: OrganizationPatch): Promise<OrganizationWorkspaceRecord | undefined> => {
    if (apiHealth.status !== 'online') return undefined
    setOrganizationSaving(true)
    setOrganizationError(undefined)
    try {
      const path = '/api/organizations'
      const requestBody = JSON.stringify(patch)
      const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
      const res = await fetch(`${FEED_URL}${path}`, {
        method: 'POST',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body: requestBody,
      })
      const responseBody = (await res.json().catch(() => ({}))) as { organization?: OrganizationWorkspaceRecord; error?: string }
      if (!res.ok || !responseBody.organization) throw new Error(responseBody.error ?? `organization save ${res.status}`)
      setOrganizations((current) => {
        const rest = current.filter((organization) => organization.id !== responseBody.organization?.id)
        return [responseBody.organization!, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      })
      setOrganizationError(undefined)
      setUpdatedAt(new Date().toISOString())
      return responseBody.organization
    } catch (orgError) {
      setOrganizationError(friendlyOrganizationError(orgError))
      return undefined
    } finally {
      setOrganizationSaving(false)
    }
  }

  const assignOrganization = async (organizationId: string, sessionId = selectedSessionId): Promise<void> => {
    if (apiHealth.status !== 'online' || !sessionId || !organizationId) return
    setOrganizationSaving(true)
    setOrganizationError(undefined)
    try {
      const path = `/api/organizations/${encodeURIComponent(organizationId)}/sessions`
      const requestBody = JSON.stringify({ sessionId })
      const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
      const res = await fetch(`${FEED_URL}${path}`, {
        method: 'POST',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body: requestBody,
      })
      const responseBody = (await res.json().catch(() => ({}))) as { assignment?: OrganizationSessionRecord; error?: string }
      if (!res.ok || !responseBody.assignment) throw new Error(responseBody.error ?? `organization assignment ${res.status}`)
      const savedAssignment = responseBody.assignment
      setOrganizationAssignments((current) => {
        const rest = current.filter((assignment) => assignment.sessionId !== savedAssignment.sessionId)
        return [savedAssignment, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      })
      setSelected((current) => {
        if (!current || current.session.sessionId !== savedAssignment.sessionId) return current
        const organization = organizations.find((item) => item.id === savedAssignment.organizationId)
        return { ...current, organizationAssignment: savedAssignment, organization: organization ?? current.organization }
      })
      setOrganizationError(undefined)
      await refreshOrganizationDashboard(savedAssignment.organizationId)
      setUpdatedAt(new Date().toISOString())
      setRefreshNonce((value) => value + 1)
    } catch (orgError) {
      setOrganizationError(friendlyOrganizationError(orgError))
    } finally {
      setOrganizationSaving(false)
    }
  }

  const saveOrganizationMember = async (patch: WorkspaceMemberPatch, organizationId = selected?.organization?.id ?? selected?.organizationAssignment?.organizationId) => {
    if (apiHealth.status !== 'online' || !organizationId) return
    setOrganizationMembersSaving(true)
    setOrganizationError(undefined)
    try {
      const path = `/api/organizations/${encodeURIComponent(organizationId)}/members`
      const requestBody = JSON.stringify(patch)
      const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
      const res = await fetch(`${FEED_URL}${path}`, {
        method: 'POST',
        headers: { ...signedHeaders, 'content-type': 'application/json' },
        body: requestBody,
      })
      const responseBody = (await res.json().catch(() => ({}))) as { membership?: WorkspaceMembershipRecord; error?: string }
      if (!res.ok || !responseBody.membership) throw new Error(responseBody.error ?? `organization member save ${res.status}`)
      const savedMembership = responseBody.membership
      setOrganizationMembers((current) => {
        const rest = current.filter((member) => member.publisherId !== savedMembership.publisherId)
        return [...rest, savedMembership].sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.publisherId.localeCompare(b.publisherId))
      })
      await refreshOrganizationDashboard(organizationId)
      setOrganizationError(undefined)
      setUpdatedAt(new Date().toISOString())
    } catch (memberError) {
      setOrganizationError(friendlyOrganizationError(memberError))
    } finally {
      setOrganizationMembersSaving(false)
    }
  }

  return {
    status,
    sessions,
    workspaces,
    organizations,
    organizationAssignments,
    selectedSessionId,
    selected,
    loadingDetail,
    error,
    updatedAt,
    workspaceSaving,
    workspaceError,
    workspaceMembers,
    workspaceMemberAudit,
    membersLoading,
    membersSaving,
    membersError,
    organizationMembers,
    organizationMemberAudit,
    organizationDashboard,
    organizationDashboardLoading,
    organizationMembersLoading,
    organizationMembersSaving,
    organizationSaving,
    organizationError,
    selectSession: setSelectedSessionId,
    refresh: () => setRefreshNonce((value) => value + 1),
    updateWorkspace: (patch) => saveWorkspace(patch),
    recordExport: (patch = {}) => saveWorkspace(patch, true),
    upsertMember: (patch) => saveMember(patch),
    createOrganization,
    assignSessionToOrganization: assignOrganization,
    upsertOrganizationMember: (patch, organizationId) => saveOrganizationMember(patch, organizationId),
  }

  async function loadOrganizationDashboard(organizationId: string): Promise<OrganizationDashboardRecord> {
    const dashboardRes = await fetch(`${FEED_URL}/api/organizations/${encodeURIComponent(organizationId)}/dashboard`)
    const dashboardBody = (await dashboardRes.json().catch(() => ({}))) as OrganizationDashboardRecord & { error?: string }
    if (!dashboardRes.ok) throw new Error(dashboardBody.error ?? `organization dashboard ${dashboardRes.status}`)
    return dashboardBody
  }

  async function refreshOrganizationDashboard(organizationId: string): Promise<void> {
    try {
      const dashboard = await loadOrganizationDashboard(organizationId)
      setOrganizationDashboard(dashboard)
      setOrganizationMembers(dashboard.members ?? [])
      setOrganizationMemberAudit(dashboard.audit ?? [])
    } catch (orgError) {
      setOrganizationError(friendlyOrganizationError(orgError))
    }
  }

  async function refreshMemberAudit(sessionId: string): Promise<void> {
    try {
      const res = await fetch(`${FEED_URL}/api/workspace/memos/${encodeURIComponent(sessionId)}/members/audit`)
      const body = (await res.json().catch(() => ({}))) as { audit?: WorkspaceMembershipAuditRecord[]; error?: string }
      if (!res.ok) throw new Error(body.error ?? `workspace member audit ${res.status}`)
      setWorkspaceMemberAudit(body.audit ?? [])
    } catch (auditError) {
      setMembersError(friendlyMembersError(auditError))
    }
  }
}

export async function setRegistryAgentStatus(agentId: string, status: AgentRegistration['status']): Promise<void> {
  if (!REGISTRY_ADMIN_TOKEN) throw new Error('Registry admin token is not configured in this dashboard build.')
  const path = `/api/registry/agents/${encodeURIComponent(agentId)}/status`
  const body = JSON.stringify({ status })
  const headers = await signedRegistryHeaders('POST', path, body)
  const res = await fetch(`${FEED_URL}${path}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(`status update failed: ${res.status} ${await res.text()}`)
}

export interface StartMarketOptions {
  organizationId?: string
}

/** Ask the feed server to launch a market session; returns its id. (Fund wallets first.) */
export async function startMarket(options: StartMarketOptions = {}): Promise<{ session: string; namespace?: string }> {
  try {
    if (LIVE_API_MODE) return startMarketViaJob(options)
    const path = '/api/start'
    const requestBody = JSON.stringify({
      organizationId: options.organizationId,
    })
    const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
    const r = await fetch(`${FEED_URL}/api/start`, {
      method: 'POST',
      headers: { ...signedHeaders, 'content-type': 'application/json' },
      body: requestBody,
    })
    const body = (await r.json().catch(() => ({}))) as { session?: string; namespace?: string; error?: string; log?: string }
    if (!r.ok || !body.session) {
      const detail = [body.error ?? `start failed (${r.status})`, body.log].filter(Boolean).join(': ')
      throw new Error(detail)
    }
    return { session: body.session, namespace: body.namespace }
  } catch (error) {
    throw friendlyError(error, 'start')
  }
}

interface MarketJobResponse {
  jobId?: string
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'dead_lettered'
  namespace?: string
  statusUrl?: string
  session?: string
  attempts?: number
  maxAttempts?: number
  error?: string
  message?: string
  job?: {
    id: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'dead_lettered'
    namespace?: string
    session?: string
    attempts?: number
    maxAttempts?: number
    error?: string
  }
}

async function startMarketViaJob(options: StartMarketOptions): Promise<{ session: string; namespace?: string }> {
  const idempotencyKey = `dashboard-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const path = '/v1/markets'
  const requestBody = JSON.stringify({
    namespace: 'omniquant',
    request: 'Should our fund increase exposure to Nvidia over the next 3-6 months?',
    asset: 'NVDA',
    organizationId: options.organizationId,
  })
  const signedHeaders = await signedWorkspaceHeaders('POST', path, requestBody)
  const r = await fetch(`${FEED_URL}/v1/markets`, {
    method: 'POST',
    headers: {
      ...signedHeaders,
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: requestBody,
  })
  const body = (await r.json().catch(() => ({}))) as MarketJobResponse
  if (!r.ok || !body.jobId) throw new Error(body.message ?? body.error ?? `market job enqueue failed (${r.status})`)
  return pollMarketJob(body.jobId, body.statusUrl ?? `/v1/market-jobs/${body.jobId}`)
}

async function pollMarketJob(jobId: string, statusUrl: string): Promise<{ session: string; namespace?: string }> {
  const deadline = Date.now() + 90_000
  let last: MarketJobResponse | undefined
  while (Date.now() < deadline) {
    const r = await fetch(`${FEED_URL}${statusUrl}`)
    const body = (await r.json().catch(() => ({}))) as MarketJobResponse
    if (!r.ok) throw new Error(body.error ?? `market job ${jobId} status failed (${r.status})`)
    last = body
    const job = body.job
    if (job?.status === 'completed' && job.session) return { session: job.session, namespace: job.namespace }
    if (job?.status === 'failed' || job?.status === 'dead_lettered') {
      throw new Error(`market job ${job.status}: ${job.error ?? 'launcher failed'}`)
    }
    await sleep(1000)
  }
  throw new Error(`market job ${jobId} timed out: ${last?.job?.status ?? 'unknown'}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export interface FeedState {
  rounds: Feed['rounds']
  connected: boolean
  error?: UiError
  diagnostics?: FeedDiagnostics
  updatedAt?: string
  polling: boolean
  apiUrl: string
}

/**
 * Poll the feed server for a session's rounds. A plain hook (no extra deps) — swap for TanStack Query
 * or an SSE endpoint when you outgrow polling. `intervalMs` defaults to 1s.
 */
export function useFeed(session: string, namespace?: string, intervalMs = 1000): FeedState {
  const [state, setState] = useState<FeedState>({ rounds: [], connected: false, polling: false, apiUrl: API_BASE_URL })
  const stop = useRef(false)

  useEffect(() => {
    stop.current = false
    if (!session) {
      setState({ rounds: [], connected: false, polling: false, apiUrl: API_BASE_URL })
      return
    }
    const tick = async () => {
      try {
        const params = new URLSearchParams({ session })
        if (namespace) params.set('namespace', namespace)
        const r = await fetch(`${FEED_URL}/api/feed?${params.toString()}`)
        const feed = (await r.json().catch(() => ({}))) as Feed
        if (!r.ok) {
          const detail = feed.error ?? feed.diagnostics?.buyerStatus ?? `feed ${r.status}`
          if (!stop.current) {
            setState((s) => ({
              ...s,
              rounds: feed.rounds ?? [],
              connected: false,
              error: friendlyError(new Error(detail), 'feed'),
              diagnostics: feed.diagnostics,
              updatedAt: feed.updatedAt,
              polling: true,
              apiUrl: API_BASE_URL,
            }))
          }
          return
        }
        if (!stop.current) {
          if (feed.diagnostics) {
            console.debug(`[market-feed] session=${feed.session} events=${feed.diagnostics.messageCount} last=${feed.diagnostics.lastEventType} rounds=${feed.rounds?.length ?? 0}`)
          }
          setState({
            rounds: feed.rounds ?? [],
            connected: true,
            error: feed.error ? friendlyError(new Error(feed.error), 'feed') : undefined,
            diagnostics: feed.diagnostics,
            updatedAt: feed.updatedAt,
            polling: true,
            apiUrl: API_BASE_URL,
          })
        }
      } catch (e) {
        if (!stop.current) setState((s) => ({ ...s, connected: false, polling: true, error: friendlyError(e, 'feed'), apiUrl: API_BASE_URL }))
      }
    }
    void tick()
    const id = setInterval(tick, intervalMs)
    return () => { stop.current = true; clearInterval(id) }
  }, [session, namespace, intervalMs])

  return state
}

export function friendlyError(error: unknown, phase: 'start' | 'feed'): UiError {
  const message = (error as Error).message || 'Unknown feed error'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return {
      title: 'API unavailable',
      what: phase === 'start' ? 'The dashboard could not reach the market launcher.' : 'The dashboard could not reach the marketplace feed.',
      likelyCause: 'The feed server on port 4000 is not running or the Codespaces forwarded URL is not using the Vite proxy.',
      suggestedFix: 'Run the judge/demo command again, confirm port 4000 is active, then retry Start Market.',
    }
  }
  if (/coral/i.test(message)) {
    return {
      title: 'CoralOS unavailable',
      what: 'The feed server is up, but it could not read the CoralOS session thread.',
      likelyCause: message,
      suggestedFix: 'Confirm the CoralOS container is healthy on port 5555, then retry the market.',
    }
  }
  if (/wallet|fund/i.test(message)) {
    return {
      title: 'Wallet not funded',
      what: 'The market launcher could not complete because the devnet wallet needs SOL.',
      likelyCause: message,
      suggestedFix: 'Fund the buyer wallet from the Solana devnet faucet, then retry Start Market.',
    }
  }
  if (/timed out|launcher/i.test(message)) {
    return {
      title: 'Market launch timed out',
      what: 'The session did not finish launching within the expected window.',
      likelyCause: message,
      suggestedFix: 'Check the terminal logs for buyer/seller startup, then retry Start Market.',
    }
  }
  return {
    title: phase === 'start' ? 'Market could not start' : 'Feed error',
    what: message,
    likelyCause: 'The demo runtime returned an unexpected response.',
    suggestedFix: 'Retry once. If it repeats, inspect Debug Status and the feed server logs.',
  }
}

function friendlyRegistryError(error: unknown): UiError {
  const message = (error as Error).message || 'Registry request failed'
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Registry API unavailable',
      what: 'The dashboard could not reach the agent registry endpoints.',
      likelyCause: 'The marketplace feed API is offline or the public site is running in proof mode.',
      suggestedFix: 'Run the local/Codespaces demo runtime, then refresh the Developer Registry panel.',
    }
  }
  return {
    title: 'Registry could not load',
    what: message,
    likelyCause: 'The registry endpoint returned an unexpected response.',
    suggestedFix: 'Check /api/registry/agents and the feed server logs.',
  }
}

function friendlyHistoryError(error: unknown): UiError {
  const message = (error as Error).message || 'Session history request failed'
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Session history unavailable',
      what: 'The dashboard could not reach saved market history.',
      likelyCause: 'The marketplace API is offline or the public site is running without a live API host.',
      suggestedFix: 'Run the local/Codespaces API or connect VITE_API_BASE_URL to a hosted testnet API, then retry.',
    }
  }
  return {
    title: 'Session history could not load',
    what: message,
    likelyCause: 'The history endpoint returned an unexpected response.',
    suggestedFix: 'Check /api/markets, /api/markets/:id, and the feed server logs.',
  }
}

function friendlyWorkspaceError(error: unknown): UiError {
  const message = (error as Error).message || 'Workspace save failed'
  if (/auth|signature/i.test(message)) {
    return {
      title: 'Workspace write not authorized',
      what: 'The API rejected the memo workspace update because it was not signed with a valid workspace token.',
      likelyCause: 'The feed server has WORKSPACE_AUTH_SECRET or MARKETPLACE_API_TOKEN set, but the dashboard is missing VITE_WORKSPACE_API_TOKEN or it does not match.',
      suggestedFix: 'Set VITE_WORKSPACE_API_TOKEN for the dashboard build, or remove the server workspace secret in local demo mode.',
    }
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Workspace API unavailable',
      what: 'The memo workspace changes could not be saved to the API.',
      likelyCause: 'The marketplace API is offline or the browser lost connection while saving.',
      suggestedFix: 'Retry after the live API is reachable. Your visible selection has not been changed on the server.',
    }
  }
  return {
    title: 'Workspace changes were not saved',
    what: message,
    likelyCause: 'The workspace endpoint rejected the update.',
    suggestedFix: 'Check the reviewer, review status, and export fields, then retry.',
  }
}

function friendlyMembersError(error: unknown): UiError {
  const message = (error as Error).message || 'Workspace member request failed'
  if (/auth|signature/i.test(message)) {
    return {
      title: 'Member update not authorized',
      what: 'The API rejected the member change because it was not signed with a valid workspace token.',
      likelyCause: 'The dashboard is missing VITE_WORKSPACE_API_TOKEN or the token does not match the server secret.',
      suggestedFix: 'Configure the workspace token, then retry the member update.',
    }
  }
  if (/membership|permission/i.test(message)) {
    return {
      title: 'Workspace permission denied',
      what: 'Your signed publisher is not an owner or admin for this workspace.',
      likelyCause: message,
      suggestedFix: 'Ask a workspace owner/admin to grant access, or use the owner publisher token.',
    }
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Workspace members unavailable',
      what: 'The dashboard could not reach the workspace membership API.',
      likelyCause: 'The marketplace API is offline or the browser lost connection.',
      suggestedFix: 'Confirm the API is online, then retry.',
    }
  }
  return {
    title: 'Workspace member change failed',
    what: message,
    likelyCause: 'The workspace membership endpoint rejected the request.',
    suggestedFix: 'Check the publisher ID and role, then retry.',
  }
}

function friendlyOrganizationError(error: unknown): UiError {
  const message = (error as Error).message || 'Organization workspace request failed'
  if (/auth|signature/i.test(message)) {
    return {
      title: 'Organization update not authorized',
      what: 'The API rejected the pilot/team workspace change because it was not signed with a valid workspace token.',
      likelyCause: 'The dashboard is missing VITE_WORKSPACE_API_TOKEN or the token does not match the server secret.',
      suggestedFix: 'Configure the workspace token, then retry the organization update.',
    }
  }
  if (/not found/i.test(message)) {
    return {
      title: 'Organization not found',
      what: 'The selected pilot/team workspace could not be found by the API.',
      likelyCause: message,
      suggestedFix: 'Refresh organization history, then assign the session again.',
    }
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Organizations unavailable',
      what: 'The dashboard could not reach the pilot/team workspace API.',
      likelyCause: 'The marketplace API is offline or the browser lost connection.',
      suggestedFix: 'Confirm the API is online, then retry.',
    }
  }
  return {
    title: 'Organization workspace change failed',
    what: message,
    likelyCause: 'The organization endpoint rejected the request.',
    suggestedFix: 'Check the organization name and selected session, then retry.',
  }
}

function roleRank(role: WorkspaceRole): number {
  return role === 'owner' ? 0 : role === 'admin' ? 1 : role === 'editor' ? 2 : 3
}

async function signedRegistryHeaders(method: string, path: string, body: string): Promise<Record<string, string>> {
  if (!REGISTRY_ADMIN_TOKEN) return {}
  return signedHeaders({ token: REGISTRY_ADMIN_TOKEN, publisher: REGISTRY_PUBLISHER_ID, method, path, body })
}

async function signedWorkspaceHeaders(method: string, path: string, body: string): Promise<Record<string, string>> {
  if (!WORKSPACE_API_TOKEN) return {}
  return signedHeaders({ token: WORKSPACE_API_TOKEN, publisher: WORKSPACE_PUBLISHER_ID, method, path, body })
}

async function signedHeaders(input: { token: string; publisher: string; method: string; path: string; body: string }): Promise<Record<string, string>> {
  const timestamp = new Date().toISOString()
  const payload = `${input.method.toUpperCase()}\n${input.path}\n${timestamp}\n${input.body}`
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input.token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await window.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return {
    'x-oq-publisher': input.publisher,
    'x-oq-timestamp': timestamp,
    'x-oq-signature': [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  }
}
