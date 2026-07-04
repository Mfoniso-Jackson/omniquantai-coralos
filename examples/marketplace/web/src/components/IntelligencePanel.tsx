interface IntelligenceReport {
  agent_name?: string
  request_understood?: string
  portfolio_context?: { holding: string; weight: number }[]
  evidence_cards?: { category: string; status: string; confidence: number; explanation: string }[]
  key_evidence?: string[]
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
    human_approval_reminder?: string
  }
  investment_committee_memo?: {
    title?: string
    company?: string
    investment_question?: string
    supporting_specialist_agents?: string[]
    recommendation?: string
    confidence_score?: number
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

const list = (items: string[] | undefined) => (
  <ul>{(items ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
)

export function IntelligencePanel({ report }: { report: IntelligenceReport }) {
  const memo = report.investment_committee_memo
  return (
    <div className="intel-panel" data-testid="intel-report">
      <div className="intel-head">{memo?.title ?? 'Financial Intelligence Delivered'} · {report.agent_name}</div>
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
      <p className="intel-note">{memo?.disclaimer ?? report.disclaimer}</p>
    </div>
  )
}
