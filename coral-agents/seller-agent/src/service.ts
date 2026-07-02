/**
 * Seller service delivery.
 *
 * OmniQuantAI sells financial intelligence reports through the existing CoralOS + Solana escrow rails.
 * The txline route is preserved as a backwards-compatible starter-kit example, but the hackathon demo
 * uses the `omniquant` service.
 */
import { complete, parseJsonReply } from '@pay/agent-runtime'

const TXLINE_BASE = process.env.TXLINE_BASE_URL || 'https://txline-dev.txodds.com'

export async function deliverService(request: string): Promise<string> {
  const [first, ...rest] = request.trim().split(/\s+/).filter(Boolean)
  const service = (first ?? 'omniquant').toLowerCase()
  if (service === 'omniquant') {
    return JSON.stringify(omniQuantService(rest.join(' ')))
  }
  if (service !== 'txline') {
    return JSON.stringify({ error: 'unsupported service', service, supported: ['omniquant', 'txline'] })
  }
  return txlineService(rest.join(' '))
}

function omniQuantService(request: string): unknown {
  const agentName = process.env.AGENT_NAME ?? 'seller-agent'
  const persona = process.env.PERSONA ?? 'financial intelligence seller'
  const understood = request || 'nvda-6m-exposure'
  const base = {
    service: 'omniquant-financial-intelligence',
    agent_name: agentName,
    persona,
    request_understood: understood,
    confidence_score: Number(process.env.CONFIDENCE ?? '78'),
    disclaimer: 'Not financial advice. This is human-reviewable research and does not execute trades.',
    timestamp: new Date().toISOString(),
  }
  const byAgent: Record<string, unknown> = {
    'market-analyst': {
      key_evidence: ['NVDA momentum remains positive', 'Valuation premium raises downside sensitivity'],
      bullish_points: ['AI accelerator demand supports trend', 'Liquidity is deep enough for institutional sizing'],
      bearish_points: ['Multiple compression risk is elevated', 'Short-term expectations are demanding'],
      risks: ['Earnings miss', 'Factor rotation out of mega-cap growth'],
      recommendation_contribution: 'Constructive, but add gradually and avoid chasing extended rallies.',
      what_would_change_view: ['Break below trend support', 'Material earnings revision downgrade'],
    },
    'news-earnings': {
      key_evidence: ['AI capex commentary remains supportive', 'Earnings debate centers on data center durability'],
      bullish_points: ['Hyperscaler demand supports backlog visibility', 'Product cycle can extend leadership'],
      bearish_points: ['Export controls can pressure revenue', 'Customer concentration remains material'],
      risks: ['Guidance reset', 'Supply constraints', 'Analyst downgrade cycle'],
      recommendation_contribution: 'Positive if earnings revisions keep rising and capex commentary stays firm.',
      what_would_change_view: ['Cautious hyperscaler capex commentary', 'Unexpected gross margin pressure'],
    },
    'macro-risk': {
      key_evidence: ['Higher rates pressure long-duration growth multiples', 'Liquidity conditions affect risk appetite'],
      bullish_points: ['Stable or falling rates support premium growth assets'],
      bearish_points: ['A rate shock can compress multiples even if fundamentals remain strong'],
      risks: ['Inflation surprise', 'Higher real rates', 'Dollar strength'],
      recommendation_contribution: 'Increase exposure only with explicit rate sensitivity controls.',
      what_would_change_view: ['100 bps rate shock', 'Clear Fed easing path'],
    },
    'portfolio-risk': {
      key_evidence: ['Single-name concentration can dominate portfolio risk', 'Downside case requires sizing discipline'],
      bullish_points: ['Core position can fit long-term growth mandates'],
      bearish_points: ['Adding above mandate cap creates asymmetric portfolio risk'],
      risks: ['25-40% drawdown scenario', 'Crowded positioning', 'Two weak quarters invalidating the thesis'],
      recommendation_contribution: 'Increase only if current weight is below cap; use staged entries and review triggers.',
      what_would_change_view: ['Current exposure above cap', 'Two consecutive data center growth disappointments'],
    },
  }
  const selected = byAgent[agentName] ?? byAgent['market-analyst']
  return {
    ...base,
    ...selected,
    final_synthesis: {
      executive_summary:
        'OmniQuantAI sees a HOLD-to-BUY bias for increasing NVDA exposure over six months, but only with mandate-aware sizing and macro review triggers.',
      evidence_table: [
        { stance: 'bullish', evidence: 'AI demand and product-cycle leadership remain supportive', source: agentName },
        { stance: 'bearish', evidence: 'Premium valuation and rate sensitivity limit margin of safety', source: agentName },
        { stance: 'neutral', evidence: 'Outcome depends on earnings revisions and hyperscaler capex', source: agentName },
      ],
      hypotheses: [
        { case: 'Bull', probability: 34, thesis: 'AI demand compounds and earnings revisions rise.' },
        { case: 'Base', probability: 46, thesis: 'Fundamentals stay strong but valuation moderates returns.' },
        { case: 'Bear', probability: 20, thesis: 'Rates, competition, or capex digestion reset expectations.' },
      ],
      recommendation: 'HOLD',
      confidence_score: 72,
      human_approval_reminder: 'Human portfolio manager approval required before allocation changes.',
    },
  }
}

