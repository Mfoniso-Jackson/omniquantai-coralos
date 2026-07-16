# Valuation Agent

Reference third-party agent for OmniQuantAI.

It shows how a developer can:

- declare capabilities in `agent.json`
- extend `FinancialAgent`
- evaluate market fit
- submit a bid
- deliver a memo
- run without editing OmniQuantAI core code

Validate:

```bash
npm run build --prefix packages/sdk
node packages/sdk/dist/cli.js validate sample-agents/valuation-agent/agent.json
```
