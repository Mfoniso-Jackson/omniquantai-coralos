import { useEffect, useRef, useState } from 'react'
import type { AgentRegistration, Feed, FeedDiagnostics } from './types'

const FEED_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_FEED_URL ?? ''
const REGISTRY_ADMIN_TOKEN = import.meta.env.VITE_REGISTRY_ADMIN_TOKEN ?? ''
const REGISTRY_PUBLISHER_ID = import.meta.env.VITE_REGISTRY_PUBLISHER_ID ?? 'dashboard-admin'
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
}

export interface SessionHistoryState {
  status: 'checking' | 'online' | 'offline'
  sessions: MarketSessionSummary[]
  workspaces: MemoWorkspaceRecord[]
  selectedSessionId?: string
  selected?: SavedMarketDetail
  loadingDetail: boolean
  error?: UiError
  updatedAt?: string
  workspaceSaving: boolean
  workspaceError?: UiError
  selectSession: (sessionId: string) => void
  refresh: () => void
  updateWorkspace: (patch: MemoWorkspacePatch) => Promise<void>
  recordExport: (patch?: MemoWorkspacePatch) => Promise<void>
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
  const [selectedSessionId, setSelectedSessionId] = useState<string>()
  const [selected, setSelected] = useState<SavedMarketDetail>()
  const [status, setStatus] = useState<SessionHistoryState['status']>(apiHealth.status === 'online' ? 'checking' : 'offline')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<UiError>()
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<UiError>()
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let stopped = false
    if (apiHealth.status !== 'online') {
      setStatus('offline')
      setSessions([])
      setWorkspaces([])
      setSelected(undefined)
      setError(undefined)
      return
    }
    const load = async () => {
      setStatus((current) => current === 'online' ? current : 'checking')
      try {
        const [marketsRes, workspaceRes] = await Promise.all([
          fetch(`${FEED_URL}/api/markets`),
          fetch(`${FEED_URL}/api/workspace/memos`),
        ])
        const marketsBody = (await marketsRes.json().catch(() => ({}))) as { markets?: MarketSessionSummary[]; error?: string }
        const workspaceBody = (await workspaceRes.json().catch(() => ({}))) as { workspaces?: MemoWorkspaceRecord[]; error?: string }
        if (!marketsRes.ok) throw new Error(marketsBody.error ?? `session history ${marketsRes.status}`)
        if (!workspaceRes.ok) throw new Error(workspaceBody.error ?? `workspace history ${workspaceRes.status}`)
        const nextSessions = marketsBody.markets ?? []
        if (!stopped) {
          setSessions(nextSessions)
          setWorkspaces(workspaceBody.workspaces ?? [])
          setStatus('online')
          setError(undefined)
          setUpdatedAt(new Date().toISOString())
          setSelectedSessionId((current) => current ?? nextSessions[0]?.sessionId)
        }
      } catch (loadError) {
        if (!stopped) {
          setStatus('offline')
          setError(friendlyHistoryError(loadError))
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
      setLoadingDetail(false)
      return
    }
    const loadDetail = async () => {
      setLoadingDetail(true)
      try {
        const res = await fetch(`${FEED_URL}/api/markets/${encodeURIComponent(selectedSessionId)}`)
        const body = (await res.json().catch(() => ({}))) as SavedMarketDetail & { error?: string }
        if (!res.ok) throw new Error(body.error ?? `saved market ${res.status}`)
        if (!stopped) {
          setSelected(body)
          setError(undefined)
          setWorkspaceError(undefined)
          setUpdatedAt(new Date().toISOString())
        }
      } catch (detailError) {
        if (!stopped) {
          setSelected(undefined)
          setError(friendlyHistoryError(detailError))
          setUpdatedAt(new Date().toISOString())
        }
      } finally {
        if (!stopped) setLoadingDetail(false)
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
      const res = await fetch(`${FEED_URL}${path}`, {
        method: exportAction ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memoId: latestMemo?.memoId, ...patch }),
      })
      const body = (await res.json().catch(() => ({}))) as { workspace?: MemoWorkspaceRecord; error?: string }
      if (!res.ok || !body.workspace) throw new Error(body.error ?? `workspace save ${res.status}`)
      setSelected((current) => current ? { ...current, workspace: body.workspace } : current)
      setWorkspaceError(undefined)
      setUpdatedAt(new Date().toISOString())
      setRefreshNonce((value) => value + 1)
    } catch (saveError) {
      setWorkspaceError(friendlyWorkspaceError(saveError))
    } finally {
      setWorkspaceSaving(false)
    }
  }

  return {
    status,
      sessions,
      workspaces,
      selectedSessionId,
    selected,
    loadingDetail,
    error,
    updatedAt,
    workspaceSaving,
    workspaceError,
    selectSession: setSelectedSessionId,
    refresh: () => setRefreshNonce((value) => value + 1),
    updateWorkspace: (patch) => saveWorkspace(patch),
    recordExport: (patch = {}) => saveWorkspace(patch, true),
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

/** Ask the feed server to launch a market session; returns its id. (Fund wallets first.) */
export async function startMarket(): Promise<{ session: string; namespace?: string }> {
  try {
    if (LIVE_API_MODE) return startMarketViaJob()
    const r = await fetch(`${FEED_URL}/api/start`, { method: 'POST' })
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

async function startMarketViaJob(): Promise<{ session: string; namespace?: string }> {
  const idempotencyKey = `dashboard-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const r = await fetch(`${FEED_URL}/v1/markets`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      namespace: 'omniquant',
      request: 'Should our fund increase exposure to Nvidia over the next 3-6 months?',
      asset: 'NVDA',
    }),
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

async function signedRegistryHeaders(method: string, path: string, body: string): Promise<Record<string, string>> {
  const timestamp = new Date().toISOString()
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(REGISTRY_ADMIN_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await window.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return {
    'x-oq-publisher': REGISTRY_PUBLISHER_ID,
    'x-oq-timestamp': timestamp,
    'x-oq-signature': [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  }
}
