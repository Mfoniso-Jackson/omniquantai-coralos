# Macro Regime Agent

Reference OmniQuantAI SDK agent focused on macro regime risk.

It demonstrates how a third-party specialist can declare:

- macro and equity capabilities
- Solana-denominated pricing
- risk level
- required data categories
- a structured memo output

Validate the manifest:

```bash
npm run build --prefix packages/sdk
node packages/sdk/dist/cli.js validate sample-agents/macro-agent/agent.json
```

Register with a running marketplace feed API:

```bash
MARKETPLACE_API_URL=http://localhost:4000 node packages/sdk/dist/cli.js register sample-agents/macro-agent/agent.json
```
