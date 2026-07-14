import { describe, expect, it } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { createSettlementProvider, normalizeSettlementMode, solanaExplorerUrl } from './settlement.js'

describe('buyer settlement provider', () => {
  it('defaults to arbiter settlement unless direct is explicitly requested', () => {
    expect(normalizeSettlementMode(undefined)).toBe('arbiter')
    expect(normalizeSettlementMode('arbiter')).toBe('arbiter')
    expect(normalizeSettlementMode('DIRECT')).toBe('direct')
    expect(normalizeSettlementMode('unexpected')).toBe('arbiter')
  })

  it('requires an arbiter signer for arbiter settlement', () => {
    expect(() => createSettlementProvider('arbiter', Keypair.generate(), null, 'https://api.devnet.solana.com')).toThrow(
      /ARBITER_KEYPAIR_B58/,
    )
  })

  it('creates a direct provider without requiring an arbiter signer', () => {
    const provider = createSettlementProvider('direct', Keypair.generate(), null, 'https://api.devnet.solana.com')
    expect(provider.mode).toBe('direct')
  })

  it('keeps Explorer links on devnet for the current testnet lane', () => {
    expect(solanaExplorerUrl('tx', 'abc')).toBe('https://explorer.solana.com/tx/abc?cluster=devnet')
    expect(solanaExplorerUrl('address', 'abc')).toBe('https://explorer.solana.com/address/abc?cluster=devnet')
  })
})
