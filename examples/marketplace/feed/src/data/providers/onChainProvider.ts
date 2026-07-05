import type { DataMode } from '../models.js'

export interface OnChainProvider {
  name: string
  mode: DataMode
  getSettlementContext(input: { signature?: string }): Promise<Record<string, unknown>>
}
