#!/usr/bin/env bash
# Build all Docker images from repo root (context must include sdk/).
# Run this once before docker compose up for any track.
#
# Usage: bash build-agents.sh            (build all)
#        bash build-agents.sh seller     (seller-agent only)
#        bash build-agents.sh api        (api-ts only)
#        bash build-agents.sh web        (web only)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

build_seller() {
  echo "==> Building seller-agent:0.1.0"
  docker build \
    -f "$ROOT/coral-agents/seller-agent/Dockerfile" \
    -t seller-agent:0.1.0 \
    "$ROOT"
  echo "    seller-agent:0.1.0 done"
}

build_buyer() {
  echo "==> Building buyer-agent:0.1.0"
  docker build \
    -f "$ROOT/coral-agents/buyer-agent/Dockerfile" \
    -t buyer-agent:0.1.0 \
    "$ROOT"
  echo "    buyer-agent:0.1.0 done"
}

build_proxy() {
  echo "==> Building user-proxy:0.1.0"
  docker build \
    -f "$ROOT/coral-agents/user_proxy/Dockerfile" \
    -t user-proxy:0.1.0 \
    "$ROOT/coral-agents/user_proxy"
  echo "    user-proxy:0.1.0 done"
}

build_api() {
  echo "==> Building api-ts:latest"
  docker build \
    -f "$ROOT/api-ts/Dockerfile" \
    -t api-ts:latest \
    "$ROOT"
  echo "    api-ts:latest done"
}

build_web() {
  echo "==> Building web:latest"
  docker build \
    -f "$ROOT/web/Dockerfile" \
    -t web:latest \
    "$ROOT"
  echo "    web:latest done"
}

case "${1:-all}" in
  seller) build_seller ;;
  buyer)  build_buyer ;;
  proxy)  build_proxy ;;
  api)    build_api ;;
  web)    build_web ;;
  all)
    build_seller
    build_buyer
    build_proxy
    build_api
    build_web
    echo ""
    echo "All images built. Run a track:"
    echo "  docker compose -f examples/track-1-pay-per-call/docker-compose.yml up"
    ;;
  *) echo "Usage: bash build-agents.sh [seller|buyer|proxy|api|web|all]"; exit 1 ;;
esac
