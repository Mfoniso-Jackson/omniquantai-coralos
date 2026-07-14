# Agent Operating Instructions

This file is for Codex and other coding agents working on OmniQuantAI.

## Read First

1. `README.md`
2. `PRODUCTION.md`
3. `docs/mainnet-readiness.md`
4. `ARCHITECTURE.md`
5. `SHIPPING_PLAYBOOK.md`
6. The package `README.md` nearest the code you will edit.

If a file is missing or stale, say so and continue from source code.

## Core Lifecycle

Never break the market loop:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

Refund and failure states are allowed, but the happy path must remain demonstrable.

## Priority Order

1. Reliability
2. User clarity
3. Settlement proof
4. Intelligence quality
5. Persistence
6. Extensibility
7. Optional features

## Repository Rules

- Inspect before editing. Use `rg` and read nearby tests.
- Preserve CoralOS coordination and Solana devnet settlement.
- Do not make destructive git changes.
- Keep secrets out of git and out of frontend code.
- Do not hardcode Codespaces URLs.
- Prefer provider interfaces for external systems.
- Keep fallback behavior deterministic.
- Update docs when behavior, commands, APIs, or scope changes.

## Vertical Slice Rule

Ship one complete slice at a time:

1. Identify the user-visible or operator-visible outcome.
2. Make the smallest source change that supports it.
3. Add or update tests.
4. Update docs.
5. Run the narrowest meaningful verification.
6. Report what changed, what passed, and what remains.

## Testing Requirements

Use the smallest test set that protects the change. Common gates:

```sh
npm run smoke:testnet
npm run testnet-check
npm run mainnet-readiness
npm run typecheck
npm test
```

For buyer settlement changes, run buyer-agent typecheck and tests. For feed changes, run feed tests and `npm run smoke:testnet`.

## Definition Of Done

- The lifecycle still works or the affected phase is explicitly guarded by tests.
- No private keys, API keys, or wallet secrets were added.
- Docs match the actual code.
- The final answer names verification commands and limitations.
- Uncertainty is labeled clearly as `Current`, `Planned`, or `Future`.

