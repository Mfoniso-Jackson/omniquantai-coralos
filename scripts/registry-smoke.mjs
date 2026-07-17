import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'

const root = new URL('..', import.meta.url).pathname
const port = Number(process.env.REGISTRY_SMOKE_PORT ?? 4199)
const baseUrl = `http://localhost:${port}`
const dataDir = await mkdtemp(join(tmpdir(), 'omniquant-registry-smoke-'))
const authSecret = 'registry-smoke-secret'
const publisherId = 'registry-smoke'
const agents = [
  'sample-agents/valuation-agent/agent.json',
  'sample-agents/macro-agent/agent.json',
]

const child = spawn('npm', ['start', '--prefix', 'examples/marketplace/feed'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    OMNIQUANT_DATA_DIR: dataDir,
    FEED_SESSION_READ_RETRIES: '1',
    REGISTRY_AUTH_SECRET: authSecret,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let logs = ''
child.stdout.on('data', (data) => { logs += data.toString() })
child.stderr.on('data', (data) => { logs += data.toString() })

try {
  await waitForHealth()
  for (const agentPath of agents) {
    const manifest = JSON.parse(await readFile(join(root, agentPath), 'utf8'))
    await signedJson('/api/agents/register', { manifest, status: 'pending' })
    await signedJson(`/api/registry/agents/${manifest.id}/status`, { status: 'active' })
    await signedJson(`/api/registry/agents/${manifest.id}/status`, { status: 'verified' })
    console.log(`✓ registered and verified ${manifest.id}`)
  }

  const registered = await json(`${baseUrl}/api/registry/agents`)
  assertAgentCount(registered.agents, 2, 'registered agents')

  const valuation = await json(`${baseUrl}/api/registry/discover?market=omniquant&capabilities=equities,valuation`)
  assertIncludes(valuation.agents, 'valuation-agent', 'valuation discovery')

  const macro = await json(`${baseUrl}/api/registry/discover?market=omniquant&capabilities=macro`)
  assertIncludes(macro.agents, 'macro-agent', 'macro discovery')

  console.log(`✓ registry smoke passed (${baseUrl})`)
} finally {
  child.kill('SIGTERM')
}

async function waitForHealth() {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`feed exited ${child.exitCode}\n${logs}`)
    try {
      const res = await fetch(`${baseUrl}/api/health?quick=1`)
      if (res.ok) return
      last = `health ${res.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await sleep(300)
  }
  throw new Error(`feed did not become healthy: ${last}\n${logs}`)
}

async function json(url) {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${url} failed: ${res.status} ${JSON.stringify(body)}`)
  return body
}

async function signedJson(path, body) {
  const payload = JSON.stringify(body)
  const timestamp = new Date().toISOString()
  const signature = createHmac('sha256', authSecret)
    .update(`POST\n${path}\n${timestamp}\n${payload}`)
    .digest('hex')
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-oq-publisher': publisherId,
      'x-oq-timestamp': timestamp,
      'x-oq-signature': signature,
    },
    body: payload,
  })
  const response = await res.text()
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${response}`)
  return JSON.parse(response)
}

function assertAgentCount(agents, expected, label) {
  if (!Array.isArray(agents) || agents.length !== expected) {
    throw new Error(`${label} expected ${expected}, got ${Array.isArray(agents) ? agents.length : 'non-array'}`)
  }
  console.log(`✓ ${label}: ${agents.length}`)
}

function assertIncludes(agents, id, label) {
  if (!Array.isArray(agents) || !agents.some((agent) => agent.manifest?.id === id)) {
    throw new Error(`${label} did not include ${id}`)
  }
  console.log(`✓ ${label}: ${id}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
