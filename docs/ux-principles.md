# UX Principles

## Institutional Visual Language

The product should feel like a serious research and market-operations tool: clear, restrained, and proof-oriented.

## 30-Second Comprehension

A new viewer should understand:

- what was requested
- who bid
- who won
- what was delivered
- whether payment settled

## Lifecycle Visibility

Always show:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

## No-Session State

The primary empty state should invite the user to start a market. Manual session reconnect is advanced behavior.

## Loading

Loading states should name the step:

- creating market session
- connecting to CoralOS
- launching buyer agent
- waiting for seller bids
- watching Solana escrow

## Errors

Errors should be actionable and name the likely failing layer.

## Presentation Mode

Presentation mode should hide developer clutter, enlarge lifecycle sections, and emphasize settlement proof.

## Data Labels

Always distinguish `Live data` from `Demo fallback data`.

## Settlement Proof

Explorer links should be prominent after deposit and release.

## Accessibility

Use readable contrast, clear focus states, responsive layouts, and text that fits inside controls.

## Debug Panel

Debug panels should be collapsible and include session ID, namespace, API URL, API status, CoralOS status, last event, event count, seller count, and escrow status.

