#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = process.argv[2] ?? 'sample-agents/valuation-agent/agent.json'
const manifestPath = resolve(root, manifest)
const relativeManifest = manifestPath.startsWith(root) ? manifestPath.slice(root.length + 1) : manifest

if (!existsSync(join(root, 'packages/sdk/dist/cli.js'))) {
  console.error('SDK dist is missing. Run: npm run build --prefix packages/sdk')
  process.exit(1)
}

if (!existsSync(manifestPath)) {
  console.error(`Agent manifest not found: ${manifest}`)
  process.exit(1)
}

const image = process.env.SDK_AGENT_SANDBOX_IMAGE ?? 'node:20-alpine'
const args = [
  'run',
  '--rm',
  '--network', 'none',
  '--read-only',
  '--cpus', process.env.SDK_AGENT_SANDBOX_CPUS ?? '0.5',
  '--memory', process.env.SDK_AGENT_SANDBOX_MEMORY ?? '256m',
  '--pids-limit', process.env.SDK_AGENT_SANDBOX_PIDS ?? '64',
  '--security-opt', 'no-new-privileges',
  '--cap-drop', 'ALL',
  '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
  '-v', `${root}:/workspace:ro`,
  '-w', '/workspace',
  image,
  'node',
  'packages/sdk/dist/cli.js',
  'simulate',
  relativeManifest,
]

console.error(`[sandbox] docker ${args.join(' ')}`)
const result = spawnSync('docker', args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
