# SDK Registry Proof Run

Date: 2026-07-17

This proof run covers the developer-platform slice:

- `oq simulate` produces a full local lifecycle from `agent.json`.
- Signed registry writes are accepted when the feed API is configured with `REGISTRY_AUTH_SECRET`.
- Registry admin transitions move agents through `pending -> active -> verified`.
- Registered SDK manifests are eligible for live market participation through the CoralOS marketplace launcher.
- The Docker sandbox command defines the first no-network/read-only execution boundary for SDK agent simulation.

## Commands

```bash
npm run build --prefix packages/sdk
node packages/sdk/dist/cli.js simulate sample-agents/valuation-agent/agent.json
npm run smoke:registry
npm run smoke:testnet
```

## Expected Evidence

`npm run smoke:registry` should print:

```text
registered and verified valuation-agent
registered and verified macro-agent
registered agents: 2
valuation discovery: valuation-agent
macro discovery: macro-agent
registry smoke passed
```

`npm run smoke:testnet` should confirm the repo remains in the devnet/testnet lane and that the market lifecycle smoke tests pass.

## Notes

This proof intentionally does not execute arbitrary third-party source code inside the host process.
Dynamic live participation maps verified registry manifests into constrained seller-agent containers until
the dedicated Docker/WASM/remote sandbox runner is production-ready.
