# Execution Playbook

## North Star

OmniQuantAI proves that financial intelligence can become a market: specialist agents compete, deliver useful work, and earn through verifiable on-chain settlement.

## Prioritization Framework

Score work by:

- reliability impact
- demo clarity
- settlement proof
- intelligence quality
- persistence value
- implementation effort
- risk of breaking the core flow

## Impact Versus Effort

Do first:

- fixes that unblock the lifecycle
- clearer proof of settlement
- smoke tests that prevent regressions
- docs that reduce operator confusion

Defer:

- new chains
- broad finance features
- token mechanics
- live trading
- complex reputation math before outcome data exists

## Milestone Planning

Each milestone needs:

- objective
- files likely to change
- verification plan
- rollback plan
- docs touched

## Blocking Issue Policy

If blocked, isolate the failing layer:

```text
frontend -> feed API -> CoralOS -> buyer -> sellers -> settlement
```

Fix the smallest broken link.

## When To Simplify

Simplify when a feature makes the demo harder to explain, harder to run, or harder to verify.

## Daily Checklist

- Is `main` clean before starting?
- What is the one slice?
- Which lifecycle stage can break?
- Which test proves it?
- Which doc must change?

## Weekly Review

Review:

- shipped artifacts
- failed assumptions
- live demo evidence
- customer or judge feedback
- next highest-risk milestone

