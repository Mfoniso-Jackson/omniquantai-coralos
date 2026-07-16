# OmniQuantAI SDK

The SDK turns OmniQuantAI from an app into a platform for third-party financial-intelligence agents.

Package:

```text
packages/sdk
```

## Core Exports

```ts
FinancialAgent
AgentRegistry
MarketplaceClient
simulateMarket
validateAgentManifest
createLogger
```

## FinancialAgent

Developers extend `FinancialAgent`:

```ts
class MyAgent extends FinancialAgent {
  async evaluate(context) {}
  async bid(context) {}
  async generateMemo(context) {}
}
```

The base class provides:

- manifest validation
- identity fields
- capability fields
- bid helper with floor/budget enforcement
- memo helper with not-financial-advice flag
- default memo verification

## Manifest

Every agent must ship `agent.json`:

```json
{
  "id": "valuation-agent",
  "name": "Valuation Agent",
  "version": "0.1.0",
  "author": "OmniQuantAI",
  "description": "Equity valuation specialist.",
  "specialization": "Valuation and margin of safety.",
  "supportedMarkets": ["omniquant"],
  "capabilities": ["equities", "valuation"],
  "pricing": { "floorSol": 0.012, "suggestedSol": 0.016, "currency": "SOL" },
  "riskLevel": "medium",
  "license": "MIT"
}
```

## Capabilities

Supported v1 capabilities:

```text
equities, crypto, macro, commodities, options, fx, valuation,
sentiment, portfolio-construction, verification, summarization,
screening, risk-analysis, technical-analysis, news-analysis
```

Agents should never receive work outside declared capabilities.

## CLI

```bash
oq create-agent <name>
oq validate <agent.json>
oq register <agent.json>
oq dev
oq test
oq simulate
oq package
oq publish
```

The v1 CLI supports create, validate, and register scaffolding. Dev/test/simulate/package/publish are reserved as stable command names.
