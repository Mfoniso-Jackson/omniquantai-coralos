import { launchMarketSession } from './marketLauncher.js'
import { assignSessionToOrganization } from './data/organizationStore.js'
import { recordActivationEvent } from './data/activationStore.js'
import {
  deadLetterStartMarketJob,
  requeueStartMarketJob,
  reserveStartMarketJob,
  redisAvailable,
  setJob,
  type StartMarketJob,
} from './redisQueue.js'

const NS = process.env.CORAL_NAMESPACE ?? 'omniquant'
const START_READY_RETRIES = Number(process.env.FEED_START_READY_RETRIES ?? 35)
const START_READY_RETRY_MS = Number(process.env.FEED_START_READY_RETRY_MS ?? 1000)
const LAUNCH_TIMEOUT_MS = Math.max(60_000, START_READY_RETRIES * START_READY_RETRY_MS + 10_000)
const JOB_BACKOFF_MS = Number(process.env.START_MARKET_RETRY_BACKOFF_MS ?? process.env.JOB_BACKOFF_MS ?? 5000)

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
  const running = {
    ...job,
    status: 'running' as const,
    attempts: job.attempts + 1,
    retryAt: undefined,
    updatedAt: new Date().toISOString(),
  }
  await setJob(running)
  console.error(`[worker] job=${job.id} attempt=${running.attempts}/${running.maxAttempts} starting market namespace=${job.namespace || NS}`)
  try {
    const launch = researchLaunchEnv(job.request)
    const result = await launchMarketSession({
      namespace: job.namespace || NS,
      timeoutMs: LAUNCH_TIMEOUT_MS,
      env: { ...process.env, ...launch, CORAL_NAMESPACE: job.namespace || NS },
    })
    if (job.organizationId) {
      await assignSessionToOrganization({
        organizationId: job.organizationId,
        sessionId: result.session,
        assignedBy: job.assignedBy ?? 'system:start-market-worker',
      })
    }
    await recordActivationEvent({
      type: 'research_started',
      organizationId: job.organizationId,
      sessionId: result.session,
      asset: launch.RESEARCH_ASSET,
      objective: launch.RESEARCH_OBJECTIVE,
      question: launch.RESEARCH_QUESTION,
      actor: job.assignedBy ?? 'system:start-market-worker',
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
    const failed = {
      ...running,
      status: 'failed',
      error: (error as Error).message,
      updatedAt: new Date().toISOString(),
    } satisfies StartMarketJob
    if (failed.attempts < failed.maxAttempts) {
      const retryDelay = retryDelayMs(failed.attempts)
      const retry = {
        ...failed,
        status: 'queued' as const,
        retryAt: new Date(Date.now() + retryDelay).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await setJob(failed)
      console.error(`[worker] job=${job.id} failed attempt=${failed.attempts}: ${failed.error}; retrying in ${retryDelay}ms`)
      await sleep(retryDelay)
      await requeueStartMarketJob(retry)
      return
    }
    await deadLetterStartMarketJob(failed)
    console.error(`[worker] job=${job.id} dead-lettered after ${failed.attempts} attempt(s): ${failed.error}`)
  }
}

function researchLaunchEnv(request: Record<string, unknown>): NodeJS.ProcessEnv {
  const asset = cleanSymbol(request.asset) ?? cleanSymbol(request.symbol) ?? 'NVDA'
  const objective = cleanOptional(request.objective) ?? 'increase exposure over the next 3-6 months'
  const question = cleanOptional(request.question) ?? cleanOptional(request.request) ?? `Should our fund ${objective.toLowerCase()} for ${asset}?`
  return {
    RESEARCH_ASSET: asset,
    RESEARCH_OBJECTIVE: objective,
    RESEARCH_QUESTION: question,
    BUYER_ARG: `${asset.toLowerCase()}-${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'research'}`,
  }
}

function cleanSymbol(value: unknown): string | undefined {
  const text = cleanOptional(value)?.toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  return text ? text.slice(0, 12) : undefined
}

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function retryDelayMs(attempt: number): number {
  const base = Number.isFinite(JOB_BACKOFF_MS) && JOB_BACKOFF_MS >= 0 ? JOB_BACKOFF_MS : 5000
  return base * Math.max(1, attempt)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  console.error(`[worker] fatal: ${(error as Error).message}`)
  process.exitCode = 1
})
