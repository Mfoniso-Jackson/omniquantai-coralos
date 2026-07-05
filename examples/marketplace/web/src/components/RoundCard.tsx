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

function bidText(note: string | undefined, key: string, fallback: string): string {
  return decodeURIComponent(note?.match(new RegExp(`${key}=([^;\\s]+)`))?.[1] ?? fallback).replace(/[+_]/g, ' ')
}

function scoreBid(bid: Round['bids'][number]): number {
  const confidence = bidMetric(bid.note, 'confidence', bidMetric(bid.note, 'conf', 78))
  const fit = bidMetric(bid.note, 'fit', 80)
  const quality = bidMetric(bid.note, 'qual', 80)
  const reasoning = bidMetric(bid.note, 'reasoning', bidMetric(bid.note, 'explain', 78))
  const speed = Math.max(0, 100 - bidMetric(bid.note, 'speed', 30))
  const price = Math.max(0, 100 - bid.priceSol * 120)
  return Math.round((confidence * 0.22) + (fit * 0.2) + (quality * 0.2) + (reasoning * 0.18) + (speed * 0.1) + (price * 0.1))
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
export function RoundCard({ round, featured = false }: { round: Round; featured?: boolean }) {
  const winner = round.award?.to
  const losingBids = round.bids.filter((bid) => bid.by !== winner)
  const sortedBids = [...round.bids].sort((a, b) => scoreBid(b) - scoreBid(a))
  const report = round.delivered?.data as { service?: string } | undefined
  const isOmniQuant = report?.service === 'omniquant-financial-intelligence'
  return (
    <article className={`round ${featured ? 'round-featured' : ''}`} data-testid="round" data-round={round.round}>
      <header className="round-head">
        <div>
          <span className="round-n">Market Round #{round.round}</span>
          <h2>One AI agent is buying financial intelligence from another AI agent.</h2>
        </div>
        <div className="round-status-stack">
          <StatusPill status={round.status} />
          <span>{winner ? `Winner: ${winner}` : 'Auction in progress'}</span>
        </div>
      </header>

      <section className="request-card" id="research">
        <div>
          <span className="eyebrow">Research Request</span>
          <h3>Increase Nvidia exposure over the next 3-6 months?</h3>
          <p>Buyer agent requests an institutional investment memo with evidence, scenarios, risk factors, and a recommendation.</p>
        </div>
        <dl className="request-grid">
          <div><dt>Portfolio</dt><dd>Growth fund</dd></div>
          <div><dt>Objective</dt><dd>NVDA exposure review</dd></div>
          <div><dt>Risk Profile</dt><dd>Institutional controls</dd></div>
          <div><dt>Time Horizon</dt><dd>3-6 months</dd></div>
          <div><dt>Budget</dt><dd>{round.want?.budgetSol ?? 'pending'} SOL</dd></div>
          <div><dt>Market Status</dt><dd>{round.want ? 'WANT broadcast' : 'Waiting'}</dd></div>
        </dl>
      </section>

      <section className="marketplace-stage" id="marketplace">
        <div className="section-heading">
          <span className="eyebrow">Live Agent Marketplace</span>
          <h3>Specialists compete for the work</h3>
        </div>
        <div className="bids">
          {round.bids.map((b) => (
            <BidRow key={b.by} bid={b} won={b.by === winner} />
          ))}
          {round.declined.map((s) => (
            <DeclinedRow key={s} seller={s} />
          ))}
        </div>
      </section>

      <section className="decision-engine">
        <div className="section-heading">
          <span className="eyebrow">Buyer Decision Engine</span>
          <h3>Best value wins, not lowest price</h3>
        </div>
        <div className="score-table" role="table" aria-label="Buyer bid scoring">
          <div className="score-row score-head" role="row">
            <span>Agent</span><span>Price</span><span>Confidence</span><span>Evidence</span><span>Speed</span><span>Risk</span><span>Score</span>
          </div>
          {sortedBids.map((bid) => {
            const won = bid.by === winner
            const confidence = bidMetric(bid.note, 'confidence', bidMetric(bid.note, 'conf', 78))
            const quality = bidMetric(bid.note, 'qual', 80)
            const speed = bidText(bid.note, 'delivery', `${bidMetric(bid.note, 'speed', 30)}s`)
            const risk = Math.max(10, 100 - bidMetric(bid.note, 'fit', 80))
            return (
              <div className={`score-row ${won ? 'score-winner' : ''}`} role="row" key={bid.by}>
                <span>{bid.by}</span>
                <span>{bid.priceSol} SOL</span>
                <span>{confidence}%</span>
                <span>{quality}%</span>
                <span>{speed}</span>
                <span>{risk}</span>
                <strong>{scoreBid(bid)}</strong>
              </div>
            )
          })}
        </div>
      </section>

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
        <section id="memo">
          <h2 className="section-label">Intelligence Delivered</h2>
          {isOmniQuant
            ? <IntelligencePanel report={round.delivered.data as Parameters<typeof IntelligencePanel>[0]['report']} />
            : report?.service === 'txline-edge'
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

      <footer className="settlement-stage" id="settlement">
        <div className="section-heading">
          <span className="eyebrow">Settlement Timeline</span>
          <h3>CoralOS coordinates. Solana settles.</h3>
        </div>
        <ol className="settlement-timeline">
          <TimelineStep label="WANT" status={stageStatus(Boolean(round.want), !round.want)} detail="Research Requested" />
          <TimelineStep label="BID" status={stageStatus(round.bids.length > 0, Boolean(round.want) && round.bids.length === 0)} detail="Auction Open" />
          <TimelineStep label="AWARD" status={stageStatus(Boolean(round.award), round.bids.length > 0 && !round.award)} detail="Winner Selected" />
          <TimelineStep label="DEPOSITED" status={stageStatus(Boolean(round.deposit), Boolean(round.award) && !round.deposit, round.status === 'refunded')} detail="Escrow Created" />
          <TimelineStep label="DELIVERED" status={stageStatus(Boolean(round.delivered), Boolean(round.deposit) && !round.delivered)} detail="Research Delivered" />
          <TimelineStep label="VERIFIED" status={stageStatus(Boolean(round.verified), Boolean(round.delivered) && !round.verified, round.verified?.status === 'FAIL')} detail="Verification" />
          <TimelineStep label="RELEASED" status={stageStatus(Boolean(round.release), Boolean(round.verified) && !round.release, round.status === 'refunded')} detail="Payment Released" />
        </ol>
        <dl className="settlement-facts">
          <div><dt>Escrow Status</dt><dd>{round.release ? 'Released' : round.deposit ? 'Deposited' : round.award ? 'Awaiting deposit' : 'Pending award'}</dd></div>
          <div><dt>Reference</dt><dd>{round.escrow?.reference ?? 'pending'}</dd></div>
          <div><dt>Amount</dt><dd>{round.escrow?.amountSol ?? 'pending'} SOL</dd></div>
          <div><dt>Timestamp</dt><dd>{new Date().toLocaleString()}</dd></div>
        </dl>
        <div className="settle-row">
          {round.deposit && <SettlementBadge label={`Escrow Deposited ${round.escrow?.amountSol ?? ''} SOL`} sig={round.deposit.sig} />}
          {round.release && <SettlementBadge label="Payment Released" sig={round.release.sig} />}
          {round.refunded && <span className="settle settle-refund" data-testid="refund">refunded</span>}
        </div>
      </footer>
    </article>
  )
}

type StageState = 'pending' | 'active' | 'complete' | 'error'

function stageStatus(done: boolean, active: boolean, error = false): StageState {
  if (error) return 'error'
  if (done) return 'complete'
  if (active) return 'active'
  return 'pending'
}

function TimelineStep({ label, detail, status }: { label: string; detail: string; status: StageState }) {
  return <li className={`timeline-${status}`}><span /> <strong>{label}</strong><em>{detail}</em></li>
}
