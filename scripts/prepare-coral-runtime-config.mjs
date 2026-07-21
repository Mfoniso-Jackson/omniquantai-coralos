#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'infrastructure', 'coral', 'omniquant.coral.toml')
const runtimeDir = join(root, '.runtime')
const target = join(runtimeDir, 'coral.toml')

function shellOutput(command) {
  const result = spawnSync('bash', ['-lc', command], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

function dockerCallbackAddress() {
  if (process.env.CORAL_DOCKER_ADDRESS) return process.env.CORAL_DOCKER_ADDRESS
  if (process.platform !== 'linux') return 'host.docker.internal'
  return shellOutput("docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}'") || '172.17.0.1'
}

const address = dockerCallbackAddress()
mkdirSync(runtimeDir, { recursive: true })
const config = readFileSync(source, 'utf8').replace(/address = ".*"/, `address = "${address}"`)
writeFileSync(target, config)

console.log(`CoralOS Docker callback address: ${address}`)
console.log(`Wrote ${target}`)
