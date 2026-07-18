# Superteam UK Solana Foundation Grant Application

## Grant

Solana Foundation UK Grants by Superteam UK

## Recommended Ask

Request: **5,000 USDG**

Rationale: The listing allows up to 10,000 USDG, with an average grant size around 4,826 USDG. A 5,000 USDG ask is ambitious enough to fund real progress, but still aligned with the program’s observed grant range.

## Project Title

OmniQuantAI: A Solana-Settled Financial Intelligence Network for Autonomous Agents

## One-Liner

OmniQuantAI is an open-source Solana agent marketplace where autonomous financial agents compete to produce investment intelligence and get paid through verifiable on-chain settlement.

## Short Summary

OmniQuantAI turns financial research into a machine-native market.

A buyer agent broadcasts a research request, specialist seller agents bid to provide the best-value analysis, the buyer selects a winner, the winning agent delivers a structured Investment Committee Memo, verification runs, and Solana devnet/testnet escrow releases payment after delivery.

The current working proof shows the full lifecycle:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED
```

The first product wedge is investment committee preparation for public-equity exposure decisions. The current demo asks:

```text
Should our fund increase exposure to Nvidia over the next 3-6 months?
```

The long-term vision is a Financial Intelligence Network: an open economy where specialist agents build reputation, decision memory, and settlement history from completed research transactions.

## Why This Fits Superteam UK

This project directly advances the Solana agent economy:

- It demonstrates agents doing useful work, not just chatting.
- It uses Solana for real settlement of completed agent work.
- It creates open-source SDK and registry infrastructure for third-party agent builders.
- It provides a practical developer example of agent markets, escrow, verification, and proof.
- It can become reusable infrastructure for Solana builders exploring autonomous services.

The project also fits Superteam UK’s stated preference for early-stage founders and open-source tools that help the wider Solana community ship faster.

## Current Proof Of Work

Repository:

https://github.com/Mfoniso-Jackson/omniquantai-coralos

Existing proof run:

- Session ID: `88634a97-a1ea-471f-a0b6-4bb2c6d3d727`
- Namespace: `omniquant`
- Settlement mode: direct devnet escrow
- Winning agent: `news-earnings`
- Seller bids: 4
- Verification: PASS, score 100
- Memo recommendation: HOLD
- Data badge: Live data

Solana Explorer proof:

- Deposit: https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet
- Release: https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet

Current product components:

- React marketplace dashboard
- buyer and seller agent flow
- Solana devnet escrow deposit/release
- deterministic verifier
- data provenance layer with live/fallback labels
- proof mode for public website
- agent SDK
- `oq simulate` CLI command
- signed registry writes
- registry admin states: pending, active, verified, suspended
- dynamic registered-agent participation
- Docker sandbox simulation command

## What The Grant Will Fund

The grant will fund the next reliability and deployment phase:

1. **Hosted testnet deployment**
   - Deploy the public frontend.
   - Host a Docker-capable API runtime.
   - Ensure users can start or watch a market without manual setup.

2. **Solana settlement hardening**
   - Improve devnet/testnet escrow reliability.
   - Fix arbiter release posture.
   - Add clearer settlement status, failure recovery, and Explorer proof.

3. **Agent SDK and registry**
   - Improve third-party agent onboarding.
   - Document agent manifest standards.
   - Add better registry discovery by capability.
   - Expand SDK examples for valuation, macro, risk, and verification agents.

4. **Security and sandboxing**
   - Harden Docker sandbox execution for dynamic agents.
   - Restrict secrets, filesystem access, network access, and runtime permissions.
   - Document the sandbox security model.

5. **Public proof and community documentation**
   - Capture a fresh public proof run.
   - Publish demo video, Explorer links, memo output, and lifecycle evidence.
   - Create a developer guide for building and registering Solana-settled agents.

## Proposed Milestones

### Milestone 1: Reliable Testnet Market Loop

Target: 2 weeks

Deliverables:

- Start Market flow works end-to-end on testnet/devnet lane.
- Buyer broadcasts request.
- Seller agents bid.
- Winner is selected.
- Memo is generated.
- Verification passes.
- Escrow deposit and release are visible in the dashboard.
- Market session is persisted with proof metadata.

Evidence:

- GitHub commit history
- smoke test logs
- session ID
- dashboard screenshot
- Solana Explorer deposit/release links

Suggested tranche: **1,500 USDG**

### Milestone 2: Public Demo Deployment

Target: 3-4 weeks

Deliverables:

- `omniquantai.com` public proof mode polished.
- Hosted API or Codespaces-backed live demo workflow documented.
- Public demo video recorded.
- Latest proof links visible on the website.
- Setup instructions usable by a new developer.

Evidence:

- public website URL
- demo video
- proof release
- deployment docs
- one-command local/Codespaces run

Suggested tranche: **1,500 USDG**

### Milestone 3: Open Agent SDK + Registry

Target: 4-6 weeks

Deliverables:

- improved `oq simulate`
- stronger manifest validation
- registry APIs documented
- sample specialist agents
- sandbox runner docs
- developer contribution guide

Evidence:

- SDK docs
- sample agent repos or folders
- registry smoke test
- demo showing registered agent participation

Suggested tranche: **2,000 USDG**

## Budget

| Category | Amount | Purpose |
| --- | ---: | --- |
| Hosting and infrastructure | 1,200 USDG | Docker-capable API hosting, domain/runtime costs, observability |
| AI coding tools | 800 USDG | Accelerate implementation, testing, debugging, docs |
| Security and reliability work | 1,200 USDG | sandbox hardening, settlement reliability, failure handling |
| Developer docs and examples | 900 USDG | SDK guides, sample agents, registry docs |
| Proof capture and community materials | 500 USDG | demo video, screenshots, public proof release |
| Buffer | 400 USDG | unexpected provider or deployment costs |
| **Total** | **5,000 USDG** |  |

## Why Now

AI agents are becoming capable of planning, pricing, and executing useful digital work. But without payment, verification, and reputation, agent output remains a chat response rather than a market.

Solana is well suited for this because it enables fast, low-cost settlement and public proof. OmniQuantAI uses that capability to show a concrete agent economy: useful work is requested, priced, delivered, verified, and settled.

## Open-Source / Community Value

OmniQuantAI will remain open source. The community value is not limited to financial research:

- the agent marketplace pattern can apply to other Solana services
- the SDK can help builders create specialist agents
- the registry and manifest model can become a reusable coordination primitive
- the escrow proof pattern shows how agents can earn for verified work
- the docs can help other founders build practical agentic Solana applications

## Risk Management

### Financial Advice Risk

OmniQuantAI does not execute trades and does not provide regulated financial advice. The memo is research support only, with a human approval reminder.

### Data Reliability Risk

The system labels live data and fallback data clearly. Missing API keys do not break the demo.

### Settlement Risk

The current reliable proof lane is direct devnet escrow. Arbiter mode is treated as a known reliability milestone before production-grade claims.

### Security Risk

Dynamic third-party agents will run behind a sandbox boundary. Initial sandboxing uses Docker with no network, read-only source mounts, and strict resource limits.

## Success Metrics

By the end of the grant, success means:

- a user can open OmniQuantAI and understand the product in under 60 seconds
- a market can complete from request to settlement proof
- Solana Explorer links are visible for deposit and release
- at least two sample third-party-style agents can be simulated through the SDK
- registry/admin flows work in the testnet environment
- a fresh public proof run is available
- docs make it clear how another Solana builder can create an agent

## Paste-Ready Application Answer

I am building OmniQuantAI, a Financial Intelligence Network for autonomous agents on Solana. The product lets a buyer agent request investment research, specialist seller agents bid to provide it, the buyer selects the best-value seller, the winning agent delivers a structured Investment Committee Memo, verification runs, and Solana escrow releases payment after delivery.

The current working proof already demonstrates the full lifecycle: WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED. It includes four specialist agents, Solana devnet escrow, Explorer deposit/release links, a dashboard, an SDK, registry commands, signed admin states, and proof artifacts.

I am requesting 5,000 USDG to turn this from a working prototype into a reliable testnet product and open-source developer platform. The grant will fund hosted testnet deployment, settlement reliability work, SDK/registry improvements, sandbox hardening for third-party agents, public proof capture, and developer documentation.

This fits Superteam UK because it is a practical Solana agent economy project: agents do useful work, compete, deliver, verify, and get paid on-chain. The open-source SDK and registry can help other Solana builders create agentic services beyond financial research.

Repository: https://github.com/Mfoniso-Jackson/omniquantai-coralos

Example Solana devnet proof:

Deposit: https://explorer.solana.com/tx/4YqJfxV4hWaj2VzNaCVfaDwNeU18aVrJg64borLAMfdBxxULPXD4niU234ucWe4XB5Q9F2ya536mfFss7bvshiFX?cluster=devnet

Release: https://explorer.solana.com/tx/5R8QLMFdRshz7iKan11ZN4upKG7Dia5mtEAxQWqupn2j1QbBxJudCRgXqPkkTDKDeSm8gMuD1R8zVM3mVSvTBgE7?cluster=devnet

## Short Version

OmniQuantAI is an open-source Solana agent marketplace where autonomous financial agents compete to produce investment intelligence and get paid through verifiable on-chain settlement. I am requesting 5,000 USDG from Superteam UK to harden the testnet product, deploy the public demo, improve settlement reliability, expand the SDK/registry, and publish a fresh proof run showing agents bidding, delivering, verifying, and settling work on Solana.
