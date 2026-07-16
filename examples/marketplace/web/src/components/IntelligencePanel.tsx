interface IntelligenceReport {
  agent_name?: string
  request_understood?: string
  portfolio_context?: { holding: string; weight: number }[]
  evidence_cards?: { category: string; status: string; confidence: number; explanation: string }[]
  key_evidence?: Array<string | { source?: string; timestamp?: string; finding?: string }>
  bullish_points?: string[]
  bearish_points?: string[]
  risks?: string[]
  confidence_score?: number
  recommendation_contribution?: string
  what_would_change_view?: string[]
  disclaimer?: string
  final_synthesis?: {
    executive_summary?: string
    recommendation?: string
    confidence_score?: number
    bull_case?: string
    base_case?: string
    bear_case?: string
    risk_factors?: string[]
    confidence_caveat?: string
    human_approval_reminder?: string
  }
  investment_committee_memo?: {
    title?: string
    company?: string
    investment_question?: string
    supporting_specialist_agents?: string[]
    recommendation?: string
    confidence_score?: number
    data_badge?: 'Live data' | 'Demo fallback data'
    latest_price?: {
      symbol?: string
      price?: number
      currency?: string
      daily_change_percent?: number
      weekly_change_percent?: number
      timestamp?: string
      source?: string
    }
    recent_headlines?: { title: string; source: string; url?: string; timestamp: string }[]
    solana_oracle_context?: {
      symbol?: string
      price?: number
      confidenceInterval?: number
      network?: string
      use?: string
      source?: { label?: string; mode?: string; timestamp?: string }
    }
    data_sources?: { label: string; mode: string; timestamp: string }[]
    provider_observability?: {
      provider: string
      capability: string
      mode: string
      latencyMs: number
      cacheHit: boolean
      success: boolean
      fallbackUsed: boolean
      error?: string
      timestamp: string
    }[]
    data_timestamp?: string
    confidence_caveat?: string
    executive_summary?: string
    bull_case?: string
    base_case?: string
    bear_case?: string
    key_risks?: string[]
    portfolio_considerations?: string
    what_would_change_view?: string[]
    disclaimer?: string
  }
}

const list = (items: Array<string | { source?: string; timestamp?: string; finding?: string }> | undefined) => (
  <ul>
    {(items ?? []).map((item, index) => (
      <li key={`${renderItem(item)}-${index}`}>{renderItem(item)}</li>
    ))}
  </ul>
)

