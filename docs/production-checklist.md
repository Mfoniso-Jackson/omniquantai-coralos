# Production Checklist

## Code

- TypeScript passes.
- No unrelated refactors.
- Core lifecycle still works.
- Provider failures have fallback behavior.

## Tests

- Package tests pass for touched code.
- `npm run smoke:testnet` passes.
- `npm run testnet-check` passes.

## Security

- No secrets committed.
- No private keys in frontend.
- Mainnet guard remains active.
- Settlement amount is controlled.

## Docs

- README reflects current behavior.
- Changelog updated.
- API docs match actual endpoints.
- Known limitations are stated.

## Deployment

- Codespaces path works.
- Ports `5173`, `4000`, and `5555` are documented.
- API health endpoint responds.
- Rollback path is known.

## Wallet

- Buyer wallet is funded on devnet.
- Seller wallet is payout-only.
- Arbiter key is present for arbiter mode.

## Data Providers

- Missing keys do not break demo.
- Live/fallback labels are visible.
- Source timestamps are included where available.

## Session Lifecycle

- Start Market creates session.
- Dashboard URL updates with session.
- Feed returns events for the session.
- Diagnostics show last event and count.

## CoralOS

- Container is healthy.
- Buyer and seller agents join the expected namespace.
- Messages appear in the session thread.

## Settlement

- Deposit appears.
- Release appears.
- Explorer links open.
- Failed verification does not release funds.

## Demo

- Full demo can be explained in under three minutes.
- Failure recovery plan is ready.
- Fixture fallback is labeled if used.

## Known Limitations

- Devnet only.
- Not financial advice.
- No live trading.
- File-backed persistence.
- Mainnet requires separate review.

