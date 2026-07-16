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
const omniquantProofPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'evidence',
  '2026-07-16-data-provenance-proof',
  'feed.json',
)
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

  it('guards the OmniQuantAI proof loop from buyer WANT through released settlement', () => {
    const proof = JSON.parse(readFileSync(omniquantProofPath, 'utf8')) as {
      session: string
      namespace: string
      rounds: Array<{
        status: string
        want?: { service: string; arg: string; budgetSol: number }
        bids: Array<{ by: string; priceSol: number; note?: string }>
        award?: { to: string }
        deposit?: { sig: string; buyer: string }
        delivered?: { data?: Record<string, unknown> }
        verified?: { status: string; score: number }
        release?: { sig: string }
      }>
    }
    const round = proof.rounds.find((candidate) => candidate.want?.service === 'omniquant')

    expect(proof.session).toBeTruthy()
    expect(proof.namespace).toBe('omniquant')
    expect(round?.want).toMatchObject({
      service: 'omniquant',
      arg: 'nvda-3-6m-exposure',
      budgetSol: 0.03,
    })
    expect(round?.bids).toHaveLength(4)
    expect(round?.bids.map((bid) => bid.by).sort()).toEqual([
      'macro-risk',
      'market-analyst',
      'news-earnings',
      'portfolio-risk',
    ])
    expect(round?.award?.to).toBe('news-earnings')
    expect(round?.deposit?.sig).toBeTruthy()
    expect(round?.delivered?.data?.investment_committee_memo).toBeTruthy()
    const memo = round?.delivered?.data?.investment_committee_memo as {
      data_sources?: Array<{ label?: string; mode?: string; timestamp?: string }>
      latest_price?: { source?: string; timestamp?: string }
      recent_headlines?: Array<{ source?: string; timestamp?: string }>
    } | undefined
    expect(memo?.data_sources?.length).toBeGreaterThan(0)
    expect(memo?.data_sources?.every((source) => source.label && source.mode && source.timestamp)).toBe(true)
    expect(memo?.data_sources?.map((source) => source.mode)).toEqual(expect.arrayContaining(['DEMO FALLBACK DATA']))
    expect(memo?.latest_price).toEqual(expect.objectContaining({ source: expect.any(String), timestamp: expect.any(String) }))
    expect(memo?.recent_headlines?.every((headline) => headline.source && headline.timestamp)).toBe(true)
    expect(round?.delivered?.data?.disclaimer).toContain('Not financial advice')
    expect(round?.verified).toMatchObject({ status: 'PASS', score: 100 })
    expect(round?.release?.sig).toBeTruthy()
    expect(round?.status).toBe('settled')
    expect(`https://explorer.solana.com/tx/${round?.release?.sig}?cluster=devnet`).toContain('cluster=devnet')
  })
})
