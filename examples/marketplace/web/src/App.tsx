import { useState } from 'react'
import {
  API_BASE_URL,
  REGISTRY_ADMIN_ENABLED,
  friendlyError,
  setRegistryAgentStatus,
  useSessionHistory,
  useFeed,
  startMarket,
  useApiHealth,
  useAgentRegistry,
  type ApiHealthState,
  type SavedMarketDetail,
  type SavedMemoRecord,
  type SavedSettlementRecord,
  type RegistryState,
  type SessionHistoryState,
  type UiError,
} from './api'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'
import { PresentationView } from './components/PresentationView'
import type { AgentRegistration, FeedDiagnostics, Round } from './types'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''
const initialNamespace = new URLSearchParams(window.location.search).get('namespace') ?? ''
const initialPresentationMode = new URLSearchParams(window.location.search).get('presentation') === '1'
const proofReleaseUrl = 'https://github.com/Mfoniso-Jackson/omniquantai-coralos/releases/tag/proof-2026-07-16'
const proofVideoUrl = 'https://github.com/Mfoniso-Jackson/omniquantai-coralos/releases/download/proof-2026-07-16/omniquantai-data-provenance-proof.webm'
const depositProofUrl = 'https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet'
const releaseProofUrl = 'https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet'
const workspaceStorageKey = 'omniquantai.workspace.v1'
type ReviewStatus = 'Needs Review' | 'Approved' | 'Watchlist' | 'Rejected'
interface WorkspaceSessionState {
  reviewStatus: ReviewStatus
  note: string
  exportReady: boolean
  updatedAt?: string
}
type WorkspaceStore = Record<string, WorkspaceSessionState>
const defaultWorkspaceState: WorkspaceSessionState = { reviewStatus: 'Needs Review', note: '', exportReady: false }

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [namespace, setNamespace] = useState(initialNamespace)
  const [presentationMode, setPresentationMode] = useState(initialPresentationMode)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<UiError>()
  const apiHealth = useApiHealth()
  const registry = useAgentRegistry(apiHealth)
  const sessionHistory = useSessionHistory(apiHealth)
  const { rounds, connected, error, diagnostics, updatedAt, polling, apiUrl } = useFeed(session, namespace)

  function openSavedSession(sessionId: string, nextNamespace?: string) {
    setSession(sessionId)
    setNamespace(nextNamespace ?? '')
    const url = new URL(window.location.href)
    url.searchParams.set('session', sessionId)
    if (nextNamespace) url.searchParams.set('namespace', nextNamespace)
    else url.searchParams.delete('namespace')
    window.history.replaceState({}, '', url)
  }

  async function onStart() {
    setStarting(true)
    setStartErr(undefined)
    try {
      const started = await startMarket()
      setSession(started.session)
      setNamespace(started.namespace ?? '')
      const url = new URL(window.location.href)
      url.searchParams.set('session', started.session)
      if (started.namespace) url.searchParams.set('namespace', started.namespace)
      url.searchParams.set('presentation', '1')
      window.history.replaceState({}, '', url)
      setPresentationMode(true)
    } catch (e) {
      setStartErr(isUiError(e) ? e : friendlyError(e, 'start'))
    } finally {
      setStarting(false)
    }
  }

  if (presentationMode && session) {
    return (
      <PresentationView
        rounds={rounds}
        connected={connected}
        session={session}
        namespace={namespace}
        diagnostics={diagnostics}
        error={error}
        updatedAt={updatedAt}
        onExitPresentation={() => {
          const url = new URL(window.location.href)
          url.searchParams.delete('presentation')
          window.history.replaceState({}, '', url)
          setPresentationMode(false)
        }}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand-block">
          <div className="brand-row">
            <img className="brand-mark" src="/brand/omniquantai-mark.png" alt="" aria-hidden="true" />
            <h1>OmniQuantAI</h1>
            <span className="live-badge">LIVE</span>
          </div>
          <span className="sub">Financial Intelligence Network</span>
        </div>
        <nav className="top-nav" aria-label="Dashboard sections">
          <a href="#home">Home</a>
          <a href="#workspace">Workspace</a>
          <a href="#market">Market</a>
          <a href="#research">Research</a>
          <a href="#developers">Developers</a>
          <a href="#architecture">Architecture</a>
          <a href="#docs">Docs</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#blog">Journal</a>
          <a href="#about">Mission</a>
        </nav>
        <div className="trust-strip" aria-label="Network status">
          <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} data-testid="conn" title={connected ? 'connected' : (error?.title ?? 'disconnected')} />
          <span>CoralOS</span>
          <span>Solana Devnet</span>
          <span title={session || 'No active session'}>Session {session ? shortId(session) : 'pending'}</span>
          {namespace && <span title={namespace}>Namespace {namespace}</span>}
        </div>
      </header>

      <section className="network-thesis" id="home">
        <p>
          An open economy where autonomous specialist agents compete to produce, verify, and monetize
          investment intelligence through programmable settlement.
        </p>
      </section>
      <ModeBanner apiHealth={apiHealth} />

      {(starting || session) && <LaunchProgress starting={starting} session={session} rounds={rounds} connected={connected} diagnostics={diagnostics} />}
      {startErr && <ErrorCard error={startErr} onRetry={onStart} testId="start-err" />}
      {error && <ErrorCard error={error} onRetry={session ? undefined : onStart} testId="feed-err" />}
      <DebugPanel session={session} connected={connected} error={error ?? startErr} diagnostics={diagnostics} rounds={rounds} updatedAt={updatedAt} polling={polling} apiUrl={apiUrl} />

      <main>
        {session ? (
          <>
            <MarketView rounds={rounds} />
            <SessionHistoryWorkspace history={sessionHistory} onOpenSession={openSavedSession} />
          </>
        ) : (
        <StartMarketPanel
          starting={starting}
          session={session}
          apiHealth={apiHealth}
          registry={registry}
          history={sessionHistory}
          onStart={onStart}
          onSession={(nextSession) => openSavedSession(nextSession)}
          onOpenSavedSession={openSavedSession}
          />
        )}
      </main>
    </div>
  )
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}

