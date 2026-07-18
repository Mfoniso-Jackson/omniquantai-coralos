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

Until API hosting is solved, deploy `omniquantai.com` in proof mode:

- GitHub Pages hosts the static frontend.
- The site links to the latest proof video/release and Solana Explorer transactions.
- Start Market remains disabled unless `VITE_API_BASE_URL` points to a reachable feed API.
- Live demos run from Codespaces or local Docker using forwarded ports.

## API Deployment

The API/feed can run separately from `examples/marketplace/feed`. A live agent demo requires access to CoralOS and Docker-launched agents.

Free current path:

1. Keep public frontend on GitHub Pages.
2. Use Codespaces for live demos.
3. Forward ports `5173`, `4000`, and `5555`.
4. Set `REGISTRY_AUTH_SECRET` for signed registry writes when sharing a live API.
5. For local admin UI controls only, build the dashboard with `VITE_REGISTRY_ADMIN_TOKEN` and
   `VITE_REGISTRY_PUBLISHER_ID`. Do not expose these in the public proof-mode site.

Production path:

- Docker-capable host for feed API, CoralOS, and agent containers.
- Persistent volume for `.omniquant-data`.
- Non-mainnet guard enabled by default until mainnet readiness is complete.
- Separate signing secrets for publishers/admins.

## Fixture Preview

For public previews where Docker is unavailable, use fixture mode to serve recorded feed data. Label it clearly as demo data.

## Rollback

If the live market fails, return to the last commit where `npm run smoke:testnet` passed and use the fixture dashboard for explanation while debugging.
