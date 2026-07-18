# Shared Config Package

Planned package for typed configuration shared by API, worker, CoralOS bridge, and SDK.

Configuration principles:

- fail fast for required production secrets
- allow deterministic fallbacks for demo-only data providers
- never expose private keys to frontend builds
- keep testnet/devnet and mainnet posture separate
- label every environment as `local`, `staging`, or `production`

The current canonical template is `.env.example`.
