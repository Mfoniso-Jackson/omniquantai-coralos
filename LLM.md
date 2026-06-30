# LLMs — what they do, and how to switch provider / keys

The kit is **provider-agnostic**. One shim — [`packages/agent-runtime/src/llm/complete.ts`](packages/agent-runtime/src/llm/complete.ts)
— makes a single `fetch` call (no vendor SDK) and supports **Anthropic** (default) and **OpenAI**. You
flip the whole demo between them with **env vars only — no code change**.

## Where the LLM is used

| Where | What it does | Falls back to |
|-------|--------------|---------------|
| **The read** — `analyzeEdge()` ([`agent/edge.ts`](examples/txodds/agent/edge.ts)) → `complete()` | turns the verified fair line into a one-line read + confidence | a **deterministic** read (favourite by probability) — so the demo never breaks |
| **The CoralOS round** — the seller's `edge` delivery ([`coral-agents/seller-agent`](coral-agents/seller-agent)) | the seller runs the same edge over MCP | a deterministic delivery |

If there's **no key (or the account is out of credits)**, the call throws and the code uses the
deterministic fallback. The web UI shows a **`deterministic`** badge instead of `LLM` so you can tell.

## The env vars

All live in the repo-root **`.env`** (gitignored — never committed). `.env.example` shows the empty fields.

| Var | Meaning |
|-----|---------|
| `ANTHROPIC_API_KEY` | Anthropic key (`sk-ant-…`). The default provider. |
| `OPENAI_API_KEY` | OpenAI key (`sk-…`). |
| `LLM_PROVIDER` | Force the provider: `anthropic` or `openai`. Optional. |
| `LLM_MODEL` | Override the model id. Optional (sensible per-provider default otherwise). |
| `TRACE` | `1` → log the chosen provider/model + the raw reply. |

## How the provider is chosen

[`pickProvider()`](packages/agent-runtime/src/llm/complete.ts) resolves it in this order:

1. **Explicit** — if `LLM_PROVIDER=openai` (or `anthropic`), use that.
2. **Auto-detect** — else if `OPENAI_API_KEY` is set, use **OpenAI**.
3. **Default** — else **Anthropic**.

Default models (override with `LLM_MODEL`): Anthropic `claude-haiku-4-5-20251001` · OpenAI `gpt-4o-mini`.

## Switch it — copy/paste

**Anthropic (default):**
```ini
ANTHROPIC_API_KEY=sk-ant-…
# LLM_PROVIDER / OPENAI_API_KEY unset
```

**OpenAI:**
```ini
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-…
```

**Pin a specific model:**
```ini
ANTHROPIC_API_KEY=sk-ant-…
LLM_MODEL=claude-opus-4-8
```

## Apply a change

Edit `.env`, then **restart** so it's re-read:

- **Web demo:** restart `npm run dev` (the proxy reads `.env` at startup).
- **CoralOS round:** just re-run `npm run coral` — `coral/round.ts` reads `.env` and passes the keys to
  the agents in the session request, so coral-server launches them with the new provider/key.

## "It says `deterministic`, not `LLM`"

The model didn't return. Almost always the key:

- not set / wrong key, or
- **out of credits** — Anthropic returns `400 … credit balance is too low`. Top up, swap the key, or
  switch to OpenAI (above). Then restart.

Run with `TRACE=1` in `.env` to see exactly which provider/model was used and the raw reply.

## Security

Keys live only in `.env` (gitignored). They are **never** committed, logged in full, or sent anywhere
but the provider's API. `.env.example` ships with empty fields; `setup.js` never writes an LLM key.
