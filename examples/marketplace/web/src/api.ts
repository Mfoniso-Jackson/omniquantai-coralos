import { useEffect, useRef, useState } from 'react'
import type { Feed, FeedDiagnostics } from './types'

const FEED_URL = import.meta.env.VITE_FEED_URL ?? ''

/** Ask the feed server to launch a market session; returns its id. (Fund wallets first.) */
export async function startMarket(): Promise<string> {
  const r = await fetch(`${FEED_URL}/api/start`, { method: 'POST' })
  const body = (await r.json()) as { session?: string; error?: string }
  if (!r.ok || !body.session) throw new Error(body.error ?? `start failed (${r.status})`)
  return body.session
}

export interface FeedState {
  rounds: Feed['rounds']
  connected: boolean
  error?: string
  diagnostics?: FeedDiagnostics
  updatedAt?: string
}

/**
 * Poll the feed server for a session's rounds. A plain hook (no extra deps) — swap for TanStack Query
 * or an SSE endpoint when you outgrow polling. `intervalMs` defaults to 1s.
 */
export function useFeed(session: string, intervalMs = 1000): FeedState {
  const [state, setState] = useState<FeedState>({ rounds: [], connected: false })
  const stop = useRef(false)

  useEffect(() => {
    stop.current = false
    if (!session) {
      setState({ rounds: [], connected: false, error: 'no session' })
      return
    }
    const tick = async () => {
      try {
        const r = await fetch(`${FEED_URL}/api/feed?session=${encodeURIComponent(session)}`)
        const feed = (await r.json().catch(() => ({}))) as Feed
        if (!r.ok) {
          const detail = feed.error ?? feed.diagnostics?.buyerStatus ?? `feed ${r.status}`
          throw new Error(detail)
        }
        if (!stop.current) {
          if (feed.diagnostics) {
            console.debug(`[market-feed] session=${feed.session} events=${feed.diagnostics.messageCount} last=${feed.diagnostics.lastEventType} rounds=${feed.rounds?.length ?? 0}`)
          }
          setState({
            rounds: feed.rounds ?? [],
            connected: true,
            error: feed.error,
            diagnostics: feed.diagnostics,
            updatedAt: feed.updatedAt,
          })
        }
      } catch (e) {
        if (!stop.current) setState((s) => ({ ...s, connected: false, error: friendlyError(e) }))
      }
    }
    void tick()
    const id = setInterval(tick, intervalMs)
    return () => { stop.current = true; clearInterval(id) }
  }, [session, intervalMs])

  return state
}

function friendlyError(error: unknown): string {
  const message = (error as Error).message || 'Unknown feed error'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'API unreachable. In Codespaces, open the forwarded port 5173 URL and make sure the feed server is running on port 4000.'
  }
  if (/coral/i.test(message)) return `CoralOS unreachable or session not readable: ${message}`
  if (/no session/i.test(message)) return 'No session selected. Start a market or open the generated presentation URL.'
  return message
}
