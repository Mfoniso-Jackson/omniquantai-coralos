FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json ./
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY examples/marketplace/feed/package.json examples/marketplace/feed/package.json
RUN cd packages/agent-runtime && npm install
RUN cd packages/sdk && npm install
RUN cd examples/marketplace/feed && npm install

COPY packages/agent-runtime packages/agent-runtime
COPY packages/sdk packages/sdk
COPY examples/marketplace/feed examples/marketplace/feed
RUN cd packages/agent-runtime && npm run build
RUN cd packages/sdk && npm run build
RUN cd examples/marketplace/feed && npm run typecheck

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 4000
CMD ["npm", "run", "start", "--prefix", "examples/marketplace/feed"]
