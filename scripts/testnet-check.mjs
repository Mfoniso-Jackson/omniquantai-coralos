#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const envPath = join(root, '.env')
const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const envValue = (key) => envText.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() || process.env[key] || ''

const rpc = envValue('SOLANA_RPC_URL') || 'https://api.devnet.solana.com'
const allowMainnet = envValue('ALLOW_MAINNET')
const network = envValue('SOLANA_NETWORK') || 'devnet'

const checks = [
  {
    ok: !/mainnet/i.test(rpc),
    message: `SOLANA_RPC_URL is not mainnet (${rpc})`,
    fix: 'Use https://api.devnet.solana.com for the testnet/devnet release lane.',
  },
  {
    ok: allowMainnet !== '1',
    message: 'ALLOW_MAINNET is not enabled',
    fix: 'Unset ALLOW_MAINNET for the testnet/devnet release lane.',
  },
  {
    ok: network === 'devnet' || network === 'testnet' || network === '',
    message: `SOLANA_NETWORK is testnet/devnet-compatible (${network})`,
    fix: 'Set SOLANA_NETWORK=devnet for the current release lane.',
  },
]

const failed = checks.filter((check) => !check.ok)

console.log('\nOmniQuantAI testnet readiness check\n')
for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.message}`)
  if (!check.ok) console.log(`  fix: ${check.fix}`)
}

if (failed.length) {
  console.error(`\nFAIL: ${failed.length} testnet safety check(s) failed.`)
  process.exit(1)
}

console.log('\nPASS: repo is configured for the testnet/devnet release lane.\n')
