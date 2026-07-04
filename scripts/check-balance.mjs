#!/usr/bin/env node
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

function getEnv(key) {
  if (process.env[key]) return process.env[key]
  if (!existsSync(envPath)) return ''
  const match = readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match?.[1]?.trim() ?? ''
}

const secret = getEnv('BUYER_KEYPAIR_B58')
if (!secret) {
  console.log('BUYER_KEYPAIR_B58 missing. Run npm run bootstrap.')
  process.exit(1)
}

const rpc = getEnv('SOLANA_RPC_URL') || 'https://api.devnet.solana.com'
const keypair = Keypair.fromSecretKey(bs58.decode(secret))
const connection = new Connection(rpc, 'confirmed')
let lamports
try {
  lamports = await connection.getBalance(keypair.publicKey)
} catch (error) {
  console.log(`Could not read devnet balance from ${rpc}. Check network access or rerun with SKIP_SOLANA_BALANCE=1 for offline checks.`)
  process.exit(1)
}
const sol = lamports / LAMPORTS_PER_SOL

if (sol <= 0.002) {
  console.log(`Buyer wallet ${keypair.publicKey.toBase58()} has ${sol.toFixed(4)} devnet SOL. Fund it at https://faucet.solana.com.`)
  process.exit(1)
}

console.log(`Buyer wallet funded: ${keypair.publicKey.toBase58()} has ${sol.toFixed(4)} devnet SOL`)
