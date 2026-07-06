#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN="✓"
YELLOW="⚠"
RED="✗"
FAILS=0
WARNS=0

pass() { printf "%s %s\n" "$GREEN" "$1"; }
warn() { printf "%s %s\n" "$YELLOW" "$1"; WARNS=$((WARNS + 1)); }
fail() { printf "%s %s\n" "$RED" "$1"; FAILS=$((FAILS + 1)); }

env_value() {
  local key="$1"
  if [ -f ".env" ]; then
    sed -n "s/^${key}=//p" .env | tail -n 1
  fi
}

port_check() {
  local port="$1"
  local label="$2"
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port $port ($label) is already in use. Stop the existing process if the demo cannot bind."
  else
    pass "Port $port ($label) is available or already managed by the demo"
  fi
}

printf "\nOmniQuantAI health check\n"
printf "Financial Intelligence Network\n\n"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$NODE_MAJOR" -ge 20 ]; then pass "Node $(node --version)"; else fail "Node 20+ required. Found $(node --version)."; fi
else
  fail "node not found. Use Codespaces or install Node 20+."
fi

if command -v npm >/dev/null 2>&1; then pass "npm $(npm --version)"; else fail "npm not found."; fi
if command -v git >/dev/null 2>&1; then pass "git found"; else fail "git not found."; fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then pass "Docker daemon running"; else fail "Docker installed but daemon is not running."; fi
else
  fail "docker not found."
fi

if docker compose config >/dev/null 2>&1; then pass "Docker Compose config valid"; else fail "Docker Compose config failed."; fi

if command -v solana >/dev/null 2>&1; then pass "Solana CLI $(solana --version)"; else warn "Solana CLI not found. Optional for this demo."; fi

if [ -f ".env" ]; then
  pass ".env exists"
else
  fail ".env missing. Run npm run bootstrap."
fi

BUYER_KEYPAIR_B58="$(env_value BUYER_KEYPAIR_B58)"
SELLER_KEYPAIR_B58="$(env_value SELLER_KEYPAIR_B58)"
ARBITER_KEYPAIR_B58="$(env_value ARBITER_KEYPAIR_B58)"
SELLER_WALLET="$(env_value WALLET)"
RPC_URL="$(env_value SOLANA_RPC_URL)"

if [ -n "$BUYER_KEYPAIR_B58" ]; then pass "Buyer wallet key exists"; else fail "BUYER_KEYPAIR_B58 missing. Run npm run bootstrap."; fi
if [ -n "$SELLER_KEYPAIR_B58" ]; then pass "Seller wallet key exists"; else fail "SELLER_KEYPAIR_B58 missing. Run npm run bootstrap."; fi
if [ -n "$ARBITER_KEYPAIR_B58" ]; then pass "Arbiter wallet key exists"; else fail "ARBITER_KEYPAIR_B58 missing. Run npm run bootstrap."; fi
if [ -n "$SELLER_WALLET" ]; then pass "Seller payout wallet exists"; else fail "WALLET missing. Run npm run bootstrap."; fi
if [ -f "WALLETS.txt" ]; then pass "WALLETS.txt exists"; else warn "WALLETS.txt missing. Run node scripts/setup.js to regenerate the address summary."; fi

if [ -n "$(env_value VENICE_API_KEY)" ] || [ -n "$(env_value OPENAI_API_KEY)" ] || [ -n "$(env_value ANTHROPIC_API_KEY)" ]; then
  pass "LLM provider key configured"
else
  warn "No LLM key found. The OmniQuantAI report is deterministic, but live bid reasoning may be limited."
fi

if [ -d "packages/agent-runtime/node_modules" ]; then pass "Runtime dependencies installed"; else fail "Missing packages/agent-runtime/node_modules. Run npm run bootstrap."; fi
if [ -d "examples/marketplace/feed/node_modules" ]; then pass "Feed dependencies installed"; else fail "Missing feed dependencies. Run npm run bootstrap."; fi
if [ -d "examples/marketplace/web/node_modules" ]; then pass "Web dependencies installed"; else fail "Missing web dependencies. Run npm run bootstrap."; fi

port_check 4000 "API/feed"
port_check 5173 "dashboard"
port_check 5555 "CoralOS"

if [ "${SKIP_SOLANA_BALANCE:-0}" = "1" ]; then
  warn "Skipping devnet balance check because SKIP_SOLANA_BALANCE=1."
elif [ -n "$BUYER_KEYPAIR_B58" ] && [ -d "scripts/node_modules" ]; then
  BALANCE_OUTPUT="$(node scripts/check-balance.mjs 2>/dev/null)"
  BALANCE_STATUS=$?
  if [ "$BALANCE_STATUS" -eq 0 ]; then
    pass "$BALANCE_OUTPUT"
  else
    fail "$BALANCE_OUTPUT"
  fi
else
  warn "Could not check buyer balance yet. Run npm run bootstrap, then fund the buyer wallet."
fi

printf "\n"
if [ "$FAILS" -eq 0 ]; then
  printf "%s PASS: OmniQuantAI environment is ready" "$GREEN"
  if [ "$WARNS" -gt 0 ]; then printf " with %s warning(s)" "$WARNS"; fi
  printf ".\n"
  exit 0
else
  printf "%s FAIL: %s issue(s) need attention before judge mode.\n" "$RED" "$FAILS"
  printf "Fix the items marked %s, then run npm run health again.\n" "$RED"
  exit 1
fi
