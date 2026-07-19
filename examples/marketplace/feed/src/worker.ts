import { launchMarketSession } from './marketLauncher.js'
import { reserveStartMarketJob, redisAvailable, setJob, type StartMarketJob } from './redisQueue.js'

const NS = process.env.CORAL_NAMESPACE ?? 'omniquant'
const START_READY_RETRIES = Number(process.env.FEED_START_READY_RETRIES ?? 35)
const START_READY_RETRY_MS = Number(process.env.FEED_START_READY_RETRY_MS ?? 1000)
const LAUNCH_TIMEOUT_MS = Math.max(60_000, START_READY_RETRIES * START_READY_RETRY_MS + 10_000)

let stopping = false
process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

async function main(): Promise<void> {
  if (!redisAvailable()) throw new Error('REDIS_URL is required to run the market worker')
  console.error('[worker] omniquant-worker started; waiting for start_market jobs')
  while (!stopping) {
    const job = await reserveStartMarketJob(5)
    if (!job) continue
    await runJob(job).catch((error) => {
      console.error(`[worker] job=${job.id} failed outside handler: ${(error as Error).message}`)
    })
  }
  console.error('[worker] stopped')
}

async function runJob(job: StartMarketJob): Promise<void> {
  const running = { ...job, status: 'running' as const, updatedAt: new Date().toISOString() }
  await setJob(running)
  console.error(`[worker] job=${job.id} starting market namespace=${job.namespace || NS}`)
  try {
    const result = await launchMarketSession({
      namespace: job.namespace || NS,
      timeoutMs: LAUNCH_TIMEOUT_MS,
      env: { ...process.env, CORAL_NAMESPACE: job.namespace || NS },
    })
    await setJob({
      ...running,
      status: 'completed',
      session: result.session,
      namespace: result.namespace,
      updatedAt: new Date().toISOString(),
    })
    console.error(`[worker] job=${job.id} completed session=${result.session} namespace=${result.namespace}`)
  } catch (error) {
    await setJob({
      ...running,
      status: 'failed',
      error: (error as Error).message,
      updatedAt: new Date().toISOString(),
    })
    console.error(`[worker] job=${job.id} failed: ${(error as Error).message}`)
  }
}

main().catch((error) => {
  console.error(`[worker] fatal: ${(error as Error).message}`)
  process.exitCode = 1
})
