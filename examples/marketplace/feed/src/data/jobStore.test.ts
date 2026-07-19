import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getPersistedStartMarketJob, persistStartMarketJob } from './jobStore.js'
import type { StartMarketJob } from '../redisQueue.js'

describe('jobStore', () => {
  it('persists the latest start market job state by id', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'omniquant-jobs-'))
    const base: StartMarketJob = {
      id: 'job-1',
      type: 'start_market',
      status: 'queued',
      namespace: 'omniquant',
      request: { asset: 'NVDA' },
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: 'idem-1',
    }
    await persistStartMarketJob(base, dataDir)
    await persistStartMarketJob({
      ...base,
      status: 'completed',
      session: 'session-1',
      updatedAt: '2026-07-19T00:01:00.000Z',
    }, dataDir)

    await expect(getPersistedStartMarketJob('job-1', dataDir)).resolves.toMatchObject({
      id: 'job-1',
      status: 'completed',
      session: 'session-1',
    })
  })
})
