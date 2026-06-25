# coral-agents

Agents launched by CoralOS as Docker containers. They connect to a CoralOS
session over MCP (via `startCoralAgent` in `sdk/agent-core-ts`) and exchange
messages in the session thread.

| Agent | Language | Role |
|-------|----------|------|
| `seller-agent` | TypeScript | Sells data/services for SOL. Fork point: `src/service.ts` (`deliverService`). |
| `buyer-agent`  | TypeScript | LLM-driven buyer. Requests data, pays in SOL, analyses the result. |
| `echo-agent`   | TypeScript | Minimal smoke-test agent — echoes any `@mention`. Proves MCP connectivity. |
| `user_proxy`   | Python     | Inert puppet. Lets the Puppet API inject test messages into a session. |

The TypeScript agents build on `sdk/agent-core-ts` (the `Strategy` / `AgentManager`
runtime). On-chain wallet monitoring lives there too, as `HeliusMonitorStrategy`.

## Build the images

```sh
# from the repo root (context must include sdk/)
bash build-agents.sh seller     # seller-agent:0.1.0
bash build-agents.sh buyer      # buyer-agent:0.1.0
docker build -f coral-agents/echo-agent/Dockerfile -t echo-agent:0.1.0 .
cd coral-agents/user_proxy && docker build -t user-proxy:0.1.0 .
```

CoralOS discovers each agent from its `coral-agent.toml`. Start a session that
references them (see `docs/coral/session.json` for a minimal example), and CoralOS
launches the containers and injects each one's `CORAL_CONNECTION_URL`.
