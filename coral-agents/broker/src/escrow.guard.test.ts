/**
 * Devnet guard regression (F1) — the broker signs upstream deposits, so its makeProgram must refuse a
 * mainnet RPC like the buyer/seller clients. The guard throws before any network call, so this runs
 * offline in CI.
 */
import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { makeProgram } from './escrow.js'

describe('broker escrow devnet guard', () => {
  it('makeProgram refuses a mainnet RPC', async () => {
    await expect(
      makeProgram(Keypair.generate(), 'https://api.mainnet-beta.solana.com'),
    ).rejects.toThrow(/devnet-only/)
  })
})
