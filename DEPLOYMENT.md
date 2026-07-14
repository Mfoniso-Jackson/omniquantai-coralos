# Deployment

This root document summarizes deployment. The detailed guide is `docs/deployment.md`.

## Current Recommended Path

Use GitHub Codespaces or a local Docker environment for the full live demo.

```sh
npm run bootstrap
npm run health
npm run judge
```

The full demo needs:

- CoralOS on port `5555`
- marketplace feed API on port `4000`
- React dashboard on port `5173`
- Docker-launched buyer and seller agents
- funded Solana devnet buyer wallet

## Codespaces

1. Open the repo in Codespaces.
2. Let bootstrap finish.
3. Fund the buyer wallet in `WALLETS.txt`.
4. Run `npm run judge`.
5. Open the forwarded port `5173` URL.

## Frontend Deployment

The frontend can be deployed as a static app from `examples/marketplace/web`, but Start Market requires a live API/feed service.

## API Deployment

The API/feed can run separately from `examples/marketplace/feed`. A live agent demo requires access to CoralOS and Docker-launched agents.

## Fixture Preview

For public previews where Docker is unavailable, use fixture mode to serve recorded feed data. Label it clearly as demo data.

## Rollback

If the live market fails, return to the last commit where `npm run smoke:testnet` passed and use the fixture dashboard for explanation while debugging.

