import type { RoundStatus } from '../types'

const LABEL: Record<RoundStatus, string> = {
  bidding: 'bidding',
  awarded: 'awarded',
  deposited: 'in escrow',
  delivered: 'delivered',
  verified: 'verified',
  settled: 'settled',
  refunded: 'refunded',
}

export function StatusPill({ status }: { status: RoundStatus }) {
  return <span className={`pill pill-${status}`} data-testid="status">{LABEL[status]}</span>
}
