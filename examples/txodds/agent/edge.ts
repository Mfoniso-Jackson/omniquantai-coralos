/**
 * Edge analysis — the "verified data → the agent's read" transform, shared by the agent
 * (`deliverService`) and the web proxy (`/api/edge`). Pure except for the LLM call, which is injectable
 * so the deterministic fallback is unit-tested without the network.
 *
 * What it sells, honestly: TxODDS gives a **de-margined fair line** — true-probability estimates with
 * the bookmaker's margin removed. From that we derive, per outcome, the implied probability AND its
 * **fair (break-even) decimal odds** = 100 / probability — the price a bettor would need a sportsbook to
 * *beat* for the bet to have value. We do NOT claim a betting edge: that needs an offered price to
 * compare against, which the free tier doesn't carry. The product is the verified fair line + the
 * break-even prices + a one-line plain-language read (LLM, with a deterministic fallback).
 */
import { complete, parseJsonReply, type CompleteOpts } from '@pay/agent-runtime'

export interface EdgeInput {
  fixtureId: number | string
  /** `/api/odds/snapshot/{id}` — array of markets. */
  odds: unknown
  /** `/api/fixtures/snapshot` — array of fixtures (for team names). Optional. */
  fixtures?: unknown
}

/** One outcome of the verified fair line. */
export interface FairOutcome {
  /** raw price name: 'part1' | 'draw' | 'part2' | 'over' | 'under' | … */
  name: string
  /** resolved label (team name / Draw / Over / Under). */
  label: string
  /** de-margined implied probability, 0–100. */
  pct: number
  /** fair (break-even) decimal odds = 100 / pct — the price you'd need a book to beat. */
  fairOdds: number
}

export interface Edge {
  fixtureId: string
  teams?: { home: unknown; away: unknown; competition: unknown }
  market?: { names: unknown; pct: unknown }
  /** the verified fair line: every priced outcome + its break-even odds, and the favourite. */
  fair?: { outcomes: FairOutcome[]; favourite?: FairOutcome }
  analysis: { call: string; confidence?: number; note?: string }
}

type Llm = (opts: CompleteOpts) => Promise<string>
type Rec = Record<string, unknown>

const labelFor = (name: string, teams?: { home: unknown; away: unknown }): string => {
  switch (name) {
    case 'part1': return String(teams?.home ?? 'Home')
    case 'part2': return String(teams?.away ?? 'Away')
    case 'draw': return 'Draw'
    case 'over': return 'Over'
    case 'under': return 'Under'
    default: return name
  }
}

/** Resolve the best de-margined market (1X2 preferred, else any with a finite price) + the matchup. */
function shape(input: EdgeInput) {
  const fixtureId = String(input.fixtureId)
  const arr = Array.isArray(input.odds) ? (input.odds as Rec[]) : []
  const finite = (x: Rec) =>
    Array.isArray(x.PriceNames) && (x.PriceNames as unknown[]).some((_, i) => Number.isFinite(Number((x.Pct as unknown[])?.[i])))
  const m = arr.find((x) => String(x.SuperOddsType ?? '').includes('1X2') && finite(x)) ?? arr.find(finite)
  const market = m ? { names: m.PriceNames, pct: m.Pct } : undefined
  const fx = Array.isArray(input.fixtures)
    ? (input.fixtures as Rec[]).find((f) => String(f.FixtureId) === fixtureId)
    : undefined
  const teams = fx ? { home: fx.Participant1, away: fx.Participant2, competition: fx.Competition } : undefined
  return { fixtureId, market, teams }
}

/** Build the verified fair line: each priced outcome + its break-even decimal odds, and the favourite. */
export function fairLine(
  market: { names: unknown; pct: unknown } | undefined,
  teams: { home: unknown; away: unknown } | undefined,
): { outcomes: FairOutcome[]; favourite?: FairOutcome } {
  const names = (market?.names ?? []) as string[]
  const pcts = (market?.pct ?? []) as Array<string | number>
  const outcomes: FairOutcome[] = []
  names.forEach((name, i) => {
    const pct = Number(pcts[i])
    if (Number.isFinite(pct) && pct > 0) {
      outcomes.push({ name, label: labelFor(name, teams), pct, fairOdds: Number((100 / pct).toFixed(2)) })
    }
  })
  const favourite = outcomes.reduce<FairOutcome | undefined>((best, o) => (!best || o.pct > best.pct ? o : best), undefined)
  return { outcomes, favourite }
}

/** Deterministic plain-language read of the fair line — the no-LLM fallback. */
export function deterministicCall(
  market: { names: unknown; pct: unknown } | undefined,
  teams: { home: unknown; away: unknown } | undefined,
): Edge['analysis'] {
  const { outcomes, favourite } = fairLine(market, teams)
  if (!favourite) return { call: 'no priced market for this fixture', confidence: 0, note: 'deterministic' }
  const alt = outcomes.filter((o) => o !== favourite).sort((a, b) => b.pct - a.pct)[0]
  const altTxt = alt ? `; ${alt.label} the main alternative at ${alt.pct.toFixed(0)}%` : ''
  return {
    call: `${favourite.label} is the verified favourite at ${favourite.pct.toFixed(0)}% — fair odds ${favourite.fairOdds.toFixed(2)}${altTxt}.`,
    confidence: Number((favourite.pct / 100).toFixed(2)),
    note: 'deterministic — add an LLM key for a model read',
  }
}

/** Turn the verified snapshots into the sellable product. `llm` is injectable for tests. */
export async function analyzeEdge(input: EdgeInput, llm: Llm = complete): Promise<Edge> {
  const { fixtureId, market, teams } = shape(input)
  const fair = fairLine(market, teams)
  const matchup = teams ? `${teams.home} v ${teams.away}` : `fixture ${fixtureId}`

  let analysis: Edge['analysis'] | undefined
  if (fair.favourite) {
    try {
      const raw = await llm({
        system:
          'You are a football trading analyst. You are given a VERIFIED de-margined fair line — true-probability ' +
          'estimates with the bookmaker margin removed, NOT offered prices. Return JSON {call, confidence}: `call` is ' +
          'ONE plain sentence reading the line (who is favoured, how decisive, the live alternative). Do NOT claim a ' +
          'betting edge or "value" — you only have the fair line, not what any book is offering. confidence 0–1 is how ' +
          'decisive the favourite is.',
        user: `${matchup}. Verified fair line: ${JSON.stringify(fair.outcomes.map((o) => ({ outcome: o.label, prob: `${o.pct.toFixed(1)}%`, fairOdds: o.fairOdds })))}`,
        maxTokens: 160,
      })
      const parsed = parseJsonReply<{ call?: unknown; confidence?: unknown }>(raw)
      if (parsed && typeof parsed.call === 'string') {
        const confidence = Number(parsed.confidence)
        analysis = { call: parsed.call, ...(Number.isFinite(confidence) ? { confidence } : {}) }
      }
    } catch {
      /* LLM unavailable → deterministic fallback below */
    }
  }

  return { fixtureId, teams, market, fair, analysis: analysis ?? deterministicCall(market, teams) }
}
