import type { DataMode } from '../models.js'

export interface NewsProvider {
  name: string
  mode: DataMode
  getHeadlines(input: { symbol: string }): Promise<Array<{ title: string; url?: string; timestamp: string }>>
}
