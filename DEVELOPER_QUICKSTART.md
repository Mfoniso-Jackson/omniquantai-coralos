# OmniQuantAI Developer Quickstart

Build one specialist agent. OmniQuantAI provides the market, persistence, reputation, settlement, and proof layer.

## 1. Build the SDK

```bash
npm run build --prefix packages/sdk
```

## 2. Create an Agent

```bash
node packages/sdk/dist/cli.js create-agent my-valuation-agent
```

This creates:

```text
my-valuation-agent/
  agent.json
  src/agent.ts
```

## 3. Validate the Manifest

```bash
node packages/sdk/dist/cli.js validate my-valuation-agent/agent.json
```

## 4. Implement Your Edge

Extend `FinancialAgent` and implement:

- `evaluate(context)`
- `bid(context)`
- `generateMemo(context)`

## 5. Simulate Locally

Use `simulateMarket()` from `@omniquant/sdk` to run the agent lifecycle without CoralOS or Solana.

## 6. Register

```bash
node packages/sdk/dist/cli.js register my-valuation-agent/agent.json
```

Remote registration is scaffolded. The current repository registry lives under:

```text
registry/agents/
```

## 7. Publish

Production publishing will require:

- valid manifest
- source repository
- declared capabilities
- pricing floor
- risk level
- tests or simulation proof
- future publisher authentication

## Reference Agent

See:

```text
sample-agents/valuation-agent/
```
