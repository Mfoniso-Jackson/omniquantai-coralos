/**
 * Marketplace feed server — the only backend the visualizer needs.
 *
 * Reads a CoralOS session's transcript (extended state, behind the dev token), folds it into typed
 * market rounds with `foldRounds`, and serves CORS-enabled JSON for the React app to poll. The browser
 * never touches coral or Solana — this keeps the token server-side and avoids CORS.
 *
 *   GET /api/health                  → { ok: true }
 *   GET /api/feed?session=<sid>      → { session, rounds, updatedAt }   (session defaults to $SESSION)
 *
 * Set FEED_FIXTURE=<path-to-recorded-extended-state.json> to serve a recorded transcript instead of
 * hitting coral — used by the e2e so it exercises the REAL fold/parse path with no devnet.
 *
 * Env: CORAL_SERVER_URL (default http://localhost:5555), CORAL_TOKEN (default dev),
 *      SESSION, MARKET_SELLERS (csv for the declined column), FEED_FIXTURE, PORT (default 4000).
 */
import express from 'express'
import type { Request, Response } from 'express'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { foldRounds } from './foldRounds.js'
import { collectMessages } from './coralState.js'
import type { RawMessage, Round } from './foldRounds.js'
import type { MemoReviewStatus, SettlementRecord } from './data/models.js'
import { persistMarketplaceData } from './data/persistence.js'
import { getPersistedStartMarketJob } from './data/jobStore.js'
import { getAgent, getMarket, getMemo, getReputation, getSessionGraph, getSettlement, listAgents, listMarkets } from './data/history.js'
import { getMemoWorkspace, listMemoWorkspaces, upsertMemoWorkspace, type WorkspacePatch } from './data/workspaceStore.js'
import {
  assignSessionToOrganization,
  getOrganization,
  listOrganizationAssignments,
  listOrganizationSessions,
  listOrganizations,
  upsertOrganization,
  type OrganizationPatch,
} from './data/organizationStore.js'
import {
  ensureWorkspacePermission,
  listWorkspaceMembershipAudit,
  listWorkspaceMemberships,
  upsertWorkspaceMembership,
  type MembershipPatch,
} from './data/workspaceMembershipStore.js'
import { ensureSessionOrOrganizationPermission, organizationScope } from './data/workspacePermissionPolicy.js'
import {
  discoverRegisteredAgents,
  getRegisteredAgent,
  listRegisteredAgents,
  registerAgentManifest,
  transitionAgentStatus,
  updateAgentManifest,
  type RegistryStatus,
} from './data/registryStore.js'
import { deriveMarketStatus, type MarketStatus } from './marketStatus.js'
import { launchMarketSession, launcherCommand } from './marketLauncher.js'
import { enqueueStartMarketJob, getJob, redisAvailable } from './redisQueue.js'
import { verifySignedRequest } from './signedRequest.js'
import { installPrivateQuantApi } from './privateQuantApi.js'

const BASE = process.env.CORAL_SERVER_URL ?? 'http://localhost:5555'
const TOKEN = process.env.CORAL_TOKEN ?? 'dev'
const NS = process.env.CORAL_NAMESPACE ?? 'omniquant'
const PORT = Number(process.env.PORT ?? 4000)
const DEFAULT_SESSION = process.env.SESSION ?? ''
const FIXTURE = process.env.FEED_FIXTURE
const SESSION_READ_RETRIES = Number(process.env.FEED_SESSION_READ_RETRIES ?? 8)
const SESSION_READ_RETRY_MS = Number(process.env.FEED_SESSION_READ_RETRY_MS ?? 1000)
const START_READY_RETRIES = Number(process.env.FEED_START_READY_RETRIES ?? 35)
const START_READY_RETRY_MS = Number(process.env.FEED_START_READY_RETRY_MS ?? 1000)
const BUILD = 'feed-direct-launcher-v6'
const sessionNamespaces = new Map<string, string>()
const sessionStartedAt = new Map<string, number>()
const SELLERS = (process.env.MARKET_SELLERS ?? 'market-analyst,news-earnings,macro-risk,portfolio-risk')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Fetch a session's raw extended state — from the FEED_FIXTURE file, else from coral. */
async function readState(session: string, namespace = NS): Promise<unknown> {
  if (FIXTURE) return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  let lastError = ''
  for (let attempt = 1; attempt <= SESSION_READ_RETRIES; attempt += 1) {
    try {
      return await readStateAcrossNamespaces(session, namespace)
    } catch (error) {
      const message = (error as Error).message
      if (!shouldRecoverSessionRead(message)) throw error
      lastError = message
      if (attempt < SESSION_READ_RETRIES) {
        console.error(`[feed] session=${session} namespace=${namespace} read attempt ${attempt}/${SESSION_READ_RETRIES} failed: ${message}`)
        await sleep(SESSION_READ_RETRY_MS)
      }
    }
  }
  throw new Error(lastError || `Session ${session} could not be read`)
}

