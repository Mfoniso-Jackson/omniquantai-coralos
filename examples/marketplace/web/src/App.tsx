import { useState } from 'react'
import { useFeed, startMarket } from './api'
import { MarketView } from './components/MarketView'
import { Explainer } from './components/Explainer'
import { PresentationView } from './components/PresentationView'
import type { FeedDiagnostics, Round } from './types'

/** Read ?session=<id> from the URL so the launcher can deep-link straight to a live market. */
const initialSession = new URLSearchParams(window.location.search).get('session') ?? ''
const presentationMode = new URLSearchParams(window.location.search).get('presentation') === '1'

export default function App() {
  const [session, setSession] = useState(initialSession)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<string>()
  const { rounds, connected, error, diagnostics, updatedAt } = useFeed(session)

  async function onStart() {
    setStarting(true)
    setStartErr(undefined)
    try {
      const id = await startMarket()
      setSession(id)
      const url = new URL(window.location.href)
      url.searchParams.set('session', id)
      window.history.replaceState({}, '', url)
    } catch (e) {
      setStartErr((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  if (presentationMode) {
    return <PresentationView rounds={rounds} connected={connected} />
  }

  return (
    <div className="app">
      <header className="app-head">
        <h1>OmniQuantAI Agent Market</h1>
        <span className="sub">Financial intelligence agents compete on CoralOS · settled by Solana escrow</span>
        <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} data-testid="conn" title={connected ? 'connected' : (error ?? 'disconnected')} />
      </header>

      <div className="session-bar">
        <input
          aria-label="session id"
          placeholder="paste a market session id…"
          value={session}
          onChange={(e) => setSession(e.target.value.trim())}
        />
        <button onClick={onStart} disabled={starting} data-testid="start">
          {starting ? 'starting…' : 'Start a market'}
        </button>
      </div>
      {startErr && <p className="start-err" data-testid="start-err">{startErr}</p>}
      {error && <p className="start-err" data-testid="feed-err">{error}</p>}
      <DebugPanel session={session} connected={connected} error={error} diagnostics={diagnostics} rounds={rounds} updatedAt={updatedAt} />

      <Explainer />

      <main>
        {session ? <MarketView rounds={rounds} /> : (
          <p className="empty">Fund your wallets, then <strong>Start a market</strong> — research agents will bid and settle live.</p>
        )}
      </main>
    </div>
  )
}

function DebugPanel({
  session,
  connected,
  error,
  diagnostics,
  rounds,
  updatedAt,
}: {
  session: string
  connected: boolean
  error?: string
  diagnostics?: FeedDiagnostics
  rounds: Round[]
  updatedAt?: string
}) {
  const latest = [...rounds].sort((a, b) => b.round - a.round)[0]
  const sellerCount = latest ? new Set(latest.bids.map((b) => b.by)).size : diagnostics?.sellerBidCount ?? 0
  return (
    <details className="debug-panel">
      <summary>Debug status</summary>
      <dl>
        <dt>Session</dt><dd>{session || 'none'}</dd>
        <dt>API</dt><dd>{connected ? 'connected' : 'disconnected'}</dd>
        <dt>CoralOS</dt><dd>{diagnostics?.coral ?? 'unknown'}</dd>
        <dt>Buyer</dt><dd>{diagnostics?.buyerStatus ?? 'waiting for feed'}</dd>
        <dt>Sellers</dt><dd>{sellerCount} bid(s) received</dd>
        <dt>Escrow</dt><dd>{diagnostics?.escrowStatus ?? latest?.status ?? 'not started'}</dd>
        <dt>Events</dt><dd>{diagnostics?.messageCount ?? 0}</dd>
        <dt>Last event</dt><dd>{diagnostics?.lastEvent ?? error ?? 'none'}</dd>
        <dt>Updated</dt><dd>{updatedAt ?? 'never'}</dd>
      </dl>
    </details>
  )
}
