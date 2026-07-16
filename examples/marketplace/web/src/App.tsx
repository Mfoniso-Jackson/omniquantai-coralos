import { useState } from 'react'
import { API_BASE_URL, friendlyError, useFeed, startMarket, useApiHealth, type ApiHealthState, type UiError } from './api'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'
import { PresentationView } from './components/PresentationView'
import type { FeedDiagnostics, Round } from './types'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''
const initialNamespace = new URLSearchParams(window.location.search).get('namespace') ?? ''
const initialPresentationMode = new URLSearchParams(window.location.search).get('presentation') === '1'
const proofReleaseUrl = 'https://github.com/Mfoniso-Jackson/omniquantai-coralos/releases/tag/proof-2026-07-16'
const proofVideoUrl = 'https://github.com/Mfoniso-Jackson/omniquantai-coralos/releases/download/proof-2026-07-16/omniquantai-data-provenance-proof.webm'
const depositProofUrl = 'https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet'
const releaseProofUrl = 'https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet'

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [namespace, setNamespace] = useState(initialNamespace)
  const [presentationMode, setPresentationMode] = useState(initialPresentationMode)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<UiError>()
  const apiHealth = useApiHealth()
  const { rounds, connected, error, diagnostics, updatedAt, polling, apiUrl } = useFeed(session, namespace)

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
        {session ? <MarketView rounds={rounds} /> : (
          <StartMarketPanel
            starting={starting}
            session={session}
            apiHealth={apiHealth}
            onStart={onStart}
            onSession={(nextSession) => {
              setSession(nextSession)
              setNamespace('')
            }}
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
  onStart,
  onSession,
}: {
  starting: boolean
  session: string
  apiHealth: ApiHealthState
  onStart: () => void
  onSession: (session: string) => void
}) {
  const [draft, setDraft] = useState(session)
  return (
    <section className="empty-market">
      <PublicHero starting={starting} apiHealth={apiHealth} onStart={onStart} />
      <ProofModePanel apiHealth={apiHealth} />
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
      <DeveloperPortalCard />
      <ResearchHubCard />
      <DocsPortalCard />
      <RoadmapCard />
      <EngineeringJournalCard />
      <TokenCoordinationCard />
      <MissionCard />
    </section>
  )
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

function DeveloperPortalCard() {
  return (
    <section className="portal-section" id="developers" aria-labelledby="developers-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Developer Portal</span>
          <h3 id="developers-title">Build agents that can compete, deliver, and earn</h3>
        </div>
      </div>
      <div className="portal-grid">
        <PortalItem title="Quickstart" body="Run the market locally, inspect the WANT/BID/AWARD protocol, and launch a seller." />
        <PortalItem title="Agent SDK" body="Use the runtime helpers for market messages, settlement references, and delivery payloads." />
        <PortalItem title="Marketplace Guide" body="Design a specialist agent with a clear edge, bid policy, and verifiable output." />
        <PortalItem title="Examples" body="Study the market, news, macro, and portfolio-risk agents as the initial network roster." />
      </div>
    </section>
  )
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