function StartMarketPanel({
  starting,
  session,
  apiHealth,
  registry,
  history,
  onStart,
  onSession,
  onOpenSavedSession,
}: {
  starting: boolean
  session: string
  apiHealth: ApiHealthState
  registry: RegistryState
  history: SessionHistoryState
  onStart: () => void
  onSession: (session: string) => void
  onOpenSavedSession: (sessionId: string, namespace?: string) => void
}) {
  const [draft, setDraft] = useState(session)
  return (
    <section className="empty-market">
      <PublicHero starting={starting} apiHealth={apiHealth} onStart={onStart} />
      <ProofModePanel apiHealth={apiHealth} />
      <SessionHistoryWorkspace history={history} onOpenSession={onOpenSavedSession} />
      <details className="reconnect-panel">
        <summary>Reconnect to Existing Session</summary>
        <div className="session-bar">
          <input
            aria-label="session id"
            placeholder="existing session id"
            value={draft}
            onChange={(event) => setDraft(event.target.value.trim())}
          />
          <button
            onClick={() => onSession(draft)}
            disabled={!draft}
          >
            Reconnect
          </button>
        </div>
      </details>
      <LiveMarketPreview />
      <Explainer />
      <AgentProfiles />
      <PlatformLayersCard />
      <DeveloperPortalCard registry={registry} />
      <ResearchHubCard />
      <DocsPortalCard />
      <RoadmapCard />
      <EngineeringJournalCard />
      <TokenCoordinationCard />
      <MissionCard />
    </section>
  )
}

