/**
 * Escrow settlement for the broker — it needs BOTH halves of the kit's escrow client:
 *  - the buyer side (`makeProgram`/`deposit`/`release`) to pay an upstream seller, and
 *  - the seller side (`isFunded`) to verify the downstream buyer's deposit before procuring.
 *
 * Combines coral-agents/buyer-agent/src/escrow.ts (deposit/release) with the seller's `isFunded`.
 * All connections go through `solanaConnection()` so the devnet guard applies (see F1 in the audit).
 *
 * These calls settle against the escrow program deployed to devnet (see PROGRAM_ID); they need a
 * funded devnet wallet + live RPC, so they run in a live market session, not in `npm test`/CI.
 */
// @coral-xyz/anchor is CommonJS — a DEFAULT import exposes the whole module.exports (a namespace
// import misses members the cjs lexer doesn't detect). esModuleInterop makes this typecheck.
import anchor from '@coral-xyz/anchor'
import type { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { solanaConnection } from '@pay/agent-runtime'
const { AnchorProvider, BN } = anchor

export const PROGRAM_ID = new PublicKey('R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet')

/** Per-order escrow PDA: one per (buyer, reference). */
export function escrowPda(buyer: PublicKey, reference: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), buyer.toBuffer(), reference.toBuffer()],
    PROGRAM_ID,
  )[0]
}

/** Program handle signed by `payer` (the broker, which deposits/releases upstream). */
export async function makeProgram(payer: Keypair, rpcUrl: string): Promise<Program> {
  // solanaConnection() applies the devnet guard (throws on a mainnet RPC unless ALLOW_MAINNET=1).
  const provider = new AnchorProvider(
    solanaConnection(rpcUrl),
    new anchor.Wallet(payer),
    { commitment: 'confirmed' },
  )
  const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider)
  if (!idl) throw new Error('escrow IDL not found on-chain — is the program deployed to this cluster?')
  return new anchor.Program(idl, provider)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Lock `amountSol` for `reference`, refundable `deadlineSecs` from now. Returns the deposit sig. */
export async function deposit(
  program: Program,
  buyer: Keypair,
  seller: PublicKey,
  reference: PublicKey,
  amountSol: number,
  deadlineSecs: number,
): Promise<string> {
  const deadline = new BN(Math.floor(Date.now() / 1000) + deadlineSecs)
  return (program.methods as any)
    .initialize(new BN(Math.round(amountSol * LAMPORTS_PER_SOL)), reference, deadline)
    .accounts({ buyer: buyer.publicKey, seller, escrow: escrowPda(buyer.publicKey, reference) })
    .signers([buyer])
    .rpc()
}

/** Confirm delivery → pay the seller and close the escrow. */
export async function release(
  program: Program,
  buyer: Keypair,
  seller: PublicKey,
  reference: PublicKey,
): Promise<string> {
  return (program.methods as any)
    .release()
    .accounts({ buyer: buyer.publicKey, seller, escrow: escrowPda(buyer.publicKey, reference) })
    .signers([buyer])
    .rpc()
}

/** Is a funded escrow present for (buyer, reference) naming `seller`, holding ≥ `minAmountSol`? */
export async function isFunded(
  program: Program,
  buyer: PublicKey,
  seller: PublicKey,
  reference: PublicKey,
  minAmountSol = 0,
): Promise<boolean> {
  const acct = await (program.account as any).escrow.fetchNullable(escrowPda(buyer, reference))
  if (!acct) return false
  return (
    acct.buyer.equals(buyer) &&
    acct.seller.equals(seller) &&
    acct.amount.toNumber() >= Math.round(minAmountSol * LAMPORTS_PER_SOL)
  )
}
