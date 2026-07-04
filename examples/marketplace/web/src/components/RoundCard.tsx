import type { Round } from '../types'
import { StatusPill } from './StatusPill'
import { BidRow, DeclinedRow } from './BidRow'
import { SettlementBadge } from './SettlementBadge'
import { IntelligencePanel } from './IntelligencePanel'
import { WorldCupPanel } from './WorldCupPanel'

function bidMetric(note: string | undefined, key: string, fallback: number): number {
  const raw = note?.match(new RegExp(`${key}=([^;\\s]+)`))?.[1]
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rejectionReason(bid: Round['bids'][number]): string {
  const confidence = bidMetric(bid.note, 'conf', bidMetric(bid.note, 'confidence', 76))
  const fit = bidMetric(bid.note, 'fit', 80)
  const quality = bidMetric(bid.note, 'qual', 80)
  if (fit < 86) return 'Rejected because domain fit was weaker for the portfolio-aware request.'
  if (quality < 86) return 'Rejected because expected research quality was below the winning bid.'
  if (confidence < 86) return 'Rejected because confidence was lower than the selected seller.'
  return 'Rejected because the winner offered stronger overall value after price, fit, and reasoning quality.'
}

/** One auction round: the need, the competing bids, the award + reasoning, and on-chain settlement. */
export function RoundCard({ round }: { round: Round }) {
  const winner = round.award?.to
  const losingBids = round.bids.filter((bid) => bid.by !== winner)
  return (
    <article className="round" data-testid="round" data-round={round.round}>
      <header className="round-head">
        <span className="round-n">#{round.round}</span>
        {round.want && (
          <span className="round-want">
            <strong>{round.want.service === 'omniquant' ? 'Research Request' : round.want.service}</strong> {round.want.arg}
            <span className="round-budget">budget {round.want.budgetSol} SOL</span>
          </span>
        )}
        <StatusPill status={round.status} />
      </header>

      <h2 className="section-label">Agent Bids</h2>
      <div className="bids">
        {round.bids.map((b) => (
          <BidRow key={b.by} bid={b} won={b.by === winner} />
        ))}
        {round.declined.map((s) => (
          <DeclinedRow key={s} seller={s} />
        ))}
      </div>

      {round.award?.reason && (
        <section className="decision-block">
          <h2 className="section-label">Winner Selected</h2>
          <p className="reason" data-testid="reason">
            <strong>{round.award.to}</strong> · <em>“{round.award.reason}”</em>
          </p>
          {losingBids.length > 0 && (
            <div className="rejection-grid">
              {losingBids.map((bid) => (
                <p key={bid.by}>
                  <strong>{bid.by}</strong>
                  <span>{rejectionReason(bid)}</span>
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {round.delivered && (
        <section>
          <h2 className="section-label">Intelligence Delivered</h2>
          {(round.delivered.data as { service?: string } | undefined)?.service === 'omniquant-financial-intelligence'
            ? <IntelligencePanel report={round.delivered.data as Parameters<typeof IntelligencePanel>[0]['report']} />
            : (round.delivered.data as { service?: string } | undefined)?.service === 'txline-edge'
            ? <WorldCupPanel edge={round.delivered.data as Parameters<typeof WorldCupPanel>[0]['edge']} />
            : <pre className="delivered" data-testid="delivered">{round.delivered.raw}</pre>}
        </section>
      )}

      {round.verified && (
        <section className="verification-block" data-testid="verification">
          <h2 className="section-label">
            {round.verified.status === 'PASS' ? 'Verification Passed' : 'Verification Failed'}
          </h2>
          <p className="verify-summary">
            <strong>{round.verified.score}/100</strong>
            {round.verified.decision && <span>{round.verified.decision}</span>}
          </p>
          <ul className="verify-checks">
            {round.verified.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="settle-row">
        {round.deposit && <SettlementBadge label={`Escrow Deposited ${round.escrow?.amountSol ?? ''} SOL`} sig={round.deposit.sig} />}
        {round.release && <SettlementBadge label="Payment Released" sig={round.release.sig} />}
        {round.refunded && <span className="settle settle-refund" data-testid="refund">refunded</span>}
      </footer>
    </article>
  )
}
