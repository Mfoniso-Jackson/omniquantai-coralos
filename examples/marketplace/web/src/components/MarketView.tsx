import type { Round } from '../types'
import { RoundCard } from './RoundCard'

/** The live market feed — newest round first. */
export function MarketView({ rounds }: { rounds: Round[] }) {
  if (rounds.length === 0) {
    return (
      <section className="waiting-stage" data-testid="empty">
        <div>
          <span className="eyebrow">Market session open</span>
          <h2>Waiting for the buyer to broadcast a WANT</h2>
          <p>The next event should be the research request entering the CoralOS session thread.</p>
        </div>
        <div className="signal-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    )
  }
  const newestFirst = [...rounds].sort((a, b) => b.round - a.round)
  const latest = newestFirst[0]
  return (
    <div className="market" data-testid="market">
      <RoundCard round={latest} featured />
      {newestFirst.length > 1 && (
        <section className="round-history" aria-label="Previous market rounds">
          <h2>Previous Sessions</h2>
          {newestFirst.slice(1).map((r) => (
            <RoundCard key={r.round} round={r} />
          ))}
        </section>
      )}
    </div>
  )
}
