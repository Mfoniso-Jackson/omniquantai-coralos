# Build from repo root:
#   docker build -f coral-agents/broker/Dockerfile -t broker:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

# Mirror repo layout so "file:../../packages/agent-runtime" resolves correctly
COPY packages/agent-runtime/package.json packages/agent-runtime/package-lock.json* ./packages/agent-runtime/
RUN cd packages/agent-runtime && npm install --ignore-scripts
COPY packages/agent-runtime/tsconfig.json ./packages/agent-runtime/
COPY packages/agent-runtime/src/ ./packages/agent-runtime/src/
RUN cd packages/agent-runtime && npx tsc

# --install-links copies the SDK into node_modules instead of symlinking
COPY coral-agents/broker/package.json coral-agents/broker/package-lock.json* ./coral-agents/broker/
RUN cd coral-agents/broker && npm install --ignore-scripts --install-links
COPY coral-agents/broker/tsconfig.json ./coral-agents/broker/
COPY coral-agents/broker/src/ ./coral-agents/broker/src/
RUN cd coral-agents/broker && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/broker/dist ./dist
COPY --from=builder /app/coral-agents/broker/node_modules ./node_modules

CMD ["node", "dist/index.js"]
