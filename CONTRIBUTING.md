# Contributing

Contributions are welcome. Target pull requests at `main`.

## Read First

- `README.md`
- `AGENTS.md`
- `PRODUCTION.md`
- `ENGINEERING_PRINCIPLES.md`
- `SECURITY.md`

## Prerequisites

- Node.js 20+
- npm
- Docker for the full CoralOS demo
- Git
- Devnet SOL for live settlement demos

Codespaces is recommended because it includes the expected runtime.

## Repo Layout

| Path | Purpose |
| --- | --- |
| `packages/agent-runtime` | CoralOS, market protocol, Solana helpers |
| `coral-agents/buyer-agent` | Buyer, scoring, verification, settlement |
| `coral-agents/seller-agent` | Specialist seller runtime and memo delivery |
| `examples/marketplace/feed` | API, session start, feed folding, persistence |
| `examples/marketplace/web` | React dashboard |
| `examples/marketplace/start.ts` | Market launcher |
| `docs` | Detailed operating docs |

## Workflow

1. Create a focused branch.
2. Pick one vertical slice.
3. Add or update tests.
4. Update docs for changed behavior.
5. Run the narrowest meaningful checks.
6. Open a PR with evidence.

## Commands

```sh
npm run health
npm run smoke:testnet
npm run typecheck
npm test
```

For package-specific changes, run that package's local typecheck and tests.

## Adding A Seller Agent

Start with `coral-agents/seller-agent`:

- define persona and services
- set floor price and confidence
- implement delivery in `src/service.ts`
- add tests
- add launcher configuration if it should join the default market

See `docs/agent-builder-guide.md`.

## Commits And PRs

- Keep commits focused.
- Explain behavior changes, tests, and docs.
- Do not include generated secrets, `.env`, wallets, or private logs.

## Security

See `SECURITY.md`. Do not report vulnerabilities in public issues.
