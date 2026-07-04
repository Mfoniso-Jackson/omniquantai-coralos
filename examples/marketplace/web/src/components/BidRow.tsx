import type { RoundBid } from '../types'

function metric(note: string | undefined, key: string, fallback: string): string {
  return note?.match(new RegExp(`${key}=([^;\\s]+)`))?.[1] ?? fallback
}

function agentStats(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('portfolio')) return { jobs: 18, revenue: '2.5 SOL', success: '94%' }
  if (lower.includes('news')) return { jobs: 14, revenue: '1.7 SOL', success: '88%' }
  if (lower.includes('macro')) return { jobs: 12, revenue: '1.4 SOL', success: '86%' }
  return { jobs: 16, revenue: '2.1 SOL', success: '91%' }
}

function valueProp(note: string | undefined): string {
  return decodeURIComponent(metric(note, 'value', 'specialist research')).replace(/[+_]/g, ' ')
}

export function BidRow({ bid, won }: { bid: RoundBid; won: boolean }) {
  const stats = agentStats(bid.by)
  const confidence = metric(bid.note, 'confidence', metric(bid.note, 'conf', '78'))
  const delivery = metric(bid.note, 'delivery', `${metric(bid.note, 'speed', '30')}s`)
  const reasoning = metric(bid.note, 'reasoning', metric(bid.note, 'explain', '80'))
  return (
    <div className={`bid ${won ? 'bid-won' : ''}`} data-testid="bid" data-seller={bid.by}>
      <div className="bid-main">
        <span className="bid-seller">{bid.by}</span>
        <span className="bid-note">{valueProp(bid.note)}</span>
      </div>
      <span className="bid-price">{bid.priceSol} SOL</span>
      <div className="bid-metrics">
        <span>conf {confidence}%</span>
        <span>{delivery}</span>
        <span>reason {reasoning}</span>
        <span>{stats.jobs} jobs</span>
        <span>{stats.revenue}</span>
        <span>{stats.success} success</span>
      </div>
      {won && <span className="bid-tag">won</span>}
    </div>
  )
}

export function DeclinedRow({ seller }: { seller: string }) {
  return (
    <div className="bid bid-declined" data-testid="declined" data-seller={seller}>
      <span className="bid-seller">{seller}</span>
      <span className="bid-note">declined — not in inventory</span>
    </div>
  )
}
