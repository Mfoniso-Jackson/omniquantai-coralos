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
simulateManifest
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
oq simulate
oq set-status <agent-id> <status>
oq dev
oq test
oq package
oq publish
```

`oq simulate` runs a deterministic manifest-based market lifecycle without importing third-party code.
This is intentional: local simulation proves the manifest, bid, memo, and verification contract before
the platform executes external agent logic in a sandbox.

Signed registry writes use:

```bash
MARKETPLACE_API_URL=http://localhost:4000 \
MARKETPLACE_PUBLISHER_ID=<publisher-id> \
MARKETPLACE_API_TOKEN=<shared-hmac-secret> \
node packages/sdk/dist/cli.js register agent.json
```

Admin status transitions:

```bash
node packages/sdk/dist/cli.js set-status valuation-agent active
node packages/sdk/dist/cli.js set-status valuation-agent verified
node packages/sdk/dist/cli.js set-status valuation-agent suspended
```

Dev/test/package/publish are reserved as stable command names.

## Reference Agents

```text
sample-agents/valuation-agent/
sample-agents/macro-agent/
```

## Registry Smoke

```bash
npm run smoke:registry
```

The smoke check starts the marketplace feed API on a temporary port, registers both reference agents,
and verifies registry discovery by capability.

## Sandbox Simulation

```bash
npm run sandbox:simulate -- sample-agents/valuation-agent/agent.json
```

The Docker sandbox has no network, a read-only source mount, constrained CPU/memory/PIDs, no Linux
capabilities, and a scratch-only `/tmp`.
