#!/usr/bin/env node
// One-command local judge demo for OmniQuantAI.
//
// Starts CoralOS, builds the agent images, starts the marketplace feed + dashboard,
// then launches one OmniQuantAI market round and prints the presentation URL.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const children = new Set()
const EXPECTED_FEED_BUILD = 'feed-readable-session-v2'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hasCmd = (cmd) => spawnSync(cmd, ['--version'], { shell: true, stdio: 'ignore' }).status === 0
const packageManager = hasCmd('npm') ? 'npm' : (hasCmd('pnpm') ? 'pnpm' : '')

function packageArgs(args) {
  if (packageManager === 'pnpm' && args[0] === 'install') {
    return ['install', '--ignore-scripts', '--no-frozen-lockfile']
  }
  return args
}

function run(label, cmd, args, opts = {}) {
  console.log(`\n[demo] ${label}`)
  const res = spawnSync(cmd, args, { cwd: root, shell: true, stdio: 'inherit', ...opts })
  if (res.status !== 0) {
    console.error(`[demo] ${label} failed with exit code ${res.status}`)
    process.exit(res.status ?? 1)
  }
}

function runOptional(label, cmd, args, opts = {}) {
  console.log(`\n[demo] ${label}`)
  const res = spawnSync(cmd, args, { cwd: root, shell: true, stdio: 'inherit', ...opts })
  return res.status === 0
}

function clearPort(port) {
  const script = `pids=$(lsof -ti tcp:${port} 2>/dev/null || true); if [ -n "$pids" ]; then echo "killing stale process(es) on :${port}: $pids"; kill $pids || true; fi`
  spawnSync('bash', ['-lc', script], { cwd: root, stdio: 'inherit' })
}

function start(label, cmd, args, cwd = root) {
  console.log(`\n[demo] starting ${label}`)
  const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' })
  children.add(child)
  child.on('exit', (code) => {
    children.delete(child)
    if (code && !shuttingDown) {
      console.error(`[demo] ${label} exited with code ${code}`)
    }
  })
  return child
}

let shuttingDown = false
function stopAll() {
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
}
process.on('SIGINT', () => { stopAll(); process.exit(0) })
process.on('SIGTERM', () => { stopAll(); process.exit(0) })
process.on('exit', stopAll)

function npmInstallIfMissing(rel) {
  const dir = join(root, rel)
  if (!packageManager) {
    console.error('[demo] npm or pnpm is required. Install Node 20+ from nodejs.org, then re-run.')
    process.exit(1)
  }
  if (!existsSync(join(dir, 'node_modules'))) {
    run(`install deps in ${rel}`, packageManager, packageArgs(['install', '--no-audit', '--no-fund']), { cwd: dir })
  }
}

function ensureRuntime() {
  const runtime = join(root, 'packages', 'agent-runtime')
  if (!existsSync(join(runtime, 'node_modules'))) {
    run('install @pay/agent-runtime deps', packageManager, packageArgs(['install', '--no-audit', '--no-fund']), { cwd: runtime })
  }
  if (!existsSync(join(runtime, 'dist'))) {
    run('build @pay/agent-runtime', packageManager, ['run', 'build'], { cwd: runtime })
  }
}

async function waitJson(url, label, timeoutMs = 30_000) {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return res.json()
      last = `${res.status} ${await res.text()}`
    } catch (e) {
      last = e.message
    }
    await sleep(750)
  }
  throw new Error(`${label} did not become ready: ${last}`)
}

async function postJson(url, label, timeoutMs = 45_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? `${res.status}`)
    return body
  } finally {
    clearTimeout(timeout)
  }
}

function printWalletHint() {
  const wallets = join(root, 'WALLETS.txt')
  if (!existsSync(wallets)) return
  const text = readFileSync(wallets, 'utf8')
  const buyer = text.match(/Buyer\s+wallet\s+(\S+)/)?.[1]
  if (buyer) {
    console.log(`\n[demo] Buyer wallet must have devnet SOL: ${buyer}`)
    console.log('[demo] Faucet: https://faucet.solana.com')
  }
}

async function main() {
  run('bootstrap environment', 'bash', ['scripts/bootstrap.sh'])
  run('health check', 'bash', ['scripts/healthcheck.sh'])

  if (!packageManager) {
    console.error('[demo] npm or pnpm is required. Install Node 20+ from nodejs.org, then re-run.')
    process.exit(1)
  }
  if (Number(process.versions.node.split('.')[0]) < 20) {
    console.error(`[demo] Node ${process.version} detected. Install Node 20+ first.`)
    process.exit(1)
  }

  if (!existsSync(join(root, '.env'))) {
    console.log('[demo] .env not found; running setup to create devnet wallets.')
    npmInstallIfMissing('scripts')
    run('create .env and devnet wallets', 'node', ['scripts/setup.js'])
  }
  printWalletHint()

  run('check Docker is running', 'docker', ['info'])
  run('start CoralOS', 'docker', ['compose', 'up', '-d', 'coral'])
  clearPort(4000)
  clearPort(5173)

  ensureRuntime()
  npmInstallIfMissing('examples/marketplace')
  npmInstallIfMissing('examples/marketplace/feed')
  npmInstallIfMissing('examples/marketplace/web')

  run('build buyer/seller agent images', 'bash', ['build-agents.sh'])

  start('marketplace feed', packageManager, ['run', 'start'], join(root, 'examples', 'marketplace', 'feed'))
  const feedHealth = await waitJson('http://localhost:4000/api/health', 'marketplace feed')
  if (feedHealth.build !== EXPECTED_FEED_BUILD) {
    throw new Error(`marketplace feed is stale or mismatched: expected build ${EXPECTED_FEED_BUILD}, got ${feedHealth.build ?? 'unknown'}`)
  }
  console.log(`[demo] marketplace feed build ${feedHealth.build}`)

  start('marketplace dashboard', packageManager, ['run', 'dev'], join(root, 'examples', 'marketplace', 'web'))
  await sleep(1500)

  console.log('\n[demo] launching OmniQuantAI market round')
  const started = await postJson('http://localhost:4000/api/start', 'market start')
  const session = started.session
  const namespace = started.namespace
  const namespaceParam = namespace ? `&namespace=${encodeURIComponent(namespace)}` : ''
  const url = `http://localhost:5173/?session=${encodeURIComponent(session)}${namespaceParam}&presentation=1`
  const apiUrl = 'http://localhost:4000'
  const explorerUrl = 'https://explorer.solana.com/?cluster=devnet'

  console.log('\nOmniQuantAI')
  console.log('Financial Intelligence Network')
  console.log('System Ready')
  console.log(`Frontend URL: ${url}`)
  console.log(`API URL: ${apiUrl}`)
  console.log(`Explorer URL: ${explorerUrl}`)
  console.log('Agent status: buyer + four seller specialists launched through CoralOS')
  console.log('Settlement: watch the dashboard badges for deposit/release Explorer links')
  console.log('\nPress Ctrl+C here when you are done recording.\n')

  if (process.env.CODESPACES !== 'true' && process.env.NO_OPEN !== '1') {
    if (process.platform === 'darwin') runOptional('open browser', 'open', [url])
    else if (process.platform === 'linux') runOptional('open browser', 'xdg-open', [url])
  }

  await new Promise(() => {})
}

main().catch((e) => {
  console.error(`\n[demo] ${e.message}`)
  stopAll()
  process.exit(1)
})
