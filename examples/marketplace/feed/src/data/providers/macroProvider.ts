import type { DataMode } from '../models.js'

export interface MacroProvider {
  name: string
  mode: DataMode
  getMacroContext(): Promise<Record<string, unknown>>
}
