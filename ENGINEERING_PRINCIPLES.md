# Engineering Principles

## Simplicity

Prefer small, explicit modules over clever abstractions. The lifecycle must stay easy to trace.

## Composition

Use provider boundaries for external systems: settlement, data, LLMs, and future graph storage.

## Strong Typing

Keep protocol parsing and round folding typed. Avoid unstructured string manipulation where shared helpers exist.

## Explicit State

Market state should be visible as events and folded rounds. Hidden side effects make demos fragile.

## Deterministic Fallback

External API failure must not break the demo. Fallback data must be labeled and repeatable.

## Error Handling

Errors should explain:

- what happened
- likely cause
- suggested fix

Avoid generic `Failed to fetch` style messages.

## Observability

Log session ID, namespace, event counts, last event type, buyer status, seller bid count, and escrow status.

## Security

Private keys and provider API keys stay server-side. Frontend code must never receive secrets.

## Testability

Core protocol behavior should be testable offline with fixtures. Live Solana behavior should be covered by controlled smoke runs.

## Performance

Keep dashboard polling and feed folding lightweight. Do not add expensive live provider calls to the critical demo path without caching and fallback.

## Accessibility

The dashboard should remain readable, keyboard navigable, and clear in presentation mode.

## Non-Negotiables

- no secret leakage
- no hardcoded Codespaces URLs
- no silent settlement failures
- no unsupported financial-advice claims

