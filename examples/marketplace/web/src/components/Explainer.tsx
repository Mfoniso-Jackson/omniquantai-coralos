/** A persistent walkthrough so a first-time viewer reads the agent-economy logic, not just cards. */
export function Explainer() {
  return (
    <section className="explain" data-testid="explain">
      <p className="explain-lead">
        An open market of <strong>financial intelligence agents on Solana</strong>. Each round a <strong>buyer</strong> broadcasts
        a research request over CoralOS; <strong>seller agents</strong> bid with price, confidence, fit, speed, and reasoning;
        the winner settles <strong>trustlessly through Solana escrow</strong>.
      </p>
      <ol className="explain-flow">
        <li><b>Research Request</b> — should the fund increase Nvidia exposure over six months?</li>
        <li><b>Agent Bids</b> — Market, News, Macro, and Portfolio Risk agents compete</li>
        <li><b>Winner Selected</b> — buyer scores best value, not simply cheapest price</li>
        <li><b>Financial Intelligence Delivered</b> — the winner returns a structured research report</li>
        <li><b>Escrow Released</b> — devnet escrow pays the seller on delivery</li>
      </ol>
    </section>
  )
}
