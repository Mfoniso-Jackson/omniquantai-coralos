import { useState } from 'react'
import { API_BASE_URL, friendlyError, useFeed, startMarket, type UiError } from './api'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'
import { PresentationView } from './components/PresentationView'
import type { FeedDiagnostics, Round } from './types'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''
const initialNamespace = new URLSearchParams(window.location.search).get('namespace') ?? ''
const initialPresentationMode = new URLSearchParams(window.location.search).get('presentation') === '1'

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [namespace, setNamespace] = useState(initialNamespace)
  const [presentationMode, setPresentationMode] = useState(initialPresentationMode)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<UiError>()
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
          <a href="#dashboard">Dashboard</a>
          <a href="#marketplace">Marketplace</a>
          <a href="#research">Research</a>
          <a href="#settlement">Settlement</a>
          <a href="#architecture">Architecture</a>
        </nav>
        <div className="trust-strip" aria-label="Network status">
          <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} data-testid="conn" title={connected ? 'connected' : (error?.title ?? 'disconnected')} />
          <span>CoralOS</span>
          <span>Solana Devnet</span>
          <span title={session || 'No active session'}>Session {session ? shortId(session) : 'pending'}</span>
          {namespace && <span title={namespace}>Namespace {namespace}</span>}
        </div>
      </header>

      <section className="network-thesis" id="dashboard">
        <p>
          An open economy where autonomous specialist agents compete to produce, verify, and monetize
          investment intelligence through programmable settlement.
        </p>
      </section>

      {(starting || session) && <LaunchProgress starting={starting} session={session} rounds={rounds} connected={connected} diagnostics={diagnostics} />}
      {startErr && <ErrorCard error={startErr} onRetry={onStart} testId="start-err" />}
      {error && <ErrorCard error={error} onRetry={session ? undefined : onStart} testId="feed-err" />}
      <DebugPanel session={session} connected={connected} error={error ?? startErr} diagnostics={diagnostics} rounds={rounds} updatedAt={updatedAt} polling={polling} apiUrl={apiUrl} />

      <main>
        {session ? <MarketView rounds={rounds} /> : (
          <StartMarketPanel
            starting={starting}
            session={session}
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
  onStart,
  onSession,
}: {
  starting: boolean
  session: string
  onStart: () => void
  onSession: (session: string) => void
}) {
  const [draft, setDraft] = useState(session)
  return (
    <section className="empty-market">
      <div className="empty-brand" aria-hidden="true">
        <img src="/brand/omniquantai-logo-hero.png" alt="" />
      </div>
      <div>
        <span className="eyebrow">Judge-ready demo</span>
        <h2>Start a Financial Intelligence Market</h2>
        <p>
          Launch a live market where specialist AI agents compete to produce an investment committee memo
          and settle payment on Solana devnet. The moment to watch: one agent decides which seller created
          the most valuable intelligence, then releases payment on-chain.
        </p>
        <div className="empty-actions">
          <button className="primary-action" onClick={onStart} disabled={starting} data-testid="start">
            {starting ? 'Starting Market...' : 'Start Market'}
          </button>
        </div>
      </div>
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
      <Explainer />
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
        <dt>Polling</dt><dd>{polling ? 'active' : 'idle'}</dd>
        <dt>CoralOS</dt><dd>{diagnostics?.coral ?? 'unknown'}</dd>
        <dt>Buyer</dt><dd>{diagnostics?.buyerStatus ?? 'waiting for feed'}</dd>
        <dt>Sellers</dt><dd>{sellerCount} bid(s) received</dd>
        <dt>Escrow</dt><dd>{diagnostics?.escrowStatus ?? latest?.status ?? 'not started'}</dd>
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
