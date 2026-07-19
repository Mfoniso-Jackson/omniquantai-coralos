import { afterEach, describe, expect, it } from 'vitest'
import { jobKey, redisAvailable } from './redisQueue.js'

describe('redisQueue configuration helpers', () => {
  const originalRedisUrl = process.env.REDIS_URL
  const originalJobPrefix = process.env.START_MARKET_JOB_PREFIX

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl
    process.env.START_MARKET_JOB_PREFIX = originalJobPrefix
  })

  it('reports unavailable when REDIS_URL is not configured', () => {
    delete process.env.REDIS_URL
    expect(redisAvailable()).toBe(false)
  })

  it('reports available when REDIS_URL is configured', () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    expect(redisAvailable()).toBe(true)
  })

  it('uses the default job key prefix', () => {
    expect(jobKey('job-123')).toBe('omniquant:market-job:job-123')
  })
})
