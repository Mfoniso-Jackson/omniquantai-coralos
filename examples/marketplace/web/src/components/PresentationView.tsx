import type { UiError } from '../api'
import type { FeedDiagnostics, Round, RoundStatus } from '../types'
import { explorerTx } from '../types'
import { IntelligencePanel } from './IntelligencePanel'
import { StatusPill } from './StatusPill'

const SELLERS = [
  ['Market Analyst', 'price action, momentum, valuation'],
  ['News & Earnings', 'news, earnings, analyst sentiment'],
  ['Macro Risk', 'rates, inflation, liquidity'],
  ['Portfolio Risk', 'concentration, drawdowns, controls'],
] as const

const STEP_LABEL: Record<RoundStatus, string> = {
  bidding: 'Agents are bidding',
  awarded: 'Buyer selected best value',
  deposited: 'Escrow deposited',
  delivered: 'Research delivered',
  verified: 'Verification passed',
  settled: 'Seller paid on-chain',
  refunded: 'Escrow refunded',
}

function latestRound(rounds: Round[]): Round | undefined {
  return [...rounds].sort((a, b) => b.round - a.round)[0]
}

export function PresentationView({
  rounds,
  connected,
  session,
  namespace,
  diagnostics,
  error,
  updatedAt,
  onExitPresentation,
}: {
  rounds: Round[]
  connected: boolean
  session: string
  namespace?: string
  diagnostics?: FeedDiagnostics
  error?: UiError
  updatedAt?: string
  onExitPresentation?: () => void
}) {
  const round = latestRound(rounds)
  const report = round?.delivered?.data as { service?: string } | undefined
  const isOmniQuant = report?.service === 'omniquant-financial-intelligence'

  return (
    <main className="present" data-testid="presentation">
      <section className="present-hero">
        <div>
          <p className="present-kicker">Solana x CoralOS hackathon demo</p>
          <img className="present-logo" src="/brand/omniquantai-logo-hero.png" alt="OmniQuantAI" />
          <p className="present-sub">
            A Financial Intelligence Network where specialist AI agents compete, deliver investment research,
            and get paid through Solana escrow.
          </p>
        </div>
        <div className={`present-live ${connected ? 'present-live-on' : ''}`}>
          {connected ? 'Live feed connected' : 'Waiting for feed'}
        </div>
      </section>

      {!round && (
        <section className="present-panel present-diagnostics">
          <div>
            <h2>Session Diagnostics</h2>
            <p className="present-muted">
              Session <strong>{shortId(session)}</strong> was created. The dashboard is polling the feed,
              but no market round has been parsed yet.
            </p>
          </div>
          {error ? (
            <div className="present-error">
              <strong>{error.title}</strong>
              <span>{error.what}</span>
              <span>{error.likelyCause}</span>
              <em>{error.suggestedFix}</em>
            </div>
          ) : (
            <dl className="present-debug-grid">
              <div><dt>CoralOS</dt><dd>{diagnostics?.coral ?? 'checking'}</dd></div>
              <div><dt>Namespace</dt><dd>{namespace || 'default'}</dd></div>
              <div><dt>Events</dt><dd>{diagnostics?.messageCount ?? 0}</dd></div>
              <div><dt>Buyer</dt><dd>{diagnostics?.buyerStatus ?? 'Waiting for buyer container to publish WANT'}</dd></div>
              <div><dt>Last Event</dt><dd>{diagnostics?.lastEventType ?? 'NONE'}</dd></div>
              <div><dt>Escrow</dt><dd>{diagnostics?.escrowStatus ?? 'Not started'}</dd></div>
              <div><dt>Updated</dt><dd>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'pending'}</dd></div>
            </dl>
          )}
          {onExitPresentation && (
            <button className="present-debug-button" onClick={onExitPresentation}>
              Open Dashboard Diagnostics
            </button>
          )}
        </section>
      )}

      <section className="present-question">
        <span>Research request</span>
        <strong>Should our fund increase exposure to Nvidia over the next 3-6 months?</strong>
        <em>Watch for the proof: WANT {'->'} BID {'->'} AWARD {'->'} DEPOSITED {'->'} DELIVERED {'->'} RELEASED.</em>
      </section>

      <section className="present-grid">
        <div className="present-panel">
          <h2>Current Step</h2>
          {round ? (
            <>
              <div className="present-status">
                <StatusPill status={round.status} />
                <strong>{STEP_LABEL[round.status]}</strong>
              </div>
              <ol className="present-steps">
                {['WANT', 'BID', 'AWARD', 'DEPOSITED', 'DELIVERED', 'VERIFIED', 'RELEASED'].map((step) => (
                  <li key={step} className={stepClass(step, round)}>{step}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="present-muted">Waiting for the buyer to broadcast a WANT.</p>
          )}
        </div>

        <div className="present-panel">
          <h2>Seller Agents</h2>
          <div className="present-sellers">
            {SELLERS.map(([name, role]) => {
              const bid = round?.bids.find((b) => b.by.toLowerCase().includes(name.toLowerCase().split(' ')[0]))
              const won = round?.award?.to && bid?.by === round.award.to
              return (
                <div key={name} className={`present-seller ${won ? 'present-seller-won' : ''}`}>
                  <strong>{name}</strong>
                  <span>{role}</span>
                  {bid && <em>{bid.priceSol} SOL</em>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="present-panel">
        <h2>Buyer Decision</h2>
        {round?.award ? (
          <div className="present-decision">
            <strong>Winner: {round.award.to}</strong>
            <span>{round.award.reason ?? 'Best value selected within budget.'}</span>
          </div>
        ) : (
          <p className="present-muted">The buyer scores relevance, quality, confidence, domain fit, speed, price, and explanation quality.</p>
        )}
      </section>

      <section className="present-grid">
        <div className="present-panel">
          <h2>On-Chain Proof</h2>
          <div className="present-links">
            {round?.deposit ? <a href={explorerTx(round.deposit.sig)} target="_blank" rel="noreferrer">Escrow deposit on Solana Explorer</a> : <span>Deposit link appears after escrow locks.</span>}
            {round?.release ? <a href={explorerTx(round.release.sig)} target="_blank" rel="noreferrer">Escrow release on Solana Explorer</a> : <span>Release link appears after delivery.</span>}
          </div>
        </div>

        <div className="present-panel">
          <h2>Guardrails</h2>
          <p className="present-muted">Research support only. No trading. Human approval required before allocation changes.</p>
        </div>
      </section>

      {isOmniQuant && (
        <section className="present-report">
          <IntelligencePanel report={report as Parameters<typeof IntelligencePanel>[0]['report']} />
        </section>
      )}
    </main>
  )
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value
}

function stepClass(step: string, round: Round): string {
  const reached = {
    WANT: Boolean(round.want),
    BID: round.bids.length > 0,
    AWARD: Boolean(round.award),
    DEPOSITED: Boolean(round.deposit),
    DELIVERED: Boolean(round.delivered),
    VERIFIED: Boolean(round.verified),
    RELEASED: Boolean(round.release),
  }[step]
  return reached ? 'present-step-on' : ''
}
