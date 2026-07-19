import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { StartMarketJob } from '../redisQueue.js'
import { dataDirFromEnv } from './history.js'

export async function persistStartMarketJob(job: StartMarketJob, dataDir = dataDirFromEnv()): Promise<void> {
  if (process.env.OMNIQUANT_PERSIST === '0') return
  await mkdir(dataDir, { recursive: true })
  await appendFile(join(dataDir, 'market_jobs.jsonl'), `${JSON.stringify(job)}\n`, 'utf8')
}

export async function getPersistedStartMarketJob(id: string, dataDir = dataDirFromEnv()): Promise<StartMarketJob | undefined> {
  const jobs = await readJsonl<StartMarketJob>(dataDir, 'market_jobs')
  return jobs.filter((job) => job.id === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

async function readJsonl<T>(dataDir: string, collection: string): Promise<T[]> {
  try {
    const raw = await readFile(join(dataDir, `${collection}.jsonl`), 'utf8')
    return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
