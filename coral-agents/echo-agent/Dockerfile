# Build from repo root:
#   docker build -f coral-agents/echo-agent/Dockerfile -t echo-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

# Mirror repo layout so "file:../../sdk/agent-core-ts" resolves correctly
COPY sdk/agent-core-ts/package.json sdk/agent-core-ts/package-lock.json* ./sdk/agent-core-ts/
RUN cd sdk/agent-core-ts && npm install --ignore-scripts
COPY sdk/agent-core-ts/tsconfig.json ./sdk/agent-core-ts/
COPY sdk/agent-core-ts/src/ ./sdk/agent-core-ts/src/
RUN cd sdk/agent-core-ts && npx tsc

# --install-links copies the SDK into node_modules instead of symlinking
COPY coral-agents/echo-agent/package.json coral-agents/echo-agent/package-lock.json* ./coral-agents/echo-agent/
RUN cd coral-agents/echo-agent && npm install --ignore-scripts --install-links
COPY coral-agents/echo-agent/tsconfig.json ./coral-agents/echo-agent/
COPY coral-agents/echo-agent/src/ ./coral-agents/echo-agent/src/
RUN cd coral-agents/echo-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/echo-agent/dist ./dist
COPY --from=builder /app/coral-agents/echo-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
