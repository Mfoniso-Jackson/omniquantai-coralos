#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN="✓"
YELLOW="⚠"
RED="✗"

log() { printf "%s %s\n" "$GREEN" "$1"; }
warn() { printf "%s %s\n" "$YELLOW" "$1"; }
fail() { printf "%s %s\n" "$RED" "$1"; exit 1; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is required. In Codespaces, rebuild the container. Locally, install $2."
  fi
}

npm_install() {
  local dir="$1"
  if [ -f "$dir/package.json" ]; then
    log "Installing npm dependencies in $dir"
    npm install --prefix "$dir" --no-audit --no-fund
  fi
}

printf "\nOmniQuantAI bootstrap\n"
printf "Financial Intelligence Network\n\n"

need_cmd node "Node.js 20+"
need_cmd npm "npm"
need_cmd git "Git"
need_cmd docker "Docker Desktop or Docker Engine"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node 20+ is required. Found $(node --version)."
fi
log "Node $(node --version) and npm $(npm --version) detected"

if docker info >/dev/null 2>&1; then
  log "Docker daemon is running"
else
  fail "Docker is installed but not running. Start Docker, then run npm run bootstrap again."
fi

if command -v solana >/dev/null 2>&1; then
  log "Solana CLI detected: $(solana --version)"
else
  warn "Solana CLI not found. The demo uses @solana/web3.js directly, so this is optional."
  warn 'Install later if needed: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"'
fi

npm_install "scripts"
npm_install "packages/agent-runtime"
npm_install "packages/sdk"
npm_install "coral-agents/buyer-agent"
npm_install "coral-agents/seller-agent"
npm_install "examples/marketplace"
npm_install "examples/marketplace/feed"
npm_install "examples/marketplace/web"

if [ ! -d "packages/agent-runtime/dist" ]; then
  log "Building @pay/agent-runtime"
  npm run build --prefix packages/agent-runtime
fi

if [ ! -d "packages/sdk/dist" ]; then
  log "Building @omniquant/sdk"
  npm run build --prefix packages/sdk
fi

log "Ensuring .env has all demo wallets"
node scripts/setup.js

mkdir -p docs outputs

if [ -f "WALLETS.txt" ]; then
  log "Wallet summary exists at WALLETS.txt"
else
  warn "WALLETS.txt is missing. Run node scripts/setup.js to regenerate the wallet summary."
fi

if docker compose config >/dev/null 2>&1; then
  log "Docker Compose configuration is valid"
else
  fail "docker-compose.yml is not valid. Run docker compose config for details."
fi

printf "\n%s Bootstrap complete\n" "$GREEN"
printf "Next:\n"
printf "  1. Fund the buyer wallet in WALLETS.txt at https://faucet.solana.com\n"
printf "  2. Optional: add VENICE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to .env\n"
printf "  3. Run npm run judge\n\n"
