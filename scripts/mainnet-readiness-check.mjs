#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEVNET_ESCROW = 'R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet'
const DEVNET_ARBITER = 'FJtuVXsyXuRKqgJBEPAXmktkd13CqStapgevzGwYktXd'
const MAX_RECOMMENDED_SOL = 0.01

const root = new URL('..', import.meta.url).pathname
const envPath = join(root, '.env')
const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const envValue = (key) => envText.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() || process.env[key] || ''

const rpc = envValue('SOLANA_RPC_URL')
const network = envValue('SOLANA_NETWORK')
const escrow = envValue('MAINNET_ESCROW_PROGRAM_ID')
const arbiter = envValue('MAINNET_ARBITER_PROGRAM_ID')
const maxOrder = Number(envValue('MAX_MAINNET_ORDER_SOL') || '0')
const allowMainnet = envValue('ALLOW_MAINNET')
const ack = envValue('MAINNET_RISK_ACK')

const checks = [
  {
    ok: network === 'mainnet',
    message: 'SOLANA_NETWORK=mainnet is explicit',
    fix: 'Set SOLANA_NETWORK=mainnet only after completing legal, security, and operational review.',
  },
  {
    ok: /mainnet/i.test(rpc),
    message: 'SOLANA_RPC_URL points at a mainnet endpoint',
    fix: 'Configure a dedicated mainnet RPC URL. Do not reuse devnet RPC.',
  },
  {
    ok: allowMainnet === '1',
    message: 'ALLOW_MAINNET=1 is explicitly enabled',
    fix: 'Set ALLOW_MAINNET=1 only for a controlled mainnet dry run.',
  },
  {
    ok: Boolean(escrow) && escrow !== DEVNET_ESCROW,
    message: 'MAINNET_ESCROW_PROGRAM_ID is configured and differs from devnet',
    fix: 'Deploy or select an audited escrow program on mainnet and set MAINNET_ESCROW_PROGRAM_ID.',
  },
  {
    ok: Boolean(arbiter) && arbiter !== DEVNET_ARBITER,
    message: 'MAINNET_ARBITER_PROGRAM_ID is configured and differs from devnet',
    fix: 'Deploy or select an audited arbiter program on mainnet and set MAINNET_ARBITER_PROGRAM_ID.',
  },
  {
    ok: maxOrder > 0 && maxOrder <= MAX_RECOMMENDED_SOL,
    message: `MAX_MAINNET_ORDER_SOL is capped at <= ${MAX_RECOMMENDED_SOL} SOL`,
    fix: `Set MAX_MAINNET_ORDER_SOL to a tiny dry-run cap such as 0.001, never above ${MAX_RECOMMENDED_SOL} for v1.`,
  },
  {
    ok: ack === 'I_UNDERSTAND_MAINNET_RISK',
    message: 'MAINNET_RISK_ACK is set',
    fix: 'Set MAINNET_RISK_ACK=I_UNDERSTAND_MAINNET_RISK after reviewing docs/mainnet-readiness.md.',
  },
]

const failed = checks.filter((check) => !check.ok)

console.log('\nOmniQuantAI mainnet readiness check\n')
for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.message}`)
  if (!check.ok) console.log(`  blocker: ${check.fix}`)
}

if (failed.length) {
  console.error(`\nNOT READY: ${failed.length} mainnet blocker(s) remain. Keep using the testnet/devnet release lane.\n`)
  process.exit(1)
}

console.log('\nREADY FOR CONTROLLED MAINNET DRY RUN: review key custody and transaction caps before signing anything.\n')
