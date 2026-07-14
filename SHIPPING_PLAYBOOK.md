# Shipping Playbook

## Principle

Ship artifacts, not ideas. Every release should improve a runnable demo, a verifiable protocol path, or contributor clarity.

## Vertical Slice Rule

A milestone is shippable only when it includes:

- user or operator outcome
- source change
- test or smoke gate
- documentation update
- known limitation statement

## Release Gates

Current devnet/testnet lane:

```sh
npm run testnet-check
npm run smoke:testnet
```

Broader local gate:

```sh
npm run production-check
```

Future mainnet dry run:

```sh
npm run mainnet-readiness
```

Passing mainnet readiness only proves configuration, not launch safety.

## Weekly Rhythm

- Monday: choose one milestone.
- Tuesday-Wednesday: implement vertical slice.
- Thursday: verify, document, and record evidence.
- Friday: review decisions, risks, and user feedback.

## Evidence Requirements

For live demos, capture:

- session ID
- namespace
- buyer wallet funding state
- deposit Explorer link
- release Explorer link
- dashboard URL or screenshot
- command output for the release gate

## Changelog

Update `CHANGELOG.md` under `Unreleased` for user-facing, protocol, docs, or release-process changes.

## Incident Response

If the core flow breaks:

1. Stop feature work.
2. Reproduce with `npm run judge` or fixture mode.
3. Identify which link failed: buyer, CoralOS, feed, frontend, settlement.
4. Add a regression test or smoke check.
5. Document the failure and recovery.

