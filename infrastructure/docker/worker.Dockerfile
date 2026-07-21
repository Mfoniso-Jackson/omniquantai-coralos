FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY examples/marketplace/package.json examples/marketplace/package.json
COPY examples/marketplace/feed/package.json examples/marketplace/feed/package.json
RUN cd packages/agent-runtime && npm install
RUN cd packages/sdk && npm install
RUN cd examples/marketplace && npm install
RUN cd examples/marketplace/feed && npm install
COPY examples/marketplace examples/marketplace
COPY coral-agents coral-agents
COPY packages packages
RUN cd packages/agent-runtime && npm run build
RUN cd packages/sdk && npm run build
RUN cd examples/marketplace/feed && npm run typecheck

CMD ["npm", "run", "worker", "--prefix", "examples/marketplace/feed"]
