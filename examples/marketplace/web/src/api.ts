import { useEffect, useRef, useState } from 'react'
import type { AgentRegistration, Feed, FeedDiagnostics } from './types'

const FEED_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_FEED_URL ?? ''
export const API_BASE_URL = FEED_URL || 'same-origin /api proxy'
const HEALTH_TIMEOUT_MS = 2500

export interface UiError {
  title: string
  what: string
  likelyCause: string
  suggestedFix: string
}

export interface ApiHealthState {
  status: 'checking' | 'online' | 'offline'
  apiUrl: string
  detail?: string
}

export interface RegistryState {
  agents: AgentRegistration[]
  discoverable: AgentRegistration[]
  pending: AgentRegistration[]
  status: 'checking' | 'online' | 'offline'
  error?: UiError
  updatedAt?: string
}

export function useApiHealth(intervalMs = 15000): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ status: 'checking', apiUrl: API_BASE_URL })

  useEffect(() => {
    let stopped = false
    const check = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
      try {
        const res = await fetch(`${FEED_URL}/api/health?quick=1`, { signal: controller.signal })
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; build?: string; error?: string }
        if (!stopped) {
          setState({
            status: res.ok && body.ok !== false ? 'online' : 'offline',
            apiUrl: API_BASE_URL,
            detail: body.build ?? body.error ?? `health ${res.status}`,
          })
        }
      } catch (error) {
        if (!stopped) {
          setState({
            status: 'offline',
            apiUrl: API_BASE_URL,
            detail: error instanceof Error ? error.message : 'API health check failed',
          })
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void check()
    const id = window.setInterval(check, intervalMs)
    return () => { stopped = true; window.clearInterval(id) }
  }, [intervalMs])

  return state
}

export function useAgentRegistry(apiHealth: ApiHealthState, intervalMs = 15000): RegistryState {
  const [state, setState] = useState<RegistryState>({
    agents: [],
    discoverable: [],
    pending: [],
    status: apiHealth.status === 'online' ? 'checking' : 'offline',
  })

  useEffect(() => {
    let stopped = false
    if (apiHealth.status !== 'online') {
      setState({ agents: [], discoverable: [], pending: [], status: 'offline' })
      return
    }
    const load = async () => {
      try {
        const [registeredRes, discoverRes] = await Promise.all([
          fetch(`${FEED_URL}/api/registry/agents`),
          fetch(`${FEED_URL}/api/registry/discover?market=omniquant`),
        ])
        const registeredBody = (await registeredRes.json().catch(() => ({}))) as { agents?: AgentRegistration[]; error?: string }
        const discoverBody = (await discoverRes.json().catch(() => ({}))) as { agents?: AgentRegistration[]; error?: string }
        if (!registeredRes.ok || !discoverRes.ok) {
          throw new Error(registeredBody.error ?? discoverBody.error ?? `registry ${registeredRes.status}/${discoverRes.status}`)
        }
        const agents = registeredBody.agents ?? []
        const discoverable = discoverBody.agents ?? []
        const pending = agents.filter((agent) => agent.status === 'pending')
        if (!stopped) {
          setState({ agents, discoverable, pending, status: 'online', updatedAt: new Date().toISOString() })
        }
      } catch (error) {
        if (!stopped) {
          setState((current) => ({
            ...current,
            status: 'offline',
            error: friendlyRegistryError(error),
            updatedAt: new Date().toISOString(),
          }))
        }
      }
    }
    void load()
    const id = window.setInterval(load, intervalMs)
    return () => { stopped = true; window.clearInterval(id) }
  }, [apiHealth.status, intervalMs])

  return state
}

/** Ask the feed server to launch a market session; returns its id. (Fund wallets first.) */
export async function startMarket(): Promise<{ session: string; namespace?: string }> {
  try {
    const r = await fetch(`${FEED_URL}/api/start`, { method: 'POST' })
    const body = (await r.json().catch(() => ({}))) as { session?: string; namespace?: string; error?: string; log?: string }
    if (!r.ok || !body.session) {
      const detail = [body.error ?? `start failed (${r.status})`, body.log].filter(Boolean).join(': ')
      throw new Error(detail)
    }
    return { session: body.session, namespace: body.namespace }
  } catch (error) {
    throw friendlyError(error, 'start')
  }
}

export interface FeedState {
  rounds: Feed['rounds']
  connected: boolean
  error?: UiError
  diagnostics?: FeedDiagnostics
  updatedAt?: string
  polling: boolean
  apiUrl: string
}

/**
 * Poll the feed server for a session's rounds. A plain hook (no extra deps) — swap for TanStack Query
 * or an SSE endpoint when you outgrow polling. `intervalMs` defaults to 1s.
 */
