import type { Round, RoundStatus } from '../types'
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
  deposited: 'Escrow is locked',
  delivered: 'Research delivered',
  settled: 'Seller paid on-chain',
  refunded: 'Escrow refunded',
}

function latestRound(rounds: Round[]): Round | undefined {
  return [...rounds].sort((a, b) => b.round - a.round)[0]
}

export function PresentationView({ rounds, connected }: { rounds: Round[]; connected: boolean }) {
  const round = latestRound(rounds)
  const report = round?.delivered?.data as { service?: string } | undefined
  const isOmniQuant = report?.service === 'omniquant-financial-intelligence'

  return (
    <main className="present" data-testid="presentation">
      <section className="present-hero">
        <div>
          <p className="present-kicker">Solana x CoralOS hackathon demo</p>
          <h1>OmniQuantAI</h1>
          <p className="present-sub">Financial research agents compete, deliver intelligence, and get paid through Solana escrow.</p>
        </div>
        <div className={`present-live ${connected ? 'present-live-on' : ''}`}>
          {connected ? 'Live feed connected' : 'Waiting for feed'}
        </div>
      </section>

      <section className="present-question">
        <span>Research request</span>
        <strong>Should our fund increase exposure to Nvidia over the next 6 months?</strong>
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
                {['WANT', 'BID', 'AWARD', 'ESCROW', 'DELIVERED', 'RELEASED'].map((step) => (
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

function stepClass(step: string, round: Round): string {
  const reached = {
    WANT: Boolean(round.want),
    BID: round.bids.length > 0,
    AWARD: Boolean(round.award),
    ESCROW: Boolean(round.deposit),
    DELIVERED: Boolean(round.delivered),
    RELEASED: Boolean(round.release),
  }[step]
  return reached ? 'present-step-on' : ''
}