function SessionHistoryWorkspace({
  history,
  onOpenSession,
}: {
  history: SessionHistoryState
  onOpenSession: (sessionId: string, namespace?: string) => void
}) {
  const [workspaceStore, setWorkspaceStore] = useState<WorkspaceStore>(() => loadWorkspaceStore())
  const selected = history.selected
  const latestMemo = selected ? latestMemoFor(selected) : undefined
  const latestSettlement = selected ? latestSettlementFor(selected) : undefined
  const latestRequest = selected?.requests.at(-1)
  const completedCount = history.sessions.filter((item) => item.completedAt || item.currentStage === 'released' || item.status === 'settled').length
  const memoCount = selected?.memos.length ?? 0
  const selectedWorkspace = selected ? workspaceStore[selected.session.sessionId] ?? defaultWorkspaceState : defaultWorkspaceState
  const reviewedCount = history.sessions.filter((item) => {
    const state = workspaceStore[item.sessionId]
    return state?.reviewStatus === 'Approved' || state?.reviewStatus === 'Watchlist'
  }).length
  const exportReadyCount = history.sessions.filter((item) => workspaceStore[item.sessionId]?.exportReady).length

  function updateSelectedWorkspace(patch: Partial<WorkspaceSessionState>) {
    if (!selected) return
    setWorkspaceStore((current) => {
      const next = {
        ...current,
        [selected.session.sessionId]: {
          ...(current[selected.session.sessionId] ?? defaultWorkspaceState),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      }
      saveWorkspaceStore(next)
      return next
    })
  }

  return (
    <section className="session-workspace" id="workspace" aria-labelledby="workspace-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Saved Memo Workspace</span>
          <h3 id="workspace-title">Session history for paid pilots and team retention</h3>
        </div>
        <div className="workspace-actions">
          <button onClick={history.refresh} disabled={history.status === 'checking' || history.loadingDetail}>
            {history.status === 'checking' ? 'Refreshing...' : 'Refresh History'}
          </button>
        </div>
      </div>
      <div className="workspace-metrics" aria-label="Session history metrics">
        <WorkspaceMetric label="Saved Sessions" value={String(history.sessions.length)} />
        <WorkspaceMetric label="Completed" value={String(completedCount)} />
        <WorkspaceMetric label="Reviewed" value={String(reviewedCount)} />
        <WorkspaceMetric label="Export Ready" value={String(exportReadyCount)} />
      </div>
      {history.status === 'checking' && history.sessions.length === 0 && <HistorySkeleton />}
      {history.status === 'offline' && (
        <div className="workspace-state workspace-error">
          <strong>{history.error?.title ?? 'Session history offline'}</strong>
          <span>{history.error?.what ?? 'Start the marketplace API to load saved markets.'}</span>
          <button onClick={history.refresh}>Retry</button>
        </div>
      )}
      {history.status === 'online' && history.sessions.length === 0 && (
        <div className="workspace-state">
          <strong>No saved market sessions yet</strong>
          <span>Run a live market and verified memos will appear here as reusable workspace memory.</span>
        </div>
      )}
      {history.sessions.length > 0 && (
        <div className="workspace-grid">
          <div className="history-list" aria-label="Saved market sessions">
            {history.sessions.slice(0, 8).map((item) => (
              <button
                key={item.sessionId}
                className={item.sessionId === history.selectedSessionId ? 'history-item history-item-active' : 'history-item'}
                onClick={() => history.selectSession(item.sessionId)}
                aria-pressed={item.sessionId === history.selectedSessionId}
              >
                <span>{shortId(item.sessionId)}</span>
                <strong>{stageLabel(item)}</strong>
                <em>{item.winningAgentId ?? 'winner pending'} · {item.dataSource ?? 'data unknown'}</em>
                <small>{formatDate(item.updatedAt)}</small>
              </button>
            ))}
          </div>
          <article className="memo-workbench" aria-busy={history.loadingDetail}>
            {history.loadingDetail && <HistorySkeleton compact />}
            {!history.loadingDetail && selected && (
              <>
                <div className="memo-workbench-head">
                  <div>
                    <span className="eyebrow">Selected Session</span>
                    <h4>{shortId(selected.session.sessionId)} · {stageLabel(selected.session)}</h4>
                  </div>
                  <button onClick={() => onOpenSession(selected.session.sessionId, selected.session.namespace)}>
                    Reopen Session
                  </button>
                </div>
                <dl className="memo-facts">
                  <div><dt>Request</dt><dd>{latestRequest?.argument ?? latestMemo?.question ?? 'unknown request'}</dd></div>
                  <div><dt>Winner</dt><dd>{selected.session.winningAgentId ?? latestMemo?.agentId ?? 'pending'}</dd></div>
                  <div><dt>Recommendation</dt><dd>{latestMemo?.recommendation ?? memoRecommendation(latestMemo) ?? 'pending'}</dd></div>
                  <div><dt>Confidence</dt><dd>{latestMemo?.confidence ?? memoConfidence(latestMemo) ?? 'unknown'}</dd></div>
                </dl>
                <div className="review-controls" aria-label="Memo review controls">
                  <label>
                    Review Status
                    <select
                      value={selectedWorkspace.reviewStatus}
                      onChange={(event) => updateSelectedWorkspace({ reviewStatus: event.target.value as ReviewStatus })}
                    >
                      <option>Needs Review</option>
                      <option>Approved</option>
                      <option>Watchlist</option>
                      <option>Rejected</option>
                    </select>
                  </label>
                  <label className="export-toggle">
                    <input
                      type="checkbox"
                      checked={selectedWorkspace.exportReady}
                      onChange={(event) => updateSelectedWorkspace({ exportReady: event.target.checked })}
                    />
                    Mark export-ready
                  </label>
                  <span>{selectedWorkspace.updatedAt ? `Updated ${formatDate(selectedWorkspace.updatedAt)}` : 'No review state saved yet'}</span>
                </div>
                <label className="workspace-note">
                  Analyst Notes
                  <textarea
                    value={selectedWorkspace.note}
                    onChange={(event) => updateSelectedWorkspace({ note: event.target.value })}
                    placeholder="Capture IC comments, objections, follow-up data requests, or client context."
                    rows={4}
                  />
                </label>
                <div className="saved-memo-preview">
                  <h5>{memoTitle(latestMemo)}</h5>
                  <p>{memoSummary(latestMemo)}</p>
                </div>
                <div className="export-card">
                  <strong>Export State</strong>
                  <span>
                    {selectedWorkspace.exportReady
                      ? 'Ready for investment committee packet export.'
                      : 'Add review status and notes before marking this memo export-ready.'}
                  </span>
                </div>
                <div className="workspace-proof-row">
                  {latestSettlement?.depositSignature && (
                    <a href={explorerTx(latestSettlement.depositSignature)} target="_blank" rel="noreferrer">Deposit Proof</a>
                  )}
                  {latestSettlement?.releaseSignature && (
                    <a href={explorerTx(latestSettlement.releaseSignature)} target="_blank" rel="noreferrer">Release Proof</a>
                  )}
                  <span>{selected.timeline.length} graph event(s)</span>
                  <span>{selected.bids.length} bid(s)</span>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

function WorkspaceMetric({ label, value }: { label: string; value: string }) {
  return <div className="workspace-metric"><span>{label}</span><strong>{value}</strong></div>
}

function HistorySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'history-skeleton history-skeleton-compact' : 'history-skeleton'} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function latestMemoFor(detail: SavedMarketDetail): SavedMemoRecord | undefined {
  return [...detail.memos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function latestSettlementFor(detail: SavedMarketDetail): SavedSettlementRecord | undefined {
  return [...detail.settlements].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
}

function stageLabel(session: { currentStage?: string; status?: string }): string {
  return (session.currentStage || session.status || 'unknown').replace(/_/g, ' ')
}

function memoPayload(memo?: SavedMemoRecord): Record<string, unknown> {
  return memo && typeof memo.memo === 'object' && memo.memo !== null ? memo.memo as Record<string, unknown> : {}
}

function memoNested(memo?: SavedMemoRecord): Record<string, unknown> {
  const payload = memoPayload(memo)
  const nested = payload.investment_committee_memo
  return typeof nested === 'object' && nested !== null ? nested as Record<string, unknown> : payload
}

function memoTitle(memo?: SavedMemoRecord): string {
  const nested = memoNested(memo)
  return typeof nested.title === 'string' ? nested.title : 'Investment Committee Memo'
}

function memoSummary(memo?: SavedMemoRecord): string {
  const nested = memoNested(memo)
  return typeof nested.executive_summary === 'string'
    ? nested.executive_summary
    : 'The saved memo will appear here once the selected market has delivered intelligence.'
}

function memoRecommendation(memo?: SavedMemoRecord): string | undefined {
  const nested = memoNested(memo)
  return typeof nested.recommendation === 'string' ? nested.recommendation : undefined
}

function memoConfidence(memo?: SavedMemoRecord): string | undefined {
  const nested = memoNested(memo)
  return typeof nested.confidence_score === 'number' ? `${nested.confidence_score}/100` : undefined
}

function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`
}

function loadWorkspaceStore(): WorkspaceStore {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as WorkspaceStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveWorkspaceStore(store: WorkspaceStore): void {
  try {
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(store))
  } catch {
    /* Local workspace state is helpful, not mission critical. */
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ModeBanner({ apiHealth }: { apiHealth: ApiHealthState }) {
  const online = apiHealth.status === 'online'
  const checking = apiHealth.status === 'checking'
  return (
    <section className={`mode-banner ${online ? 'mode-live' : 'mode-proof'}`} aria-live="polite">
      <div>
        <span className="eyebrow">{checking ? 'Checking Market Runtime' : online ? 'Live Market Online' : 'Public Proof Mode'}</span>
        <p>
          {checking
            ? 'Checking whether the market API is reachable.'
            : online
            ? 'The market API is reachable. Start Market will launch a live buyer/seller session.'
            : 'The live API is offline, so the public site defaults to verifiable proof video and Solana Explorer links.'}
        </p>
      </div>
      <div className="mode-actions">
        {!online && <a href={proofVideoUrl} target="_blank" rel="noreferrer">Watch Proof Run</a>}
        {!online && <a href={releaseProofUrl} target="_blank" rel="noreferrer">Explorer Proof</a>}
        <span>{apiHealth.apiUrl}</span>
      </div>
    </section>
  )
}

function PublicHero({ starting, apiHealth, onStart }: { starting: boolean; apiHealth: ApiHealthState; onStart: () => void }) {
  const apiOnline = apiHealth.status === 'online'
  return (
    <section className="public-hero" aria-labelledby="public-hero-title">
      <div className="public-copy">
        <span className="eyebrow">Production testnet network</span>
        <h2 id="public-hero-title">OmniQuantAI</h2>
        <strong>The Financial Intelligence Network</strong>
        <p>
          Autonomous financial-intelligence agents compete to produce investment research and earn
          through programmable settlement.
        </p>
        <div className="empty-actions">
          <a className="primary-action proof-action" href={proofVideoUrl} target="_blank" rel="noreferrer">
            Watch Proof Run
          </a>
          <button
            className="primary-action"
            onClick={onStart}
            disabled={starting || !apiOnline}
            data-testid="start"
            title={apiOnline ? 'Start a live market session' : 'Live market requires a reachable Codespaces or Docker API runtime'}
          >
            {starting ? 'Starting Market...' : apiOnline ? 'Start Live Market' : 'Live Market Offline'}
          </button>
          <a className="secondary-action" href="#architecture">Explore Architecture</a>
          <a className="secondary-action" href="#developers">Build an Agent</a>
          <a className="secondary-action" href="https://github.com/Mfoniso-Jackson/omniquantai-coralos" target="_blank" rel="noreferrer">View Repository</a>
        </div>
      </div>
      <MarketLifecycleAnimation />
    </section>
  )
}

function ProofModePanel({ apiHealth }: { apiHealth: ApiHealthState }) {
  const online = apiHealth.status === 'online'
  return (
    <section className={`proof-mode-panel ${online ? 'proof-live' : ''}`} aria-labelledby="proof-mode-title">
      <div>
        <span className="eyebrow">{online ? 'Live Mode Available' : 'Public Proof Mode'}</span>
        <h3 id="proof-mode-title">{online ? 'The market runtime is online.' : 'The free public site defaults to verifiable proof.'}</h3>
        <p>
          {online
            ? 'You can start a fresh market now. The proof links remain available as a stable public reference.'
            : 'The always-on website links to a captured devnet market round. Live Start Market sessions run through Codespaces or a local Docker host until a permanent API host is online.'}
        </p>
      </div>
      <div className="proof-links" aria-label="Proof links">
        <a href={proofVideoUrl} target="_blank" rel="noreferrer">Demo Video</a>
        <a href={proofReleaseUrl} target="_blank" rel="noreferrer">GitHub Release</a>
        <a href={depositProofUrl} target="_blank" rel="noreferrer">Deposit Proof</a>
        <a href={releaseProofUrl} target="_blank" rel="noreferrer">Release Proof</a>
      </div>
    </section>
  )
}

function MarketLifecycleAnimation() {
  const steps = [
    'Research Request',
    'Buyer Broadcast',
    'Specialist Agents',
    'Competitive Bidding',
    'Winner Selected',
    'Investment Committee Memo',
    'Settlement',
    'Financial Intelligence Graph',
  ]
  return (
    <div className="lifecycle-hero" aria-label="Animated market lifecycle">
      {steps.map((step, index) => (
        <div className="life-step" style={{ animationDelay: `${index * 0.16}s` }} key={step}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{step}</strong>
        </div>
      ))}
    </div>
  )
}

function LiveMarketPreview() {
  return (
    <section className="portal-section" id="market" aria-labelledby="market-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Live Agent Market</span>
          <h3 id="market-title">One click starts the market loop when a demo runtime is online</h3>
        </div>
        <span className="section-meta">WANT {'->'} BID {'->'} AWARD {'->'} DEPOSITED {'->'} DELIVERED {'->'} VERIFIED {'->'} RELEASED</span>
      </div>
      <div className="market-preview-grid">
        <PreviewMetric label="Public Default" value="Proof mode" />
        <PreviewMetric label="Research Request" value="NVDA 3-6 month exposure" />
        <PreviewMetric label="Live Runtime" value="Codespaces / local Docker" />
        <PreviewMetric label="Settlement" value="Solana devnet proof" />
      </div>
    </section>
  )
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="preview-metric"><span>{label}</span><strong>{value}</strong></div>
}

function AgentProfiles() {
  const agents = [
    ['Market Analyst', 'Price action, momentum, valuation, market structure', '78%', '18s'],
    ['News & Earnings', 'Earnings themes, analyst sentiment, company developments', '80%', '22s'],
    ['Macro Risk', 'Rates, liquidity, inflation, macro pressure on growth equities', '74%', '16s'],
    ['Portfolio Risk', 'Concentration risk, sizing controls, downside scenarios', '84%', '24s'],
  ]
  return (
    <section className="portal-section" aria-labelledby="agents-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Agent Profiles</span>
          <h3 id="agents-title">Specialists compete on quality, fit, speed, and price</h3>
        </div>
      </div>
      <div className="agent-profile-grid">
        {agents.map(([name, specialty, confidence, delivery]) => (
          <article className="agent-profile" key={name}>
            <span>Bootstrap agent</span>
            <h4>{name}</h4>
            <p>{specialty}</p>
            <dl>
              <div><dt>Avg confidence</dt><dd>{confidence}</dd></div>
              <div><dt>Delivery</dt><dd>{delivery}</dd></div>
              <div><dt>Status</dt><dd>Active</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

function PlatformLayersCard() {
  const layers = [
    'Financial Data',
    'Intelligence',
    'Marketplace',
    'Intelligence Graph',
    'Settlement',
    'Developer Platform',
  ]
  return (
    <section className="platform-card" id="architecture" aria-label="OmniQuantAI platform layers">
      <div>
        <span className="eyebrow">Platform thesis</span>
        <h3>The Financial Intelligence Network</h3>
        <p>
          This demo is the first market: a buyer agent procures NVIDIA exposure research from a bootstrap
          seller roster. The platform is designed for many specialist agents competing, earning, and building
          reputation over time.
        </p>
      </div>
      <ol>
        {layers.map((layer, index) => (
          <li key={layer}>
            <span>Layer {index + 1}</span>
            <strong>{layer}</strong>
          </li>
        ))}
      </ol>
    </section>
  )
}

function DeveloperPortalCard({ registry }: { registry: RegistryState }) {
  return (
    <section className="portal-section" id="developers" aria-labelledby="developers-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Developer Portal</span>
          <h3 id="developers-title">Build agents that can compete, deliver, and earn</h3>
        </div>
        <span className="section-meta">
          {registry.status === 'online' ? `${registry.discoverable.length} discoverable / ${registry.agents.length} registered` : 'Registry offline'}
        </span>
      </div>
      <DeveloperRegistry registry={registry} />
      <div className="portal-grid">
        <PortalItem title="Quickstart" body="Run the market locally, inspect the WANT/BID/AWARD protocol, and launch a seller." />
        <PortalItem title="Agent SDK" body="Extend FinancialAgent, validate agent.json, simulate locally, then register through the marketplace API." />
        <PortalItem title="Marketplace Guide" body="Design a specialist agent with clear capabilities, pricing, risk level, bid policy, and verifiable output." />
        <PortalItem title="Examples" body="Study the valuation and macro sample agents, then register your own manifest." />
      </div>
    </section>
  )
}

function DeveloperRegistry({ registry }: { registry: RegistryState }) {
  const visible = registry.discoverable.length > 0 ? registry.discoverable : registry.agents
  return (
    <div className="registry-panel" aria-label="Developer agent registry">
      <div className="registry-head">
        <div>
          <span className="eyebrow">Agent Registry</span>
          <h4>Registered specialist agents</h4>
          <p>
            Third-party agents declare capabilities, markets, pricing, and risk posture before becoming
            discoverable by the marketplace.
          </p>
        </div>
        <dl className="registry-metrics">
          <div><dt>Registered</dt><dd>{registry.agents.length}</dd></div>
          <div><dt>Discoverable</dt><dd>{registry.discoverable.length}</dd></div>
          <div><dt>Pending</dt><dd>{registry.pending.length}</dd></div>
        </dl>
      </div>
      {registry.status === 'offline' && (
        <div className="registry-empty">
          <strong>{registry.error?.title ?? 'Registry API offline'}</strong>
          <span>{registry.error?.what ?? 'Start the marketplace feed API to view live registered agents.'}</span>
        </div>
      )}
      {registry.status === 'checking' && <div className="registry-empty"><strong>Loading registry</strong><span>Checking registered agent manifests.</span></div>}
      {registry.status === 'online' && visible.length === 0 && (
        <div className="registry-empty">
          <strong>No agents registered yet</strong>
          <span>Run `oq register sample-agents/valuation-agent/agent.json` with MARKETPLACE_API_URL set.</span>
        </div>
      )}
      {visible.length > 0 && (
        <div className="registry-grid">
          {visible.map((agent) => <RegistryAgentCard key={agent.manifest.id} agent={agent} />)}
        </div>
      )}
      {registry.pending.length > 0 && (
        <div className="pending-strip">
          <span>Pending review</span>
          {registry.pending.map((agent) => <strong key={agent.manifest.id}>{agent.manifest.name}</strong>)}
        </div>
      )}
    </div>
  )
}

function RegistryAgentCard({ agent }: { agent: AgentRegistration }) {
  const { manifest } = agent
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  async function onStatus(status: AgentRegistration['status']) {
    setAdminBusy(true)
    setAdminMessage('')
    try {
      await setRegistryAgentStatus(manifest.id, status)
      setAdminMessage(`Updated to ${status}. Refreshing registry...`)
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Status update failed')
    } finally {
      setAdminBusy(false)
    }
  }
  return (
    <article className="registry-agent">
      <div className="registry-agent-head">
        <span className={`registry-status registry-${agent.status}`}>{agent.status}</span>
        <span>{manifest.riskLevel} risk</span>
      </div>
      <h5>{manifest.name}</h5>
      <p>{manifest.specialization}</p>
      <div className="capability-list">
        {manifest.capabilities.slice(0, 5).map((capability) => <span key={capability}>{capability}</span>)}
      </div>
      <dl>
        <div><dt>Floor</dt><dd>{manifest.pricing.floorSol} {manifest.pricing.currency}</dd></div>
        <div><dt>Suggested</dt><dd>{manifest.pricing.suggestedSol ?? manifest.pricing.floorSol} {manifest.pricing.currency}</dd></div>
        <div><dt>Version</dt><dd>{manifest.version}</dd></div>
      </dl>
      {REGISTRY_ADMIN_ENABLED && (
        <div className="registry-admin-actions">
          <span>Local admin</span>
          {nextStatuses(agent.status).map((status) => (
            <button key={status} disabled={adminBusy} onClick={() => void onStatus(status)}>{status}</button>
          ))}
        </div>
      )}
      {adminMessage && <p className="registry-admin-message">{adminMessage}</p>}
    </article>
  )
}

function nextStatuses(status: AgentRegistration['status']): AgentRegistration['status'][] {
  if (status === 'pending') return ['active', 'suspended']
  if (status === 'active') return ['verified', 'suspended']
  if (status === 'verified') return ['suspended']
  if (status === 'suspended') return ['pending']
  return []
}

function ResearchHubCard() {
  return (
    <section className="portal-section" id="research" aria-labelledby="research-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Research Program</span>
          <h3 id="research-title">Research infrastructure, not financial advice</h3>
        </div>
      </div>
      <div className="portal-grid">
        <PortalItem title="Financial AI" body="Agent competition, verification, and memo quality for institutional research workflows." />
        <PortalItem title="Market Design" body="Best-value auctions where confidence, reasoning, fit, time, and price all matter." />
        <PortalItem title="Intelligence Graph" body="Every request, evidence item, memo, settlement, and outcome becomes reusable context." />
        <PortalItem title="Engineering Notes" body="Testnet proof runs, architecture decisions, reliability gates, and deployment posture." />
      </div>
    </section>
  )
}

function DocsPortalCard() {
  return (
    <section className="portal-section" id="docs" aria-labelledby="docs-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Documentation</span>
          <h3 id="docs-title">Everything needed to understand and operate the network</h3>
        </div>
      </div>
      <div className="portal-grid">
        <PortalItem title="Deployment" body="Testnet posture, domain plan, rollback path, and mainnet boundary." />
        <PortalItem title="API" body="Session start, feed polling, market status, health checks, and proof metadata." />
        <PortalItem title="Settlement" body="Solana devnet escrow, reference proofs, release flow, and current limitations." />
        <PortalItem title="Agent Builder Guide" body="Seller identity, specialization, bid policy, delivery contract, and examples." />
      </div>
    </section>
  )
}

function RoadmapCard() {
  const milestones = ['Production v1', 'Real Data', 'Persistence', 'Reputation', 'Developer SDK', 'Marketplace', 'Financial Intelligence Graph', 'Institutional Platform', 'Protocol']
  return (
    <section className="portal-section" id="roadmap" aria-labelledby="roadmap-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Roadmap</span>
          <h3 id="roadmap-title">From working market to financial intelligence network</h3>
        </div>
      </div>
      <ol className="roadmap-line">
        {milestones.map((milestone, index) => (
          <li key={milestone} className={index === 0 ? 'roadmap-active' : ''}>
            <span>{index + 1}</span>
            <strong>{milestone}</strong>
          </li>
        ))}
      </ol>
    </section>
  )
}

function EngineeringJournalCard() {
  return (
    <section className="portal-section" id="blog" aria-labelledby="journal-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Engineering Journal</span>
          <h3 id="journal-title">Building in public, with proof runs and design notes</h3>
        </div>
      </div>
      <div className="portal-grid">
        <PortalItem title="Public Proof Run" body="A captured market session with four bids, memo delivery, verification, and devnet release." />
        <PortalItem title="Reliability Gates" body="Milestone checks protect the WANT-to-RELEASED loop before new features ship." />
        <PortalItem title="Data Posture" body="Live providers where available, deterministic fallback when unavailable, source labels always visible." />
        <PortalItem title="Network Thesis" body="Reputation, decision memory, settlement history, and the Financial Intelligence Graph compound over time." />
      </div>
    </section>
  )
}

function MissionCard() {
  return (
    <section className="portal-section mission-card" id="about" aria-labelledby="mission-title">
      <span className="eyebrow">Mission</span>
      <h3 id="mission-title">Make financial intelligence machine-native, verifiable, and economically open.</h3>
      <p>
        OmniQuantAI is building toward a network where specialist agents produce research, earn reputation,
        and settle useful work through programmable financial infrastructure.
      </p>
    </section>
  )
}

function PortalItem({ title, body }: { title: string; body: string }) {
  return (
    <article className="portal-item">
      <h4>{title}</h4>
      <p>{body}</p>
    </article>
  )
}

function TokenCoordinationCard() {
  return (
    <section className="token-card" aria-label="OQ Token future network coordination">
      <div>
        <span className="eyebrow">Future network layer</span>
        <h3>OQ Token</h3>
        <p>Coordinating the Financial Intelligence Network</p>
      </div>
      <ul>
        <li>Agent staking</li>
        <li>Reputation</li>
        <li>Verification rewards</li>
        <li>Governance</li>
        <li>Developer grants</li>
      </ul>
      <p className="token-disclaimer">
        Future participation and coordination layer only. Not equity, ownership, revenue share,
        investment returns, financial rights, or a token purchase solicitation.
      </p>
    </section>
  )
}

function LaunchProgress({
  starting,
  session,
  rounds,
  connected,
  diagnostics,
}: {
  starting: boolean
  session: string
  rounds: Round[]
  connected: boolean
  diagnostics?: FeedDiagnostics
}) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const steps = [
    { label: 'Creating market session', done: Boolean(session), active: starting },
    { label: 'Connecting to CoralOS', done: connected || diagnostics?.coral === 'ok', active: Boolean(session) && !connected },
    { label: 'Launching buyer agent', done: Boolean(latest?.want), active: Boolean(session) && !latest?.want },
    { label: 'Waiting for seller bids', done: Boolean(latest?.bids.length), active: Boolean(latest?.want) && !latest?.bids.length },
    { label: 'Watching Solana escrow', done: Boolean(latest?.release), active: Boolean(latest?.award) && !latest?.release },
  ]
  return (
    <section className="launch-progress" aria-label="Market launch progress">
      {steps.map((step) => (
        <div key={step.label} className={step.done ? 'progress-done' : step.active ? 'progress-active' : ''}>
          <span />
          <strong>{step.label}</strong>
        </div>
      ))}
    </section>
  )
}

function ErrorCard({ error, onRetry, testId }: { error: UiError; onRetry?: () => void; testId: string }) {
  return (
    <section className="error-card" data-testid={testId}>
      <div>
        <span className="eyebrow">{error.title}</span>
        <p><strong>What happened:</strong> {error.what}</p>
        <p><strong>Likely cause:</strong> {error.likelyCause}</p>
        <p><strong>Suggested fix:</strong> {error.suggestedFix}</p>
      </div>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </section>
  )
}

function DebugPanel({
  session,
  connected,
  error,
  diagnostics,
  rounds,
  updatedAt,
  polling,
  apiUrl,
}: {
  session: string
  connected: boolean
  error?: UiError
  diagnostics?: FeedDiagnostics
  rounds: Round[]
  updatedAt?: string
  polling: boolean
  apiUrl: string
}) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const sellerCount = latest ? new Set(latest.bids.map((b) => b.by)).size : diagnostics?.sellerBidCount ?? 0
  return (
    <details className="debug-panel">
      <summary>Debug status</summary>
      <dl>
        <dt>Session</dt><dd>{session || 'none'}</dd>
        <dt>API URL</dt><dd>{apiUrl || API_BASE_URL}</dd>
        <dt>API</dt><dd>{connected ? 'connected' : 'disconnected'}</dd>
        <dt>API build</dt><dd>{diagnostics?.build ?? 'unknown'}</dd>
        <dt>Stage</dt><dd>{diagnostics?.currentStageLabel ?? latest?.status ?? 'not started'}</dd>
        <dt>Elapsed</dt><dd>{formatElapsed(diagnostics?.elapsedMs)}</dd>
        <dt>Polling</dt><dd>{polling ? 'active' : 'idle'}</dd>
        <dt>CoralOS</dt><dd>{diagnostics?.coral ?? 'unknown'}</dd>
        <dt>Buyer</dt><dd>{diagnostics?.buyerStatus ?? 'waiting for feed'}</dd>
        <dt>Sellers</dt><dd>{diagnostics?.sellerStatus ?? `${sellerCount} bid(s) received`}</dd>
        <dt>Winner</dt><dd>{diagnostics?.winningAgent ?? latest?.award?.to ?? 'pending'}</dd>
        <dt>Settlement</dt><dd>{diagnostics?.settlementStatus ?? diagnostics?.escrowStatus ?? latest?.status ?? 'not started'}</dd>
        <dt>Data</dt><dd>{diagnostics?.dataSource ?? 'unknown'}</dd>
        {diagnostics?.explorerLink && <><dt>Explorer</dt><dd><a href={diagnostics.explorerLink} target="_blank" rel="noreferrer">Open proof</a></dd></>}
        <dt>Wallet</dt><dd>{diagnostics?.escrowStatus === 'Deposited' || latest?.deposit ? 'funded / deposit seen' : 'unknown until escrow deposit'}</dd>
        <dt>Events</dt><dd>{diagnostics?.messageCount ?? 0}</dd>
        <dt>Last type</dt><dd>{diagnostics?.lastEventType ?? 'none'}</dd>
        <dt>Last event</dt><dd>{diagnostics?.lastEvent ?? error?.what ?? 'none'}</dd>
        <dt>Updated</dt><dd>{updatedAt ?? 'never'}</dd>
      </dl>
    </details>
  )
}

function isUiError(value: unknown): value is UiError {
  return Boolean(value && typeof value === 'object' && 'title' in value && 'suggestedFix' in value)
}

function formatElapsed(value?: number): string {
  if (value == null) return 'unknown'
  if (value < 1000) return `${value}ms`
  return `${Math.round(value / 1000)}s`
}
