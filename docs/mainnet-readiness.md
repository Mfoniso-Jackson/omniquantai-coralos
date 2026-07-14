# OmniQuantAI Mainnet Readiness

## Current Release Lane

OmniQuantAI should finish the current release on Solana devnet. In this repo, devnet is the practical testnet lane because the escrow and arbiter programs are already deployed there and the full CoralOS agent market can settle safely with non-production SOL.

Use:

```sh
npm run testnet-check
npm run production-check
npm run judge
```

The current release is ready when:

- Start Market creates a session without manual session paste
- buyer broadcasts `WANT`
- four seller agents bid
- buyer awards best value
- winner delivers the investment committee memo
- verification passes
- devnet escrow deposit/release links appear
- no private keys are committed

## Mainnet Is Not A Config Flip

Mainnet is not enabled by changing `SOLANA_RPC_URL` alone.

Before mainnet, OmniQuantAI needs:

- audited or explicitly reviewed escrow program
- audited or explicitly reviewed arbiter program
- mainnet deployments with new program IDs
- key custody plan
- capped order sizes
- operator runbook
- incident response plan
- legal/compliance review
- no financial-advice or trading execution claims

## Readiness Gate

Run:

```sh
npm run mainnet-readiness
```

The command intentionally fails until all mainnet gates are configured:

- `SOLANA_NETWORK=mainnet`
- `SOLANA_RPC_URL` points to mainnet
- `ALLOW_MAINNET=1`
- `MAINNET_ESCROW_PROGRAM_ID` is set and differs from the devnet program
- `MAINNET_ARBITER_PROGRAM_ID` is set and differs from the devnet program
- `MAX_MAINNET_ORDER_SOL` is tiny and capped
- `MAINNET_RISK_ACK=I_UNDERSTAND_MAINNET_RISK`

Passing this check does not mean “safe to launch.” It only means the repo is configured for a controlled dry run.

## Mainnet Preparation Sequence

1. **Freeze devnet release**

   Confirm the full devnet loop works and tag the release.

2. **Review settlement contracts**

   Review escrow and arbiter behavior, especially:

   - initialization
   - release
   - refund
   - signer permissions
   - PDA seeds
   - close behavior
   - amount math

3. **Deploy mainnet programs**

   Deploy fresh escrow and arbiter programs to mainnet. Do not reuse devnet program IDs.

4. **Extend settlement provider abstraction**

   The buyer now routes settlement through `coral-agents/buyer-agent/src/settlement.ts`.
   Before mainnet, extend that boundary with the remaining production controls:

   - mainnet-specific provider implementation
   - explicit `getStatus` confirmation checks
   - refund path exposed through the provider
   - capped order-size enforcement at the provider boundary
   - mainnet Explorer URL generation

   Keep the Solana devnet provider as the default and add `SolanaMainnetSettlementProvider` only after deployment.

5. **Separate key custody**

   Never use generated demo wallets on mainnet. Mainnet keys should live in dedicated secret storage, not `.env` committed artifacts or frontend-visible config.

6. **Enable tiny dry run**

   Use a capped amount such as `0.001 SOL`. Confirm:

   - deposit
   - delivery
   - verification
   - release
   - Explorer proof
   - persistence
   - failure handling

7. **Expand only after review**

   Increase caps only after multiple successful dry runs, monitoring, and incident procedures are in place.

## Mainnet Non-Negotiables

- No live trading.
- No token sale mechanics.
- No promises of yield, revenue rights, ownership, or investment returns.
- No mainnet keys in frontend code.
- No uncapped settlement amounts.
- No paid API dependency that can break the core demo.
- No mainnet release without a rollback and incident plan.

## Current Blockers

The current codebase is intentionally not mainnet-ready:

- runtime guard rejects mainnet unless explicitly overridden
- escrow program ID is the devnet deployment
- arbiter program ID is the devnet deployment
- Explorer links use `cluster=devnet`
- docs and UI describe devnet settlement
- generated wallets are devnet demo wallets

That is correct for the current release. Mainnet should be a separate, deliberate milestone.