async function txlineGet(path: string): Promise<unknown> {
  const apiToken = process.env.TXLINE_API_KEY
  if (!apiToken) return { error: 'TXLINE_API_KEY not set - run the one-time subscribe (see examples/txodds)' }
  const auth = await fetch(`${TXLINE_BASE}/auth/guest/start`, { method: 'POST' })
  if (!auth.ok) return { error: `txline auth ${auth.status}` }
  const jwt = ((await auth.json()) as { token: string }).token
  const res = await fetch(`${TXLINE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken },
  })
  if (!res.ok) return { error: `txline ${path} ${res.status}` }
  return res.json()
}

async function txlineService(request: string): Promise<string> {
  const tokens = request.trim().split(/\s+/).filter(Boolean)
  let action = (tokens[0] ?? 'fixtures').toLowerCase()
  let fixtureId = tokens[1]
  if (/^\d+$/.test(action)) {
    fixtureId = action
    action = 'edge'
  }

  switch (action) {
    case 'odds':
      return JSON.stringify({ service: 'txline-odds', fixtureId, odds: await txlineGet(`/api/odds/snapshot/${fixtureId}`) })
    case 'edge':
      return txlineEdge(fixtureId)
    case 'fixtures':
    default: {
      const fixtures = await txlineGet('/api/fixtures/snapshot')
      const list = Array.isArray(fixtures) ? fixtures : []
      return JSON.stringify({ service: 'txline-fixtures', count: list.length, fixtures: list.slice(0, 10) })
    }
  }
}

async function txlineEdge(fixtureId: string | undefined): Promise<string> {
  const [odds, fixtures] = await Promise.all([
    txlineGet(`/api/odds/snapshot/${fixtureId}`),
    txlineGet('/api/fixtures/snapshot'),
  ])
  const market = Array.isArray(odds)
    ? (odds as Array<Record<string, unknown>>).find((x) => String(x.SuperOddsType ?? '').includes('1X2'))
    : undefined
  const fx = Array.isArray(fixtures)
    ? (fixtures as Array<Record<string, unknown>>).find((f) => String(f.FixtureId) === String(fixtureId))
    : undefined
  const teams = fx ? { home: fx.Participant1, away: fx.Participant2, competition: fx.Competition } : undefined
  const matchup = teams ? `${teams.home} v ${teams.away}` : `fixture ${fixtureId}`

  const analysis = await liveReadOrFallback(matchup, odds, market, teams)
  return JSON.stringify({ service: 'txline-edge', fixtureId, teams, market, analysis })
}

async function liveReadOrFallback(
  matchup: string,
  odds: unknown,
  market: Record<string, unknown> | undefined,
  teams: Record<string, unknown> | undefined,
): Promise<unknown> {
  try {
    const text = await complete({
      system: 'You are a football trading analyst. Reply only as JSON {"call": string, "confidence": number}.',
      user:
        `For ${matchup}, make a one-line value read from these de-margined World Cup odds. ` +
        `Odds: ${JSON.stringify(odds).slice(0, 1500)}`,
      maxTokens: 180,
    })
    return parseJsonReply(text) ?? { call: text }
  } catch (e) {
    return deterministicRead(market, teams, (e as Error).message)
  }
}

function deterministicRead(
  market: Record<string, unknown> | undefined,
  teams: Record<string, unknown> | undefined,
  reason: string,
): unknown {
  const names = (market?.PriceNames ?? []) as string[]
  const pcts = (market?.Pct ?? []) as string[]
  let bestIndex = -1
  let bestPct = -1
  names.forEach((_, i) => {
    const pct = Number(pcts[i])
    if (Number.isFinite(pct) && pct > bestPct) {
      bestPct = pct
      bestIndex = i
    }
  })
  if (bestIndex < 0) return { call: 'odds unavailable', note: `deterministic fallback: ${reason}` }
  const raw = names[bestIndex]
  const label = raw === 'part1'
    ? (teams?.home ?? 'Home')
    : raw === 'part2'
      ? (teams?.away ?? 'Away')
      : 'Draw'
  return {
    call: `Odds favour ${label} (${bestPct.toFixed(0)}%)`,
    confidence: Number((bestPct / 100).toFixed(2)),
    note: `deterministic fallback: ${reason}`,
  }
}