async function readStateAcrossNamespaces(session: string, namespace: string): Promise<unknown> {
  try {
    return await readStateInNamespace(session, namespace)
  } catch (error) {
    const message = (error as Error).message
    if (!shouldRecoverSessionRead(message)) throw error
    const namespaces = await listNamespaces()
    for (const candidate of namespaces.filter((name) => name !== namespace)) {
      try {
        const state = await readStateInNamespace(session, candidate)
        sessionNamespaces.set(session, candidate)
        console.error(`[feed] recovered session ${session} in namespace=${candidate} after ${message}`)
        return state
      } catch { /* keep scanning */ }
    }
    throw new Error(`${message}; available namespaces: ${namespaces.join(', ') || 'none'}`)
  }
}

function shouldRecoverSessionRead(message: string): boolean {
  return /Namespace .* does not exist|Session not found|coral 404|namespace|not found/i.test(message)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readStateInNamespace(session: string, namespace: string): Promise<unknown> {
  const r = await fetch(`${BASE}/api/v1/local/session/${namespace}/${session}/extended`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!r.ok) throw new Error(`coral ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function listNamespaces(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/local/namespace`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok) return []
    const body = await res.json() as Array<{ name?: string }>
    return body.map((item) => item.name).filter((name): name is string => Boolean(name))
  } catch {
    return []
  }
}

const app = express()
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Idempotency-Key,x-oq-publisher,x-oq-timestamp,x-oq-signature')
  next()
})
app.options('*', (_req, res) => res.sendStatus(204))

app.use(express.json({
  verify: (req, _res, buf) => {
    ;(req as Request & { rawBody?: string }).rawBody = buf.toString('utf8')
  },
}))

async function healthPayload(quick: boolean) {
  const coral = quick ? { ok: false, status: 'not_checked' } : await coralHealth()
  return {
    ok: true,
    coral: BASE,
    coralReachable: coral.ok,
    coralStatus: coral.status,
    build: BUILD,
    defaultSession: DEFAULT_SESSION || undefined,
    fixture: FIXTURE || undefined,
  }
}

app.get('/health', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/status', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

async function readinessResponse(_req: Request, res: Response) {
  const coral = await coralHealth()
  const ready = FIXTURE ? true : coral.ok
  res.status(ready ? 200 : 503).json({
    ok: ready,
    api: 'ready',
    coral: BASE,
    coralReachable: coral.ok,
    coralStatus: coral.status,
    build: BUILD,
    persistence: process.env.OMNIQUANT_PERSIST === '0' ? 'disabled' : 'file-backed',
    queue: process.env.REDIS_URL ? 'configured' : 'not_configured',
  })
}

app.get('/ready', readinessResponse)

app.get('/api/health', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/api/status', async (req, res) => {
  const quick = req.query.quick === '1'
  res.json(await healthPayload(quick))
})

app.get('/api/ready', readinessResponse)

installPrivateQuantApi(app)

app.post('/api/sessions/start', startSession)
app.post('/api/start', startSession)
app.post('/v1/markets', enqueueMarketSession)
app.get('/v1/market-jobs/:id', async (req, res) => {
  const job = redisAvailable()
    ? await getJob(req.params.id)
    : await getPersistedStartMarketJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'market job not found', jobId: req.params.id })
  res.json({ job })
})

app.get('/api/markets', async (_req, res) => {
  res.json({ markets: await listMarkets() })
})

app.get('/v1/markets', async (_req, res) => {
  res.json({ markets: await listMarkets() })
})

app.get('/api/markets/:id', async (req, res) => {
  const market = await getMarket(req.params.id)
  if (!market) return res.status(404).json({ error: 'market not found', sessionId: req.params.id })
  return res.json(market)
})

app.get('/api/organizations', async (_req, res) => {
  res.json({ organizations: await listOrganizations(), assignments: await listOrganizationAssignments() })
})

app.post('/api/organizations', upsertOrganizationWorkspace)

app.get('/api/organizations/:id', async (req, res) => {
  const organization = await getOrganization(req.params.id)
  if (!organization) return res.status(404).json({ error: 'organization not found', organizationId: req.params.id })
  res.json({ organization, sessions: await listOrganizationSessions(req.params.id) })
})

app.get('/api/organizations/:id/dashboard', organizationDashboard)
app.post('/api/organizations/:id/sessions', assignOrganizationSession)
app.get('/api/organizations/:id/members', listOrganizationMembers)
app.post('/api/organizations/:id/members', upsertOrganizationMember)
app.get('/api/organizations/:id/members/audit', listOrganizationMemberAudit)

app.get('/v1/markets/:id', async (req, res) => {
  const market = await getMarket(req.params.id)
  if (!market) return res.status(404).json({ error: 'market not found', sessionId: req.params.id })
  return res.json(market)
})

app.get('/v1/organizations', async (_req, res) => {
  res.json({ organizations: await listOrganizations(), assignments: await listOrganizationAssignments() })
})

app.post('/v1/organizations', upsertOrganizationWorkspace)

