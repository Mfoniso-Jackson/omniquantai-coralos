interface IntelligenceReport {
  agent_name?: string
  request_understood?: string
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
    human_approval_reminder?: string
  }
}

const list = (items: string[] | undefined) => (
  <ul>{(items ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
)

export function IntelligencePanel({ report }: { report: IntelligenceReport }) {
  return (
    <div className="intel-panel" data-testid="intel-report">
      <div className="intel-head">Financial Intelligence Delivered · {report.agent_name}</div>
      <p>{report.final_synthesis?.executive_summary ?? report.recommendation_contribution}</p>
      <div className="intel-grid">
        <section>
          <h3>Key Evidence</h3>
          {list(report.key_evidence)}
        </section>
        <section>
          <h3>Bullish Points</h3>
          {list(report.bullish_points)}
        </section>
        <section>
          <h3>Bearish Points</h3>
          {list(report.bearish_points)}
        </section>
        <section>
          <h3>Risks</h3>
          {list(report.risks)}
        </section>
      </div>
      <p className="intel-rec">
        <strong>Final Investment Thesis:</strong> {report.final_synthesis?.recommendation ?? 'HOLD'} ·
        confidence {report.final_synthesis?.confidence_score ?? report.confidence_score}/100
      </p>
      <p className="intel-note">{report.final_synthesis?.human_approval_reminder}</p>
      <p className="intel-note">{report.disclaimer}</p>
    </div>
  )
}
