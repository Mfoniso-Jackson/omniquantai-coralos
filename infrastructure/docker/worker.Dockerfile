FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY examples/marketplace/package.json examples/marketplace/package.json
RUN cd examples/marketplace && npm install
COPY examples/marketplace examples/marketplace
COPY coral-agents coral-agents
COPY packages packages

CMD ["node", "-e", "console.log('omniquant-worker boundary ready; wire BullMQ start_market consumer before production traffic')"]