app.get('/v1/organizations/:id', async (req, res) => {
  const organization = await getOrganization(req.params.id)
  if (!organization) return res.status(404).json({ error: 'organization not found', organizationId: req.params.id })
  res.json({ organization, sessions: await listOrganizationSessions(req.params.id) })
})

app.get('/v1/organizations/:id/dashboard', organizationDashboard)
app.post('/v1/organizations/:id/sessions', assignOrganizationSession)
app.get('/v1/organizations/:id/members', listOrganizationMembers)
app.post('/v1/organizations/:id/members', upsertOrganizationMember)
app.get('/v1/organizations/:id/members/audit', listOrganizationMemberAudit)

app.get('/v1/markets/:id/events', async (req, res) => {
  const market = await getMarket(req.params.id)
  if (!market) return res.status(404).json({ error: 'market not found', sessionId: req.params.id })
  return res.json({ sessionId: req.params.id, events: market.timeline })
})

app.get('/api/workspace/memos', async (_req, res) => {
  res.json({ workspaces: await listMemoWorkspaces() })
})

app.get('/api/workspace/memos/:sessionId', async (req, res) => {
  res.json({ workspace: await getMemoWorkspace(req.params.sessionId) ?? null })
})

app.patch('/api/workspace/memos/:sessionId', updateMemoWorkspace)
app.post('/api/workspace/memos/:sessionId/export', recordMemoExport)
app.get('/api/workspace/memos/:sessionId/members', listMemoWorkspaceMembers)
app.post('/api/workspace/memos/:sessionId/members', upsertMemoWorkspaceMember)
app.get('/api/workspace/memos/:sessionId/members/audit', listMemoWorkspaceMemberAudit)

app.get('/v1/workspace/memos', async (_req, res) => {
  res.json({ workspaces: await listMemoWorkspaces() })
})

app.get('/v1/workspace/memos/:sessionId', async (req, res) => {
  res.json({ workspace: await getMemoWorkspace(req.params.sessionId) ?? null })
})

app.patch('/v1/workspace/memos/:sessionId', updateMemoWorkspace)
app.post('/v1/workspace/memos/:sessionId/export', recordMemoExport)
app.get('/v1/workspace/memos/:sessionId/members', listMemoWorkspaceMembers)
app.post('/v1/workspace/memos/:sessionId/members', upsertMemoWorkspaceMember)
app.get('/v1/workspace/memos/:sessionId/members/audit', listMemoWorkspaceMemberAudit)

app.get('/v1/markets/:id/stream', marketStreamResponse)

app.get('/api/agents', async (_req, res) => {
  res.json({ agents: await listAgents() })
})

app.get('/v1/agents', async (_req, res) => {
  res.json({ agents: await listAgents() })
})

app.post('/api/agents/register', async (req, res) => {
  try {
    verifyRegistryAuth(req)
    const { manifest, status } = registrationInput(req.body)
    const registration = await registerAgentManifest(manifest, { status })
    res.status(201).json({ ok: true, agent: registration })
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message })
  }
})

app.get('/api/registry/agents', async (_req, res) => {
  res.json({ agents: await listRegisteredAgents() })
})

app.get('/api/registry/discover', async (req, res) => {
  const capabilities = typeof req.query.capabilities === 'string'
    ? req.query.capabilities.split(',').map((item) => item.trim()).filter(Boolean)
    : undefined
  res.json({
    agents: await discoverRegisteredAgents({
      market: typeof req.query.market === 'string' ? req.query.market : undefined,
      capabilities,
    }),
  })
})

app.get('/api/registry/agents/:id', async (req, res) => {
  const agent = await getRegisteredAgent(req.params.id)
  if (!agent) return res.status(404).json({ error: 'registered agent not found', agentId: req.params.id })
  return res.json(agent)
})

app.patch('/api/agents/:id', updateRegisteredAgent)
app.post('/api/agents/:id', updateRegisteredAgent)
app.post('/api/registry/agents/:id/status', updateRegisteredAgentStatus)

app.get('/api/agents/:id', async (req, res) => {
  const agent = await getAgent(req.params.id)
  if (!agent) return res.status(404).json({ error: 'agent not found', agentId: req.params.id })
  return res.json(agent)
})

app.get('/v1/agents/:id', async (req, res) => {
  const agent = await getAgent(req.params.id)
  if (!agent) return res.status(404).json({ error: 'agent not found', agentId: req.params.id })
  return res.json(agent)
})

app.get('/api/sessions', async (_req, res) => {
  res.json({ sessions: await listMarkets() })
})

app.get('/api/memo/:id', async (req, res) => {
  const memo = await getMemo(req.params.id)
  if (!memo) return res.status(404).json({ error: 'memo not found', memoId: req.params.id })
  return res.json(memo)
})

app.get('/v1/memos/:id', async (req, res) => {
  const memo = await getMemo(req.params.id)
  if (!memo) return res.status(404).json({ error: 'memo not found', memoId: req.params.id })
  return res.json(memo)
})

app.get('/v1/settlements/:id', async (req, res) => {
  const settlement = await getSettlement(req.params.id)
  if (!settlement) return res.status(404).json({ error: 'settlement not found', settlementId: req.params.id })
  return res.json(settlement)
})

