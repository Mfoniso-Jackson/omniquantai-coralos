import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collectMessages } from './coralState.js'
import { foldRounds } from './foldRounds.js'
import { persistMarketplaceData } from './data/persistence.js'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'coral-session.json')
const state = JSON.parse(readFileSync(fixturePath, 'utf8'))
const sellers = ['seller-cheap', 'seller-premium', 'seller-lazy']

async function readJsonl<T>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf8')
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
}

describe('testnet market lifecycle smoke', () => {
  it('proves a captured CoralOS round reaches settlement and persists market history', async () => {
    const messages = collectMessages(state)
    const rounds = foldRounds(messages, sellers)
    const settled = rounds[0]

    expect(messages.map((message) => message.text.trim().match(/^([A-Z_]+)/)?.[1]).filter(Boolean)).toEqual(
      expect.arrayContaining(['WANT', 'BID', 'AWARD', 'ESCROW_REQUIRED', 'DEPOSITED', 'DELIVERED', 'RELEASED']),
    )
    expect(settled.status).toBe('settled')
    expect(settled.release?.sig).toBeTruthy()

    const dataDir = await mkdtemp(join(tmpdir(), 'omniquant-smoke-'))
    try {
      await persistMarketplaceData({ sessionId: 'smoke-session', rounds, dataDir })

      const requests = await readJsonl<{ service: string; argument: string }>(join(dataDir, 'research_requests.jsonl'))
      const bids = await readJsonl<{ sellerId: string; bidPriceSol: number }>(join(dataDir, 'agent_bids.jsonl'))
      const winners = await readJsonl<{ sellerId: string }>(join(dataDir, 'winners.jsonl'))
      const settlements = await readJsonl<{ status: string; releaseSignature?: string }>(join(dataDir, 'settlements.jsonl'))
      const reputation = await readJsonl<{ agentId: string; jobsCompleted: number; wins: number; revenueSol: number }>(
        join(dataDir, 'agent_reputation.jsonl'),
      )

      expect(requests[0]).toMatchObject({ service: 'coingecko', argument: 'SOL-USDC' })
      expect(bids).toHaveLength(2)
      expect(winners[0]?.sellerId).toBe(settled.award?.to)
      expect(settlements.some((record) => record.status === 'RELEASED' && record.releaseSignature)).toBe(true)
      expect(reputation.find((record) => record.agentId === settled.award?.to)).toMatchObject({
        jobsCompleted: 1,
        wins: 1,
        revenueSol: settled.bids.find((bid) => bid.by === settled.award?.to)?.priceSol,
      })
    } finally {
      await rm(dataDir, { recursive: true, force: true })
    }
  })
})
