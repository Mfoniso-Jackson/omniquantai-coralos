#!/usr/bin/env node
// The no-`just`, no-`bash` one-command demo. Run the entire World Cup marketplace and open the
// dashboard with nothing but Node + Docker:
//
//   node scripts/demo.js          (or: npm run dev)
//
// Same chain as `just dev`: fresh coral -> wallets -> build images -> clean -> coral up ->
// mint a TxLINE token -> open the dashboard. The mint step is fault-tolerant: if TxLINE or funding
// is unavailable, the dashboard still opens for the generic market.

import { spawnSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Fail fast with a clear message on an unsupported Node (the kit targets Node 20+).
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 20) {
  console.error(`[demo] Node ${process.version} detected — this kit needs Node 20+. Install it from nodejs.org, then re-run.`)
  process.exit(1)
}

/** Run a command to completion, streaming its output. Returns true on success. */
function run(cmd, args, cwd = root) {
  console.log(`\n\x1b[36m$ ${cmd} ${args.join(' ')}\x1b[0m`)
  return spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true }).status === 0
}

// 0. Docker must be running — the whole market is containers.
if (!run('docker', ['version', '--format', '{{.Server.Version}}'])) {
  console.error('\n[demo] Docker is not running. Start Docker Desktop, then re-run `node scripts/demo.js`.')
  process.exit(1)
}

// 1. Fresh coral so it re-scans /agents and registers the seller-worldcup persona.
run('docker', ['compose', 'down'])

// 2. Devnet wallets (idempotent — re-reads if .env already has them).
run('npm', ['install', '--no-audit', '--no-fund'], join(root, 'scripts'))
run('node', ['scripts/setup.js'])

// 3. Build the agent images directly (no bash) — repo root is the build context so they bundle packages/.
run('docker', ['build', '-f', 'coral-agents/seller-agent/Dockerfile', '-t', 'seller-agent:0.1.0', '.'])
run('docker', ['build', '-f', 'coral-agents/buyer-agent/Dockerfile', '-t', 'buyer-agent:0.1.0', '.'])
// Optional broker (swarm extension) — build it too when .env opts in (node scripts/setup.js --broker).
const envFile = join(root, '.env')
if (existsSync(envFile) && /^ENABLE_BROKER=1$/m.test(readFileSync(envFile, 'utf8'))) {
  run('docker', ['build', '-f', 'coral-agents/broker/Dockerfile', '-t', 'broker:0.1.0', '.'])
}

// 4. Remove orphaned agent containers from earlier sessions.
run('node', ['scripts/clean.js'])

// 5. Start coral-server (the MCP coordinator).
run('docker', ['compose', 'up', '-d', 'coral'])

// 6. Mint a fresh TxLINE token into .env (fault-tolerant — the demo still opens without it).
const tx = join(root, 'examples', 'txodds')
const minted = run('npm', ['install', '--no-audit', '--no-fund'], tx) && run('npm', ['run', 'mint'], tx)
if (!minted) {
  console.warn('\n[demo] TxLINE mint skipped/failed — the dashboard will open for the generic market.')
  console.warn('[demo] (needs a funded devnet buyer wallet + TxLINE reachable; see examples/txodds.)')
  // Strip any stale txline keys a previous successful mint left in .env, so the fallback is a CLEAN
  // generic market: no expired TXLINE_API_KEY (→ no seller-worldcup launched), and BUYER_SERVICE
  // reverts to start.ts's default instead of broadcasting txline WANTs no one can fill. (F8)
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    const stale = ['TXLINE_API_KEY', 'BUYER_SERVICE', 'BUYER_ARG', 'BUYER_ARGS']
    const cleaned = readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((line) => !stale.some((k) => line.startsWith(`${k}=`)))
      .join('\n')
    writeFileSync(envPath, cleaned)
    console.warn('[demo] cleared stale txline keys from .env → clean generic market.')
  }
}

// 7. Open the dashboard (feed + Vite UI + browser). Blocks here until you stop it (Ctrl+C).
console.log('\n[demo] Opening the dashboard — click "Start a market" when it loads.\n')
spawnSync('node', ['scripts/dashboard.js'], { cwd: root, stdio: 'inherit', shell: true })