app.get('/api/reputation/:agent', async (req, res) => {
  res.json({ agentId: req.params.agent, reputation: await getReputation(req.params.agent) })
})

app.get('/api/graph/session/:id', async (req, res) => {
  res.json(await getSessionGraph(req.params.id))
})

/** Operator trigger: launch a market session synchronously for local/Codespaces demo mode. */
async function startSession(_req: Request, res: Response) {
  try {
    const body = _req.body && typeof _req.body === 'object' ? _req.body as { organizationId?: unknown } : {}
    const organizationId = typeof body.organizationId === 'string' && body.organizationId.trim() ? body.organizationId.trim() : undefined
    const publisherId = organizationId ? await authorizeMarketOrganization(_req, organizationId) : undefined
    const result = await launchMarketSession({
      namespace: NS,
      timeoutMs: Math.max(60_000, START_READY_RETRIES * START_READY_RETRY_MS + 10_000),
      onSession: ({ session, namespace }) => {
        sessionNamespaces.set(session, namespace)
        sessionStartedAt.set(session, Date.now())
        console.error(`[feed] launched market session ${session} namespace=${namespace}`)
      },
    })
    if (organizationId) {
      await assignSessionToOrganization({
        organizationId,
        sessionId: result.session,
        assignedBy: publisherId ?? 'system:start-market-api',
      })
    }
    res.status(200).json({ session: result.session, namespace: result.namespace })
    void waitForWant(result.session, result.namespace)
      .catch(async (error) => {
        console.error(`[feed] session=${result.session} namespace=${result.namespace} buyer did not publish WANT: ${(error as Error).message}`)
        console.error(await runtimeDiagnostics())
      })
  } catch (error) {
    const launcher = launcherCommand()
    res.status((error as Error).message.includes('timed out') ? 504 : 500).json({
      error: (error as Error).message,
      command: `${launcher.cmd} ${launcher.args.join(' ')}`,
    })
  }
}

async function enqueueMarketSession(req: Request, res: Response) {
  if (!redisAvailable()) {
    return res.status(503).json({
      error: 'Redis queue is not configured',
      message: 'POST /v1/markets is asynchronous and requires REDIS_URL. Use /api/start for local demo mode.',
      queue: 'not_configured',
    })
  }
  try {
    const namespace = typeof req.body?.namespace === 'string' ? req.body.namespace : NS
    const organizationId = typeof req.body?.organizationId === 'string' && req.body.organizationId.trim() ? req.body.organizationId.trim() : undefined
    const publisherId = organizationId ? await authorizeMarketOrganization(req, organizationId) : undefined
    const idempotencyKey = idempotencyKeyFromRequest(req)
    const { job, existing } = await enqueueStartMarketJob({
      namespace,
      request: req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {},
      idempotencyKey,
      organizationId,
      assignedBy: publisherId,
    })
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      namespace: job.namespace,
      queuedAt: job.createdAt,
      statusUrl: `/v1/market-jobs/${job.id}`,
      session: job.session,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      organizationId: job.organizationId,
      idempotent: existing,
    })
  } catch (error) {
    res.status(502).json({ error: `market enqueue failed: ${(error as Error).message}` })
  }
}

async function authorizeMarketOrganization(req: Request, organizationId: string): Promise<string | undefined> {
  const organization = await getOrganization(organizationId)
  if (!organization) throw new Error(`organization not found: ${organizationId}`)
  if (process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN) {
    return requireOrganizationPermission(req, organization.id, 'admin')
  }
  return verifyWorkspaceWriter(req)
}

function idempotencyKeyFromRequest(req: Request): string | undefined {
  const header = req.header('Idempotency-Key')?.trim()
  if (header) return header
  const bodyKey = (req.body as { idempotencyKey?: unknown } | undefined)?.idempotencyKey
  return typeof bodyKey === 'string' && bodyKey.trim() ? bodyKey.trim() : undefined
}

