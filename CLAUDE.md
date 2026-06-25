# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A TypeScript-first monorepo for a Solana agent-economy starter kit. Agents request, pay, and settle on-chain automatically using Solana Pay. CoralOS coordinates multi-agent sessions. The stack is Node.js throughout — no Rust, no Cargo.

## Repo Layout

| Directory | Purpose |
|-----------|---------|
| `api-ts/` | Express REST API — the primary server (port 8081) |
| `sdk/agent-core-ts/` | TypeScript agent runtime: `AgentManager`, `Strategy`, `MessageBus`, `SharedState`, `WorkflowEngine`, Solana Pay strategies |
| `sdk/sdk/` | `CoralClient` — typed HTTP wrapper for `api-ts/` |
| `web/` | Next.js consumer marketplace — Phantom wallet payment flow (port 3000) |
| `coral-agents/` | Agents launched by CoralOS: `buyer-agent`, `seller-agent`, `echo-agent` (TypeScript); `user_proxy` (Python test puppet) |
| `docs/` | Design documents, CoralOS config, restructure plan |
| `e2e/` | Playwright end-to-end tests |

## Commands

### api-ts (primary server)

```sh
cd api-ts && npm install   # once
cd api-ts && npm run dev   # dev server on :8081 with hot reload
cd api-ts && npm test      # unit tests
cd api-ts && npm run typecheck
```

### sdk/agent-core-ts (agent runtime)

```sh
cd sdk/agent-core-ts && npm install
cd sdk/agent-core-ts && npm run typecheck
cd sdk/agent-core-ts && npm test
```

### web (Next.js)

```sh
cd web && npm install
cd web && npm run dev      # :3000, points at api-ts :8081 by default
cd web && npm run build
```

### coral-agents (TypeScript + one Python utility, requires Docker)

```sh
# TypeScript agents (built from repo root so they can bundle sdk/):
bash build-agents.sh seller   # seller-agent:0.1.0
bash build-agents.sh buyer    # buyer-agent:0.1.0
cd coral-agents/user_proxy && docker build -t user-proxy:0.1.0 .   # Python test puppet
# Then start CoralOS: docker compose --profile coral up
```

## Architecture

### sdk/agent-core-ts

The central TypeScript library. Key modules:

- **`agent.ts` / `AgentState`** — agent holds a pluggable `Strategy` and action log
- **`manager.ts` / `AgentManager`** — creates, stores, drives agents; owns `MessageBus`, `SharedState`, `WorkflowEngine`
- **`strategy.ts` / `BaseStrategy`** — `async run(state, signal)` + `handleMessage(text, state)` interface
- **`message_bus.ts`** — broadcast/direct messaging between agents
- **`shared_state.ts`** — versioned key-value store accessible to all agents
- **`workflow.ts`** — DAG of `WorkflowStep`s with dependency ordering
- **`coral_mcp.ts`** — MCP client for joining CoralOS sessions
- **`strategies/`** — `HeliusMonitorStrategy`, `TransferStrategy`, `PaymentStrategy`, `WeatherStrategy`, `IdleStrategy`

### api-ts

Express server exposing `sdk/agent-core-ts` over HTTP at `/api/v1/`:
- `/agents` — CRUD + start/stop/handle
- `/shared-state` — key-value read/write
- `/messages` — message bus
- `/weather` — demo paid endpoint

### web

Next.js 14 marketplace. Connects to `api-ts` via `NEXT_PUBLIC_CORAL_SERVER` (default `http://localhost:8081`).

### coral-agents (CoralOS)

`buyer-agent`, `seller-agent`, `echo-agent` — TypeScript agents (built on `sdk/agent-core-ts`).  
`user_proxy` — Python puppet agent; lets the Puppet API inject test messages into a CoralOS session.

(On-chain wallet monitoring lives in the TypeScript `HeliusMonitorStrategy` in `sdk/agent-core-ts`.)

## Key Constraints

- **`Strategy.run()` must respect the `AbortSignal`** — check `signal.aborted` in polling loops and return cleanly.
- **`AgentManager` is not thread-safe across Node.js workers** — keep it in the main process; use message passing if you need workers.
- **CoralOS requires Docker** — coral-agents are launched as Docker containers by the CoralOS server. Build images before running `--profile coral`.
- **Devnet only** — all Solana operations target devnet. Never use a funded mainnet keypair in `.env`.
