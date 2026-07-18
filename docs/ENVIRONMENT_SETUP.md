# Environment Setup

## Local

```ini
OMNIQUANT_ENV=local
PUBLIC_WEB_URL=http://localhost:5173
PUBLIC_API_URL=http://localhost:4000
CORAL_SERVER_URL=http://localhost:5555
CORAL_TOKEN=dev
CORAL_NAMESPACE=omniquant
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
OMNIQUANT_DATA_DIR=.omniquant-data
```

## Staging

```ini
OMNIQUANT_ENV=staging
PUBLIC_WEB_URL=https://staging.omniquantai.com
PUBLIC_API_URL=https://staging-api.omniquantai.com
SOLANA_NETWORK=devnet
```

Staging must use separate wallets and service-role keys.

## Production

```ini
OMNIQUANT_ENV=production
PUBLIC_WEB_URL=https://omniquantai.com
PUBLIC_APP_URL=https://app.omniquantai.com
PUBLIC_API_URL=https://api.omniquantai.com
SOLANA_NETWORK=devnet
```

Mainnet remains blocked until `npm run mainnet-readiness` passes and a separate settlement/security
review is complete.

## Secret Rules

- Never commit `.env`.
- Never expose private keys through `VITE_*`.
- Store Railway secrets in Railway.
- Store Vercel public-only environment variables in Vercel.
- Rotate wallet keys after public demos if they were used in shared environments.
