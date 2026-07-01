#!/usr/bin/env node
// Provisions the wallets the OPTIONAL broker swarm needs (buyer → broker → 2 upstream sellers), on top
// of the base wallets from `node scripts/setup.js`. Writes the keys/addresses to .env and WALLETS.txt.
// Safe to re-run: existing values are preserved; only what's missing is generated.
//
// Used by:  examples/marketplace (ENABLE_BROKER=1) and examples/agent-economy (the /swarm door).
// Usage:    node scripts/provision-swarm.js
//
// The BROKER signs and FUNDS the upstream leg (it deposits into the sellers' escrow before reselling),
// so it must be funded with devnet SOL. The two seller wallets only RECEIVE on release — no funding.

import { Keypair } from '@solana/web3.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bs58 from 'bs58'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')
const walletsPath = join(root, 'WALLETS.txt')

/** Set or append `KEY=value` without disturbing the rest of the file. */
function setKv(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, '\n')}${key}=${value}\n`
}
/** Read an existing assignment, or undefined. */
const getKv = (text, key) => text.match(new RegExp(`^${key}=(\\S+)`, 'm'))?.[1]

if (!existsSync(envPath)) {
  console.error('No .env found — run `node scripts/setup.js` first (it creates the base wallets), then re-run this.')
  process.exit(1)
}
let env = readFileSync(envPath, 'utf8')

// Generate only what's missing — re-running never rotates a key you may have already funded.
const brokerB58 = getKv(env, 'BROKER_KEYPAIR_B58') || bs58.encode(Keypair.generate().secretKey)
const brokerPubkey = Keypair.fromSecretKey(bs58.decode(brokerB58)).publicKey.toBase58()
// The two upstream seller receive addresses. Distinct parties so each resale leg is a real transfer;
// they only receive on release, so store just the pubkey (no funding, no signing key needed here).
const cheapWallet = getKv(env, 'SELLER_CHEAP_WALLET') || Keypair.generate().publicKey.toBase58()
const premiumWallet = getKv(env, 'SELLER_PREMIUM_WALLET') || Keypair.generate().publicKey.toBase58()

env = setKv(env, 'BROKER_KEYPAIR_B58', brokerB58)
env = setKv(env, 'BROKER_WALLET', brokerPubkey) // where the buyer pays the broker (its own receive address)
env = setKv(env, 'SELLER_CHEAP_WALLET', cheapWallet)
env = setKv(env, 'SELLER_PREMIUM_WALLET', premiumWallet)
writeFileSync(envPath, env)

// -- report --
const block = [
  'Broker swarm — devnet wallets',
  `Generated: ${new Date().toISOString()}`,
  '',
  `  Broker         wallet  ${brokerPubkey}   <- signs + FUNDS the upstream resale leg (FUND THIS)`,
  `  Seller (cheap) wallet  ${cheapWallet}   <- receives on release (no funding needed)`,
  `  Seller (prem)  wallet  ${premiumWallet}   <- receives on release (no funding needed)`,
  '',
  'FUND THE BROKER with a little devnet SOL — the only way is the web faucet',
  '(sign in with GitHub; CLI/RPC airdrops are gated):',
  '',
  '  https://faucet.solana.com',
  '',
  'Then enable the swarm:',
  '  • marketplace:   ENABLE_BROKER=1 npm run marketplace',
  '  • agent-economy: the /swarm door (see examples/agent-economy)',
  '',
].join('\n')
// Append the swarm block to WALLETS.txt (keep the base-wallet report from setup.js if present).
const prior = existsSync(walletsPath) ? readFileSync(walletsPath, 'utf8').replace(/\s*$/, '') + '\n\n' : ''
writeFileSync(walletsPath, prior + block)
console.log('\n' + block)
console.log('(broker keys written to .env; addresses appended to WALLETS.txt)')
