#!/usr/bin/env bash
# Build the two agent images coral-server launches for the CoralOS round (from repo root so they bundle
# packages/). Run once before `docker compose up` — only needed if you change the agents; the demo ships
# against the pre-built images.
#
# Usage: bash build-agents.sh           (build both)
#        bash build-agents.sh seller    (seller-agent only)
#        bash build-agents.sh buyer     (buyer-agent only)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

build_seller() {
  echo "==> Building seller-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/seller-agent/Dockerfile" -t seller-agent:0.1.0 "$ROOT"
  echo "    seller-agent:0.1.0 done (OmniQuantAI seller personas reuse this image)"
}

build_buyer() {
  echo "==> Building buyer-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/buyer-agent/Dockerfile" -t buyer-agent:0.1.0 "$ROOT"
  echo "    buyer-agent:0.1.0 done"
}

case "${1:-all}" in
  seller) build_seller ;;
  buyer)  build_buyer ;;
  all)
    build_seller
    build_buyer
    echo ""
    echo "Both agent images built. Run a CoralOS round:"
    echo "  docker compose up -d coral"
    echo "  npm run marketplace"
    ;;
  *) echo "Usage: bash build-agents.sh [seller|buyer|all]"; exit 1 ;;
esac