export function useFeed(session: string, namespace?: string, intervalMs = 1000): FeedState {
  const [state, setState] = useState<FeedState>({ rounds: [], connected: false, polling: false, apiUrl: API_BASE_URL })
  const stop = useRef(false)

  useEffect(() => {
    stop.current = false
    if (!session) {
      setState({ rounds: [], connected: false, polling: false, apiUrl: API_BASE_URL })
      return
    }
    const tick = async () => {
      try {
        const params = new URLSearchParams({ session })
        if (namespace) params.set('namespace', namespace)
        const r = await fetch(`${FEED_URL}/api/feed?${params.toString()}`)
        const feed = (await r.json().catch(() => ({}))) as Feed
        if (!r.ok) {
          const detail = feed.error ?? feed.diagnostics?.buyerStatus ?? `feed ${r.status}`
          if (!stop.current) {
            setState((s) => ({
              ...s,
              rounds: feed.rounds ?? [],
              connected: false,
              error: friendlyError(new Error(detail), 'feed'),
              diagnostics: feed.diagnostics,
              updatedAt: feed.updatedAt,
              polling: true,
              apiUrl: API_BASE_URL,
            }))
          }
          return
        }
        if (!stop.current) {
          if (feed.diagnostics) {
            console.debug(`[market-feed] session=${feed.session} events=${feed.diagnostics.messageCount} last=${feed.diagnostics.lastEventType} rounds=${feed.rounds?.length ?? 0}`)
          }
          setState({
            rounds: feed.rounds ?? [],
            connected: true,
            error: feed.error ? friendlyError(new Error(feed.error), 'feed') : undefined,
            diagnostics: feed.diagnostics,
            updatedAt: feed.updatedAt,
            polling: true,
            apiUrl: API_BASE_URL,
          })
        }
      } catch (e) {
        if (!stop.current) setState((s) => ({ ...s, connected: false, polling: true, error: friendlyError(e, 'feed'), apiUrl: API_BASE_URL }))
      }
    }
    void tick()
    const id = setInterval(tick, intervalMs)
    return () => { stop.current = true; clearInterval(id) }
  }, [session, namespace, intervalMs])

  return state
}

export function friendlyError(error: unknown, phase: 'start' | 'feed'): UiError {
  const message = (error as Error).message || 'Unknown feed error'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return {
      title: 'API unavailable',
      what: phase === 'start' ? 'The dashboard could not reach the market launcher.' : 'The dashboard could not reach the marketplace feed.',
      likelyCause: 'The feed server on port 4000 is not running or the Codespaces forwarded URL is not using the Vite proxy.',
      suggestedFix: 'Run the judge/demo command again, confirm port 4000 is active, then retry Start Market.',
    }
  }
  if (/coral/i.test(message)) {
    return {
      title: 'CoralOS unavailable',
      what: 'The feed server is up, but it could not read the CoralOS session thread.',
      likelyCause: message,
      suggestedFix: 'Confirm the CoralOS container is healthy on port 5555, then retry the market.',
    }
  }
  if (/wallet|fund/i.test(message)) {
    return {
      title: 'Wallet not funded',
      what: 'The market launcher could not complete because the devnet wallet needs SOL.',
      likelyCause: message,
      suggestedFix: 'Fund the buyer wallet from the Solana devnet faucet, then retry Start Market.',
    }
  }
  if (/timed out|launcher/i.test(message)) {
    return {
      title: 'Market launch timed out',
      what: 'The session did not finish launching within the expected window.',
      likelyCause: message,
      suggestedFix: 'Check the terminal logs for buyer/seller startup, then retry Start Market.',
    }
  }
  return {
    title: phase === 'start' ? 'Market could not start' : 'Feed error',
    what: message,
    likelyCause: 'The demo runtime returned an unexpected response.',
    suggestedFix: 'Retry once. If it repeats, inspect Debug Status and the feed server logs.',
  }
}

function friendlyRegistryError(error: unknown): UiError {
  const message = (error as Error).message || 'Registry request failed'
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) {
    return {
      title: 'Registry API unavailable',
      what: 'The dashboard could not reach the agent registry endpoints.',
      likelyCause: 'The marketplace feed API is offline or the public site is running in proof mode.',
      suggestedFix: 'Run the local/Codespaces demo runtime, then refresh the Developer Registry panel.',
    }
  }
  return {
    title: 'Registry could not load',
    what: message,
    likelyCause: 'The registry endpoint returned an unexpected response.',
    suggestedFix: 'Check /api/registry/agents and the feed server logs.',
  }
}