async function upsertOrganizationWorkspace(req: Request, res: Response) {
  try {
    const publisherId = verifyWorkspaceWriter(req)
    const input = organizationPatchFromBody(req.body)
    const existing = await getOrganization(organizationLookupId(input))
    if (existing && (process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN)) {
      await requireOrganizationPermission(req, existing.id, 'admin')
    }
    const organization = await upsertOrganization({
      ...input,
      createdBy: input.createdBy ?? publisherId,
    })
    if ((process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN) && publisherId) {
      await upsertWorkspaceMembership(organizationScope(organization.id), {
        publisherId,
        role: 'owner',
        grantedBy: 'system:organization-creator',
      })
    }
    res.status(201).json({ ok: true, organization })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

async function assignOrganizationSession(req: Request, res: Response) {
  try {
    const publisherId = verifyWorkspaceWriter(req)
    const organization = await getOrganization(req.params.id)
    if (!organization) throw new Error(`organization not found: ${req.params.id}`)
    if (process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN) {
      await requireOrganizationPermission(req, organization.id, 'admin')
    }
    const body = req.body && typeof req.body === 'object' ? req.body as { sessionId?: unknown } : {}
    if (typeof body.sessionId !== 'string') throw new Error('sessionId is required')
    const assignment = await assignSessionToOrganization({
      organizationId: organization.id,
      sessionId: body.sessionId,
      assignedBy: publisherId,
    })
    res.status(201).json({ ok: true, assignment })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

function organizationPatchFromBody(body: unknown): OrganizationPatch {
  if (!body || typeof body !== 'object') throw new Error('organization body is required')
  return body as OrganizationPatch
}

function organizationLookupId(input: OrganizationPatch): string {
  return input.id?.trim() || input.slug?.trim() || input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function listOrganizationMembers(req: Request, res: Response) {
  const organization = await getOrganization(req.params.id)
  if (!organization) return res.status(404).json({ error: 'organization not found', organizationId: req.params.id })
  res.json({ members: await listWorkspaceMemberships(organizationScope(organization.id)) })
}

async function listOrganizationMemberAudit(req: Request, res: Response) {
  const organization = await getOrganization(req.params.id)
  if (!organization) return res.status(404).json({ error: 'organization not found', organizationId: req.params.id })
  res.json({ audit: await listWorkspaceMembershipAudit(organizationScope(organization.id)) })
}

async function organizationDashboard(req: Request, res: Response) {
  const organization = await getOrganization(req.params.id)
  if (!organization) return res.status(404).json({ error: 'organization not found', organizationId: req.params.id })
  const [assignments, allWorkspaces, members, audit] = await Promise.all([
    listOrganizationSessions(organization.id),
    listMemoWorkspaces(),
    listWorkspaceMemberships(organizationScope(organization.id)),
    listWorkspaceMembershipAudit(organizationScope(organization.id)),
  ])
  const sessionIds = new Set(assignments.map((assignment) => assignment.sessionId))
  const workspaces = allWorkspaces.filter((workspace) => sessionIds.has(workspace.sessionId))
  const markets = (await Promise.all(assignments.map((assignment) => getMarket(assignment.sessionId))))
    .filter((market): market is NonNullable<Awaited<ReturnType<typeof getMarket>>> => Boolean(market))
    .sort((a, b) => b.session.updatedAt.localeCompare(a.session.updatedAt))
  const statusCounts = memoStatusCounts(workspaces)
  const reviewers = [...new Set(workspaces.map((workspace) => workspace.reviewer).filter((reviewer): reviewer is string => Boolean(reviewer)))]
    .sort((a, b) => a.localeCompare(b))
  const exportReadyMemos = workspaces
    .filter((workspace) => workspace.exportReady)
    .map((workspace) => ({
      sessionId: workspace.sessionId,
      memoId: workspace.memoId,
      reviewStatus: workspace.reviewStatus,
      reviewer: workspace.reviewer,
      updatedAt: workspace.updatedAt,
      exportCount: workspace.exportHistory.length,
    }))
  const settlementProof = markets.map((market) => {
    const settlement = latestSettlement(market.settlements)
    return {
      sessionId: market.session.sessionId,
      status: settlement?.status ?? market.session.settlementStatus ?? 'not_started',
      reference: settlement?.reference,
      depositSignature: settlement?.depositSignature,
      releaseSignature: settlement?.releaseSignature,
      depositExplorerUrl: settlement?.depositSignature ? solanaExplorerTx(settlement.depositSignature) : undefined,
      releaseExplorerUrl: settlement?.releaseSignature ? solanaExplorerTx(settlement.releaseSignature) : undefined,
      timestamp: settlement?.timestamp ?? market.session.updatedAt,
    }
  })
  res.json({
    organization,
    summary: {
      sessions: markets.length,
      memos: workspaces.length,
      exportReady: exportReadyMemos.length,
      members: members.filter((member) => member.status === 'active').length,
      settlementProof: settlementProof.filter((proof) => proof.depositSignature || proof.releaseSignature).length,
    },
    sessions: markets.map((market) => market.session),
    assignments,
    memoStatusCounts: statusCounts,
    reviewers,
    exportReadyMemos,
    settlementProof,
    members,
    audit,
    updatedAt: new Date().toISOString(),
  })
}

function memoStatusCounts(workspaces: { reviewStatus: MemoReviewStatus }[]): Record<MemoReviewStatus, number> {
  const counts: Record<MemoReviewStatus, number> = {
    'Needs Review': 0,
    Approved: 0,
    Watchlist: 0,
    Rejected: 0,
  }
  for (const workspace of workspaces) counts[workspace.reviewStatus] += 1
  return counts
}

function latestSettlement(settlements: SettlementRecord[]): SettlementRecord | undefined {
  return [...settlements].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
}

function solanaExplorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`
}

async function upsertOrganizationMember(req: Request, res: Response) {
  try {
    const organization = await getOrganization(req.params.id)
    if (!organization) throw new Error(`organization not found: ${req.params.id}`)
    const publisherId = await requireOrganizationPermission(req, organization.id, 'admin')
    const membership = await upsertWorkspaceMembership(organizationScope(organization.id), {
      ...membershipPatchFromBody(req.body),
      grantedBy: publisherId,
    })
    res.status(201).json({ ok: true, membership })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

async function updateRegisteredAgent(req: Request, res: Response) {
  try {
    verifyRegistryAuth(req)
    const { manifest, status } = registrationInput(req.body)
    const registration = await updateAgentManifest(req.params.id, manifest, { status })
    res.json({ ok: true, agent: registration })
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message })
  }
}

async function updateRegisteredAgentStatus(req: Request, res: Response) {
  try {
    verifyRegistryAuth(req)
    const status = parseRegistryStatus((req.body as { status?: unknown })?.status)
    if (!status) throw new Error('status is required')
    const registration = await transitionAgentStatus(req.params.id, status)
    res.json({ ok: true, agent: registration })
  } catch (error) {
    const message = (error as Error).message
    res.status(message.includes('auth') || message.includes('signature') ? 401 : 400).json({ ok: false, error: message })
  }
}

async function updateMemoWorkspace(req: Request, res: Response) {
  try {
    const publisherId = await requireWorkspacePermission(req, req.params.sessionId, 'edit')
    const workspace = await upsertMemoWorkspace(req.params.sessionId, {
      actor: publisherId,
      ...workspacePatchFromBody(req.body),
    })
    res.json({ ok: true, workspace })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

async function recordMemoExport(req: Request, res: Response) {
  try {
    const publisherId = await requireWorkspacePermission(req, req.params.sessionId, 'edit')
    const workspace = await upsertMemoWorkspace(req.params.sessionId, {
      ...workspacePatchFromBody(req.body),
      actor: workspacePatchFromBody(req.body).actor ?? publisherId,
      recordExport: true,
      exportReady: true,
    })
    res.status(201).json({ ok: true, workspace })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

function workspacePatchFromBody(body: unknown): WorkspacePatch {
  return body && typeof body === 'object' ? body as WorkspacePatch : {}
}

async function listMemoWorkspaceMembers(req: Request, res: Response) {
  res.json({ members: await listWorkspaceMemberships(req.params.sessionId) })
}

async function listMemoWorkspaceMemberAudit(req: Request, res: Response) {
  res.json({ audit: await listWorkspaceMembershipAudit(req.params.sessionId) })
}

async function upsertMemoWorkspaceMember(req: Request, res: Response) {
  try {
    const publisherId = await requireWorkspacePermission(req, req.params.sessionId, 'admin')
    const membership = await upsertWorkspaceMembership(req.params.sessionId, {
      ...membershipPatchFromBody(req.body),
      grantedBy: publisherId,
    })
    res.status(201).json({ ok: true, membership })
  } catch (error) {
    const message = (error as Error).message
    res.status(authStatus(message)).json({ ok: false, error: message })
  }
}

function membershipPatchFromBody(body: unknown): MembershipPatch {
  if (!body || typeof body !== 'object') throw new Error('membership body is required')
  return body as MembershipPatch
}

function verifyRegistryAuth(req: Request): void {
  const secret = process.env.REGISTRY_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN
  verifySignedRequest(signedRequestFromExpress(req), secret, 'registry')
}

async function requireWorkspacePermission(req: Request, sessionId: string, action: 'edit' | 'admin'): Promise<string | undefined> {
  const secret = process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN
  const publisherId = verifySignedRequest(signedRequestFromExpress(req), secret, 'workspace')
  if (secret) await ensureSessionOrOrganizationPermission({ sessionId, publisherId, action })
  return publisherId
}

function verifyWorkspaceWriter(req: Request): string | undefined {
  const secret = process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN
  return verifySignedRequest(signedRequestFromExpress(req), secret, 'workspace')
}

async function requireOrganizationPermission(req: Request, organizationId: string, action: 'edit' | 'admin'): Promise<string | undefined> {
  const secret = process.env.WORKSPACE_AUTH_SECRET ?? process.env.MARKETPLACE_API_TOKEN
  const publisherId = verifySignedRequest(signedRequestFromExpress(req), secret, 'workspace')
  if (secret) await ensureWorkspacePermission({ sessionId: organizationScope(organizationId), publisherId, action })
  return publisherId
}

function signedRequestFromExpress(req: Request) {
  return {
    method: req.method,
    path: req.path,
    rawBody: (req as Request & { rawBody?: string }).rawBody ?? '',
    header: (name: string) => req.header(name),
  }
}

function authStatus(message: string): number {
  return message.includes('auth') || message.includes('signature') || message.includes('membership') || message.includes('permission') ? 401 : 400
}

function registrationInput(body: unknown): { manifest: unknown; status?: RegistryStatus } {
  if (!body || typeof body !== 'object') return { manifest: body }
  const obj = body as { manifest?: unknown; status?: unknown }
  const status = parseRegistryStatus(obj.status)
  return { manifest: obj.manifest ?? body, status }
}

function parseRegistryStatus(value: unknown): RegistryStatus | undefined {
  if (value === undefined) return undefined
  if (value === 'pending' || value === 'active' || value === 'verified' || value === 'suspended') return value
  throw new Error(`invalid registry status: ${String(value)}`)
}

async function waitForWant(session: string, namespace: string): Promise<void> {
  let lastError = ''
  for (let attempt = 1; attempt <= START_READY_RETRIES; attempt += 1) {
    try {
      const messages = collectMessages(await readState(session, namespace))
      const want = messages.find((message) => /^WANT\b/.test(message.text.trim()))
      if (want) {
        console.error(`[feed] session=${session} namespace=${namespace} first WANT observed from ${want.sender}`)
        return
      }
      lastError = `readable session has ${messages.length} message(s), but no WANT yet`
    } catch (error) {
      lastError = (error as Error).message
    }
    if (attempt < START_READY_RETRIES) {
      console.error(`[feed] session=${session} namespace=${namespace} waiting for WANT ${attempt}/${START_READY_RETRIES}: ${lastError}`)
      await sleep(START_READY_RETRY_MS)
    }
  }
  throw new Error(lastError || 'Timed out waiting for buyer WANT')
}

async function runtimeDiagnostics(): Promise<string> {
  const commands = [
    ['docker ps', ['ps', '--format', 'table {{.Names}}\t{{.Image}}\t{{.Status}}']],
    ['coral logs', ['logs', '--tail', '80', 'coral']],
    ['buyer logs', ['logs', '--tail', '80', 'buyer-agent']],
    ['market analyst logs', ['logs', '--tail', '40', 'market-analyst']],
    ['news earnings logs', ['logs', '--tail', '40', 'news-earnings']],
    ['macro risk logs', ['logs', '--tail', '40', 'macro-risk']],
    ['portfolio risk logs', ['logs', '--tail', '40', 'portfolio-risk']],
  ] as const
  const out: string[] = []
  for (const [label, args] of commands) {
    out.push(`\n--- ${label} ---`)
    out.push(await dockerOutput(args))
  }
  return out.join('\n')
}

function dockerOutput(args: readonly string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('docker', [...args], { shell: false })
    let output = ''
    child.stdout.on('data', (data) => { output += data.toString() })
    child.stderr.on('data', (data) => { output += data.toString() })
    child.on('error', (error) => resolve((error as Error).message))
    child.on('close', () => resolve(output.trim() || 'no output'))
  })
}

app.get('/api/sessions/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

app.get('/session/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

app.get('/api/session/:id', async (req, res) => {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  res.status(result.status).json(result.body)
})

async function marketStatusResponse(req: Request, res: Response) {
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(req.params.id) || NS
  const result = await feedSnapshot(req.params.id, requestedNamespace)
  const body = result.body as FeedResponse
  res.status(result.status).json({
    session: body.session,
    namespace: body.namespace,
    status: body.marketStatus.currentStage,
    currentStage: body.marketStatus.currentStage,
    currentStageLabel: body.marketStatus.currentStageLabel,
    latestRound: body.marketStatus.latestRound,
    winningAgent: body.marketStatus.winningAgent,
    settlementStatus: body.marketStatus.settlementStatus,
    explorerLink: body.marketStatus.explorerLink,
    elapsedMs: body.marketStatus.elapsedMs,
    dataSource: body.marketStatus.dataSource,
    diagnostics: body.diagnostics,
    updatedAt: body.updatedAt,
    error: body.error,
  })
}

app.get('/api/market/:id/status', marketStatusResponse)
app.get('/market/:id', marketStatusResponse)
app.get('/api/market/:id', marketStatusResponse)

async function marketStreamResponse(req: Request, res: Response) {
  const session = req.params.id
  const requestedNamespace = (req.query.namespace as string) || sessionNamespaces.get(session) || NS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  let closed = false
  req.on('close', () => { closed = true })
  const send = async () => {
    if (closed) return
    const result = await feedSnapshot(session, requestedNamespace)
    res.write(`event: snapshot\n`)
    res.write(`data: ${JSON.stringify(result.body)}\n\n`)
  }
  await send()
  const id = setInterval(() => { void send() }, 1000)
  req.on('close', () => clearInterval(id))
}

app.get('/api/feed', async (req, res) => {
  const session = FIXTURE ? 'fixture' : ((req.query.session as string) || DEFAULT_SESSION)
  const requestedNamespace = FIXTURE ? 'fixture' : ((req.query.namespace as string) || sessionNamespaces.get(session) || NS)
  const result = await feedSnapshot(session, requestedNamespace)
  res.status(result.status).json(result.body)
})

interface FeedResponse {
  session: string
  namespace?: string
  rounds: Round[]
  updatedAt: string
  diagnostics: ReturnType<typeof diagnostics>
  marketStatus: MarketStatus
  error?: string
}

async function feedSnapshot(session: string, requestedNamespace: string): Promise<{ status: number; body: FeedResponse }> {
  if (!FIXTURE && !session) {
    const marketStatus = deriveMarketStatus({ rounds: [] })
    return {
      status: 200,
      body: {
      session: '',
      rounds: [],
      updatedAt: new Date().toISOString(),
      marketStatus,
      diagnostics: {
        api: 'ok',
        coral: 'not_checked',
        build: BUILD,
        currentStage: marketStatus.currentStage,
        currentStageLabel: marketStatus.currentStageLabel,
        elapsedMs: marketStatus.elapsedMs,
        messageCount: 0,
        lastEventType: 'NONE',
        lastEvent: 'No session supplied',
        buyerStatus: marketStatus.buyerStatus,
        sellerStatus: marketStatus.sellerStatus,
        sellerBidCount: marketStatus.sellerBidCount,
        winningAgent: marketStatus.winningAgent,
        settlementStatus: marketStatus.settlementStatus,
        explorerLink: marketStatus.explorerLink,
        dataSource: marketStatus.dataSource,
        escrowStatus: marketStatus.settlementStatus,
      },
      },
    }
  }
  try {
    const messages = collectMessages(await readState(session, requestedNamespace))
    const namespace = sessionNamespaces.get(session) || requestedNamespace
    const rounds = foldRounds(messages, SELLERS)
    const marketStatus = deriveMarketStatus({ session, rounds, startedAt: sessionStartedAt.get(session) })
    const diag = diagnostics(messages, rounds, marketStatus)
    console.error(`[feed] session=${session} namespace=${namespace} messages=${diag.messageCount} rounds=${rounds.length} last_event_type=${diag.lastEventType} seller_bids=${diag.sellerBidCount} escrow=${diag.escrowStatus}`)
    void persistMarketplaceData({ sessionId: session, rounds }).catch((error) => {
      console.error(`[feed] persistence failed for session ${session}: ${(error as Error).message}`)
    })
    return {
      status: 200,
      body: { session, namespace, rounds, updatedAt: new Date().toISOString(), diagnostics: diag, marketStatus },
    }
  } catch (e) {
    const marketStatus = deriveMarketStatus({ session, rounds: [], startedAt: sessionStartedAt.get(session), error: (e as Error).message })
    return {
      status: 502,
      body: {
      session,
      namespace: sessionNamespaces.get(session) || requestedNamespace,
      rounds: [],
      updatedAt: new Date().toISOString(),
      error: `feed failed: ${(e as Error).message}`,
      marketStatus,
      diagnostics: {
        api: 'ok',
        coral: 'unreachable',
        build: BUILD,
        messageCount: 0,
        lastEventType: 'ERROR',
        lastEvent: (e as Error).message,
        currentStage: marketStatus.currentStage,
        currentStageLabel: marketStatus.currentStageLabel,
        elapsedMs: marketStatus.elapsedMs,
        buyerStatus: marketStatus.buyerStatus,
        sellerStatus: marketStatus.sellerStatus,
        sellerBidCount: 0,
        winningAgent: marketStatus.winningAgent,
        settlementStatus: marketStatus.settlementStatus,
        explorerLink: marketStatus.explorerLink,
        dataSource: marketStatus.dataSource,
        escrowStatus: marketStatus.settlementStatus,
      },
      },
    }
  }
}

app.listen(PORT, () => console.error(`[feed] http://localhost:${PORT}/api/feed  (${FIXTURE ? `fixture=${FIXTURE}` : `coral=${BASE}`})`))

function diagnostics(messages: RawMessage[], rounds: Round[], marketStatus: MarketStatus) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const last = messages.at(-1)
  return {
    api: 'ok',
    coral: 'ok',
    build: BUILD,
    currentStage: marketStatus.currentStage,
    currentStageLabel: marketStatus.currentStageLabel,
    elapsedMs: marketStatus.elapsedMs,
    messageCount: messages.length,
    lastEventType: last ? lastEventType(last.text) : 'NONE',
    lastEvent: last ? `${last.sender}: ${last.text.slice(0, 160)}` : 'No events for this session yet',
    buyerStatus: marketStatus.buyerStatus,
    sellerStatus: marketStatus.sellerStatus,
    sellerBidCount: marketStatus.sellerBidCount,
    winningAgent: marketStatus.winningAgent,
    settlementStatus: marketStatus.settlementStatus,
    explorerLink: marketStatus.explorerLink,
    dataSource: marketStatus.dataSource,
    escrowStatus: marketStatus.settlementStatus,
  }
}

function lastEventType(text: string): string {
  return text.trim().match(/^([A-Z_]+)/)?.[1] ?? 'UNKNOWN'
}

async function coralHealth(): Promise<{ ok: boolean; status: string }> {
  if (FIXTURE) return { ok: true, status: 'fixture mode' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(`${BASE}/api/v1/local/session/${NS}/__healthcheck__/extended`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: controller.signal,
    })
    if (res.status === 404) return { ok: true, status: 'reachable' }
    return { ok: res.ok, status: `${res.status} ${res.statusText}` }
  } catch (error) {
    return { ok: false, status: (error as Error).message }
  } finally {
    clearTimeout(timeout)
  }
}