export function IntelligencePanel({ report }: { report: IntelligenceReport }) {
  const memo = report.investment_committee_memo
  const badge = memo?.data_badge
  const observations = memo?.provider_observability ?? []
  return (
    <div className="intel-panel" data-testid="intel-report">
      <div className="intel-head">
        <span>{memo?.title ?? 'Financial Intelligence Delivered'} · {report.agent_name}</span>
        {badge && <em className={badge === 'Live data' ? 'data-live' : 'data-demo'}>{badge}</em>}
      </div>
      {memo && (
        <section className="memo-hero">
          <div>
            <span>Company</span>
            <strong>{memo.company}</strong>
          </div>
          <div>
            <span>Recommendation</span>
            <strong>{memo.recommendation}</strong>
          </div>
          <div>
            <span>Confidence</span>
            <strong>{memo.confidence_score}/100</strong>
          </div>
        </section>
      )}
      {memo?.latest_price && (
        <section className="data-strip">
          <div>
            <span>Latest Price</span>
            <strong>{memo.latest_price.currency ?? 'USD'} {formatNumber(memo.latest_price.price)}</strong>
          </div>
          <div>
            <span>Daily</span>
            <strong>{formatPct(memo.latest_price.daily_change_percent)}</strong>
          </div>
          <div>
            <span>Weekly</span>
            <strong>{formatPct(memo.latest_price.weekly_change_percent)}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{memo.latest_price.source ?? 'unknown'}</strong>
          </div>
        </section>
      )}
      {memo?.recent_headlines && (
        <section className="headline-list">
          <h3>Recent Headlines</h3>
          {memo.recent_headlines.map((headline) => (
            <p key={`${headline.title}-${headline.timestamp}`}>
              {headline.url ? <a href={headline.url} target="_blank" rel="noreferrer">{headline.title}</a> : headline.title}
              <span>{headline.source} · {formatTime(headline.timestamp)}</span>
            </p>
          ))}
        </section>
      )}
      {memo?.solana_oracle_context && (
        <section className="oracle-note">
          <h3>Solana Oracle Context</h3>
          <p>
            <strong>{memo.solana_oracle_context.symbol}</strong>
            {' '}at USD {formatNumber(memo.solana_oracle_context.price)}
            {' '}via {memo.solana_oracle_context.source?.label ?? memo.solana_oracle_context.network}
          </p>
          <span>{memo.solana_oracle_context.use}</span>
        </section>
      )}
      <p>{memo?.executive_summary ?? report.final_synthesis?.executive_summary ?? report.recommendation_contribution}</p>
      {memo?.investment_question && (
        <p className="intel-question"><strong>Investment Question:</strong> {memo.investment_question}</p>
      )}
      {report.portfolio_context && (
        <section className="portfolio-strip">
          {report.portfolio_context.map((holding) => (
            <span key={holding.holding}>{holding.holding} <strong>{holding.weight}%</strong></span>
          ))}
        </section>
      )}
      {memo?.supporting_specialist_agents && (
        <section className="agent-strip">
          {memo.supporting_specialist_agents.map((agent) => <span key={agent}>✓ {agent}</span>)}
        </section>
      )}
      <div className="intel-grid">
        <section>
          <h3>Key Evidence</h3>
          {list(report.key_evidence)}
        </section>
        <section>
          <h3>Bull Case</h3>
          {list(report.bullish_points)}
        </section>
        <section>
          <h3>Bear Case</h3>
          {list(report.bearish_points)}
        </section>
        <section>
          <h3>Risk Factors</h3>
          {list(report.risks)}
        </section>
      </div>
      {report.evidence_cards && (
        <section className="evidence-cards">
          {report.evidence_cards.map((card) => (
            <article key={card.category}>
              <div>
                <strong>{card.category}</strong>
                <span>{card.status} · {card.confidence}%</span>
              </div>
              <p>{card.explanation}</p>
            </article>
          ))}
        </section>
      )}
      <div className="case-grid">
        <p><strong>Bull:</strong> {memo?.bull_case ?? report.final_synthesis?.bull_case}</p>
        <p><strong>Base:</strong> {memo?.base_case ?? report.final_synthesis?.base_case}</p>
        <p><strong>Bear:</strong> {memo?.bear_case ?? report.final_synthesis?.bear_case}</p>
      </div>
      {memo?.portfolio_considerations && (
        <p className="intel-note"><strong>Portfolio Considerations:</strong> {memo.portfolio_considerations}</p>
      )}
      <p className="intel-rec">
        <strong>Recommendation:</strong> {memo?.recommendation ?? report.final_synthesis?.recommendation ?? 'HOLD'} ·
        confidence {memo?.confidence_score ?? report.final_synthesis?.confidence_score ?? report.confidence_score}/100
      </p>
      <p className="intel-note">{report.final_synthesis?.human_approval_reminder}</p>
      <p className="intel-note">{memo?.confidence_caveat ?? report.final_synthesis?.confidence_caveat}</p>
      {memo?.data_sources && (
        <p className="intel-note">
          <strong>Data sources:</strong> {memo.data_sources.map((source) => `${source.label} (${source.mode}, ${formatTime(source.timestamp)})`).join('; ')}
        </p>
      )}
      {observations.length > 0 && (
        <section className="provider-observability">
          <h3>Provider Observability</h3>
          <div className="provider-observability-grid">
            {observations.map((observation) => (
              <article key={`${observation.capability}-${observation.provider}-${observation.timestamp}`}>
                <div>
                  <strong>{observation.capability}</strong>
                  <em className={observation.mode === 'LIVE DATA' ? 'data-live' : 'data-demo'}>{observation.mode}</em>
                </div>
                <p>{observation.provider}</p>
                <span>
                  {observation.latencyMs}ms · {observation.fallbackUsed ? 'fallback used' : 'live path'} · {observation.cacheHit ? 'cache hit' : 'fresh read'}
                </span>
                {observation.error && <span className="provider-error">{observation.error}</span>}
              </article>
            ))}
          </div>
        </section>
      )}
      <p className="intel-note">{memo?.disclaimer ?? report.disclaimer}</p>
    </div>
  )
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : 'unavailable'
}

function formatPct(value: number | undefined): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'unavailable'
}

function formatTime(value: string | undefined): string {
  if (!value) return 'unknown time'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function renderItem(item: string | { source?: string; timestamp?: string; finding?: string }): string {
  if (typeof item === 'string') return item
  const prefix = item.source ? `${item.source}: ` : ''
  const suffix = item.timestamp ? ` (${formatTime(item.timestamp)})` : ''
  return `${prefix}${item.finding ?? 'Evidence item'}${suffix}`
}
