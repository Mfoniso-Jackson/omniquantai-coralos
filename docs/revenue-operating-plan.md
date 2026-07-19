# Revenue Operating Plan

## Objective

OmniQuantAI is building the Financial Intelligence Network: a marketplace where autonomous specialist
agents compete to produce, verify, and monetize investment intelligence.

The commercial target is GBP 1,000,000 monthly recurring revenue. This is an operating target, not a
forecast. Every product slice should strengthen at least one of:

- recurring revenue
- marketplace liquidity
- customer retention
- proprietary intelligence data
- institutional trust
- developer supply

## Target Revenue Mix

| Engine | Target MRR | Primary Buyer | Product Surface |
| --- | ---: | --- | --- |
| Professional SaaS | GBP 350,000 | solo analysts, independent researchers, fund operators | dashboard, saved research, premium agents |
| Team SaaS | GBP 200,000 | boutique funds, research teams, family offices | workspaces, collaboration, portfolio context |
| Enterprise | GBP 200,000 | institutions needing controls | private runtime, SSO, audit logs, dedicated deployment |
| Marketplace fees | GBP 150,000 | buyers and agent publishers | agent marketplace, settlement, reputation |
| API platform | GBP 75,000 | fintech builders, quant teams, internal platforms | market creation, memo retrieval, graph APIs |
| Premium intelligence | GBP 25,000 | power users and teams | graph analytics, benchmarking, historical intelligence |

## Subscription Packaging

| Tier | Buyer | Core Unlock | Revenue Logic |
| --- | --- | --- | --- |
| Starter | individual researcher | limited monthly markets, demo data fallback, saved memos | activation and conversion |
| Professional | serious analyst or operator | higher market volume, live data, session history, premium agents | primary self-serve MRR |
| Team | small fund or research team | shared workspace, portfolio context, collaboration, usage reports | expansion and retention |
| Enterprise | regulated or private team | SSO, audit logs, private agent roster, dedicated runtime, custom data rules | high-ACV contracts |

Pricing should be validated through design partners before being published. The first pricing test should
measure willingness to pay for repeated investment committee preparation, not willingness to pay for a
generic AI chat interface.

## Marketplace Revenue

Marketplace revenue requires liquidity and trust before monetization pressure.

Build in this order:

1. agent registry profiles
2. verified agent publishing workflow
3. buyer-facing agent discovery
4. reputation based on completed markets
5. seller earnings dashboard
6. platform fee accounting
7. premium placement only after quality safeguards exist

Early marketplace metrics:

- active agents by specialty
- bids per request
- completed paid deliveries
- verification pass rate
- seller earnings
- buyer repeat rate
- winning-agent concentration

## API Platform Revenue

The API should expose programmable financial intelligence infrastructure:

- create research market
- poll market job
- read market lifecycle
- retrieve memo
- inspect settlement proof
- query agent registry
- query reputation and graph records

The near-term API packaging should be simple:

- developer sandbox with rate limits
- paid usage tier based on completed markets and memo retrievals
- team API keys with usage reporting
- enterprise keys with tenant isolation and audit records

## Enterprise Revenue

Enterprise buyers will not buy a public demo. They buy control.

Required enterprise surfaces:

- private workspace
- private agent roster
- role permissions
- audit history
- API keys
- usage reports
- data-source controls
- deterministic verification records
- deployment boundary documentation

Do not build custom enterprise features before the market lifecycle is reliable. The correct first
enterprise wedge is a controlled pilot around one recurring research workflow.

## Premium Intelligence

The Financial Intelligence Graph becomes a premium product when completed markets produce reusable
records:

- request intent
- evidence used
- seller bids and reasoning
- buyer scoring
- memo output
- verification result
- settlement proof
- agent reputation
- later outcome labels

Premium intelligence should begin as internal analytics before becoming a paid product.

## Milestones To GBP 1M MRR

| Milestone | Revenue Goal | Required Product Proof |
| --- | ---: | --- |
| Reliability | GBP 0-5k MRR | market starts, completes, persists, and recovers without manual repair |
| Design Partners | GBP 5k-25k MRR | 5-10 teams repeatedly use OmniQuantAI for real research preparation |
| Paid Professional | GBP 25k-100k MRR | self-serve subscriptions, saved history, clear data provenance |
| Team Expansion | GBP 100k-300k MRR | workspaces, collaboration, portfolio context, team reporting |
| Marketplace Liquidity | GBP 300k-600k MRR | external agents earn, reputation matters, take rate is defensible |
| Enterprise/API | GBP 600k-1M MRR | private deployments, API usage, auditability, graph analytics |

## Next Product Slices

Prioritize these because they connect directly to revenue:

1. Reliability dashboard for async market jobs, retries, and dead-lettered sessions.
2. Agent registry storefront with status, specialization, reputation, and earnings.
3. API key and usage reporting foundation.
4. Paid pilot packaging docs: scope, success criteria, security boundaries, and pricing hypothesis.
5. Workspace collaboration: team notes, review status, and exportable memo trail.

Recently shipped:

- Session History / Saved Memo Workspace with saved sessions, memo previews, proof links, and data
  provenance hooks.

## Company Rule

Do not add broad financial features until the core market loop is boringly reliable:

```text
Create Market -> WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFIED -> RELEASED -> Persisted
```

That loop is the revenue engine. Everything else must make it more trusted, more repeatable, more
valuable, or more liquid.
