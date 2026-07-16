# Settlement

## Current Architecture

OmniQuantAI uses Solana devnet settlement for the current release lane. The buyer deposits into escrow, the seller delivers after funding is verified, and payment is released after verification.

## Reference Binding

Each order uses a reference. The reference binds the payment proof to a specific market order and seeds the escrow account.

## Escrow Flow

```text
seller -> ESCROW_REQUIRED
buyer  -> deposit/open escrow
buyer  -> DEPOSITED
seller -> verify funded escrow
seller -> DELIVERED
buyer  -> VERIFIED
buyer  -> RELEASED
```

## Arbiter Mode

The default path is arbiter-gated settlement. The buyer funds a vault-backed escrow, and the arbiter release path pays the seller after verified delivery.

Current devnet posture: arbiter mode reaches deposit, delivery, and verification, but release can fail with `NotArbiter` when the local `ARBITER_KEYPAIR_B58` does not match the arbiter configured in the deployed devnet program. Treat arbiter mode as the next settlement reliability fix before production-grade claims.

## Direct Mode

Direct mode is the reliable proof lane today. It uses the base devnet escrow path and completes the full `DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED` lifecycle with Explorer links. Use `SETTLEMENT_MODE=direct` for public proof runs until the arbiter config/key posture is repaired.

## Refund

Refund is part of the escrow contract direction but is not the primary happy-path demo. Future provider work should expose refund through the settlement provider.

## Explorer Proof

The dashboard links deposit and release transactions on Solana Explorer with `cluster=devnet`.

## Private Keys

Wallet private keys stay in `.env`. They must never be exposed to the frontend or committed.

## SettlementProvider Boundary

Buyer settlement now routes through:

```text
coral-agents/buyer-agent/src/settlement.ts
```

This is the boundary for future mainnet or alternate-chain adapters.

## Future Sui Adapter

Sui settlement is future work. It should be added only after the provider interface, tests, and demo story remain stable.

## Devnet Limitations

Devnet settlement proves mechanics, not production custody or legal readiness. Mainnet requires separate review.
