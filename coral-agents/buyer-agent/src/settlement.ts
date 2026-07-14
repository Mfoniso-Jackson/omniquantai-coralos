import type { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { makeProgram, deposit, release, escrowPda } from './escrow.js'
import {
  ARBITER_PROGRAM_ID,
  ensureArbiterConfig,
  ensureArbiterFunded,
  makeArbiter,
  openArbitrated,
  arbitrateRelease,
  arbitratedEscrowPda,
} from './arbiter.js'

export type SettlementMode = 'direct' | 'arbiter'

export interface OpenEscrowParams {
  seller: PublicKey
  reference: PublicKey
  amountSol: number
  deadlineSecs: number
}

export interface OpenEscrowResult {
  sig: string
  settlement: SettlementMode
  vault?: PublicKey
  escrow: PublicKey
}

export interface ReleaseEscrowParams {
  seller: PublicKey
  reference: PublicKey
}

export interface SettlementProvider {
  mode: SettlementMode
  setup(): Promise<void>
  open(params: OpenEscrowParams): Promise<OpenEscrowResult>
  release(params: ReleaseEscrowParams): Promise<string>
  explorerUrl(kind: 'tx' | 'address', id: string): string
}

export const solanaExplorerUrl = (kind: 'tx' | 'address', id: string): string =>
  `https://explorer.solana.com/${kind}/${id}?cluster=devnet`

class DirectSettlementProvider implements SettlementProvider {
  readonly mode = 'direct' as const
  private program: Program | null = null

  constructor(private readonly buyer: Keypair, private readonly rpcUrl: string) {}

  async setup(): Promise<void> {
    this.program = await makeProgram(this.buyer, this.rpcUrl)
  }

  async open(params: OpenEscrowParams): Promise<OpenEscrowResult> {
    const program = await this.getProgram()
    const sig = await deposit(program, this.buyer, params.seller, params.reference, params.amountSol, params.deadlineSecs)
    return {
      sig,
      settlement: this.mode,
      escrow: escrowPda(this.buyer.publicKey, params.reference),
    }
  }

  async release(params: ReleaseEscrowParams): Promise<string> {
    return release(await this.getProgram(), this.buyer, params.seller, params.reference)
  }

  explorerUrl(kind: 'tx' | 'address', id: string): string {
    return solanaExplorerUrl(kind, id)
  }

  private async getProgram(): Promise<Program> {
    if (!this.program) await this.setup()
    return this.program as Program
  }
}

class ArbiterSettlementProvider implements SettlementProvider {
  readonly mode = 'arbiter' as const

  constructor(
    private readonly buyer: Keypair,
    private readonly arbiter: Keypair,
    private readonly rpcUrl: string,
  ) {}

  async setup(): Promise<void> {
    await ensureArbiterConfig(this.buyer, this.arbiter.publicKey, this.rpcUrl)
    await ensureArbiterFunded(this.buyer, this.arbiter.publicKey, this.rpcUrl)
  }

  async open(params: OpenEscrowParams): Promise<OpenEscrowResult> {
    const opened = await openArbitrated(
      makeArbiter(this.buyer, this.rpcUrl),
      this.buyer,
      params.seller,
      params.reference,
      params.amountSol,
      params.deadlineSecs,
    )
    return {
      sig: opened.sig,
      settlement: this.mode,
      vault: opened.vault,
      escrow: opened.escrow,
    }
  }

  async release(params: ReleaseEscrowParams): Promise<string> {
    return arbitrateRelease(makeArbiter(this.arbiter, this.rpcUrl), this.arbiter, params.seller, params.reference)
  }

  explorerUrl(kind: 'tx' | 'address', id: string): string {
    return solanaExplorerUrl(kind, id)
  }

  arbiterAddress(): PublicKey {
    return ARBITER_PROGRAM_ID
  }

  escrowAddress(vault: PublicKey, reference: PublicKey): PublicKey {
    return arbitratedEscrowPda(vault, reference)
  }
}

export function normalizeSettlementMode(mode: string | undefined): SettlementMode {
  return mode?.toLowerCase() === 'direct' ? 'direct' : 'arbiter'
}

export function createSettlementProvider(
  mode: string | undefined,
  buyer: Keypair,
  arbiter: Keypair | null,
  rpcUrl: string,
): SettlementProvider {
  const normalized = normalizeSettlementMode(mode)
  if (normalized === 'direct') return new DirectSettlementProvider(buyer, rpcUrl)
  if (!arbiter) throw new Error('ARBITER_KEYPAIR_B58 is required for SETTLEMENT_MODE=arbiter')
  return new ArbiterSettlementProvider(buyer, arbiter, rpcUrl)
}
