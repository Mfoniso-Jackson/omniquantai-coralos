import type { DataMode } from '../models.js'

export interface FundamentalsProvider {
  name: string
  mode: DataMode
  getFundamentals(input: { symbol: string }): Promise<Record<string, unknown>>
}
