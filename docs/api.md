# OmniQuantAI API

The marketplace feed API is intentionally small. It supports the dashboard, Codespaces demo, and early production v1 deployments.

Default local base URL:

```text
http://localhost:4000
```

## Health

```http
GET /health
GET /status
GET /api/health
GET /api/status
```

Query:

- `quick=1` skips the CoralOS reachability probe.

Response:

```json
{
  "ok": true,
  "coral": "http://localhost:5555",
  "coralReachable": true,
  "coralStatus": "reachable",
  "build": "feed-direct-launcher-v6"
}
```

## Start Session

```http
POST /api/sessions/start
POST /api/start
```

Starts one OmniQuantAI market session:

- buyer agent
- the current bootstrap specialist seller roster
- CoralOS session thread
- Solana devnet settlement flow

Response:

```json
{
  "session": "394f18fe-842e-4243-8b84-8a1365b4a31c",
  "namespace": "omniquant"
}
```

The endpoint returns after CoralOS creates the session. The dashboard then polls the feed while the buyer publishes `WANT` and sellers respond.

The dashboard Start Market form is workspace-first. A user selects an existing pilot/team workspace or
creates a new one before launching. After the session is created, the dashboard automatically calls
`POST /api/organizations/:id/sessions`, so the new memo lands in that customer/team context.

## Session Snapshot

```http
GET /session/:id
GET /api/session/:id
GET /api/sessions/:id
```

Optional query:

- `namespace=omniquant`

Response:

```json
{
  "session": "394f18fe-842e-4243-8b84-8a1365b4a31c",
  "namespace": "omniquant",
  "rounds": [],
  "updatedAt": "2026-07-09T12:00:00.000Z",
  "marketStatus": {
    "currentStage": "SESSION_CREATED",
    "currentStageLabel": "Session created",
    "buyerStatus": "Waiting for buyer to broadcast WANT.",
    "sellerStatus": "Seller agents may still be starting.",
    "sellerBidCount": 0,
    "settlementStatus": "Not started",
    "dataSource": "Unknown",
    "elapsedMs": 4231
  },
  "diagnostics": {
    "api": "ok",
    "coral": "ok",
    "build": "feed-direct-launcher-v6",
    "currentStage": "SESSION_CREATED",
    "currentStageLabel": "Session created",
    "elapsedMs": 4231,
    "messageCount": 0,
    "lastEventType": "NONE",
    "lastEvent": "No events for this session yet",
    "buyerStatus": "No CoralOS thread messages yet. Buyer may still be starting.",
    "sellerStatus": "Seller agents may still be starting.",
    "sellerBidCount": 0,
    "settlementStatus": "Not started",
    "dataSource": "Unknown",
    "escrowStatus": "Not started"
  }
}
```

## Feed

```http
GET /api/feed?session=<id>&namespace=omniquant
```

Returns folded marketplace rounds for the dashboard:

- research request
- bids
- buyer award
- escrow required
- deposit
- delivered memo
- verification
- release/refund
- diagnostics

## Market Status

```http
GET /market/:id
GET /api/market/:id
GET /api/market/:id/status
```

Response:

```json
{
  "session": "394f18fe-842e-4243-8b84-8a1365b4a31c",
  "namespace": "omniquant",
  "status": "BIDS_RECEIVED",
  "currentStage": "BIDS_RECEIVED",
  "currentStageLabel": "Bids received",
  "latestRound": 1,
  "settlementStatus": "Not started",
  "elapsedMs": 12000,
  "dataSource": "Unknown",
  "diagnostics": {
    "coral": "ok",
    "sellerBidCount": 4,
    "settlementStatus": "Not started",
    "escrowStatus": "Not started"
  },
  "updatedAt": "2026-07-09T12:00:00.000Z"
}
```

## Lifecycle Status

`marketStatus.currentStage` is the canonical API stage for the market loop:

```text
NO_SESSION
SESSION_CREATED
WANT_BROADCAST
BIDS_RECEIVED
WINNER_SELECTED
ESCROW_REQUESTED
ESCROW_DEPOSITED
INTELLIGENCE_DELIVERED
VERIFICATION_COMPLETE
PAYMENT_RELEASED
REFUNDED
ERROR
```

Use `marketStatus` for automation and dashboards. Use `diagnostics` for debugging runtime health.

## Saved Memo Workspace

The session history workspace persists analyst review state separately from the immutable market
transcript. This lets a team review, assign, and export delivered memos without mutating the original
agent evidence.

```http
GET /api/workspace/memos
GET /api/workspace/memos/:sessionId
PATCH /api/workspace/memos/:sessionId
POST /api/workspace/memos/:sessionId/export
GET /api/workspace/memos/:sessionId/members
POST /api/workspace/memos/:sessionId/members
GET /api/workspace/memos/:sessionId/members/audit
GET /api/organizations
POST /api/organizations
GET /api/organizations/:id
POST /api/organizations/:id/sessions
GET /api/organizations/:id/members
POST /api/organizations/:id/members
GET /api/organizations/:id/members/audit
```

`PATCH /api/workspace/memos/:sessionId` accepts:

```json
{
  "memoId": "session:memo:1",
  "reviewStatus": "Approved",
  "reviewer": "Research Lead",
  "note": "Ready for the weekly IC packet.",
  "exportReady": true
}
```

`POST /api/workspace/memos/:sessionId/export` records an export-history event and marks the memo
export-ready:

```json
{
  "actor": "Research Lead",
  "exportNote": "Shared with the design partner."
}
```

Review statuses:

```text
Needs Review
Approved
Watchlist
Rejected
```

Workspace reads are public in local/demo mode. Workspace writes are unsigned only when no server secret
is configured. In shared testnet or production environments, set `WORKSPACE_AUTH_SECRET` or
`MARKETPLACE_API_TOKEN` on the API server and `VITE_WORKSPACE_API_TOKEN` on the dashboard build. Signed
workspace writes use the same HMAC headers as registry admin writes:

```text
x-oq-publisher
x-oq-timestamp
x-oq-signature
```

When a workspace secret is configured, write authorization has two layers:

1. HMAC signature identifies the publisher.
2. Workspace membership decides whether that publisher can edit.

Roles:

```text
owner  - edit memos, record exports, manage members
admin  - edit memos, record exports, manage members
editor - edit memos and record exports
viewer - read only
```

The first signed writer for a new workspace is auto-granted `owner` unless
`WORKSPACE_AUTO_GRANT_FIRST_OWNER=0` is set. Add or update members with:

```json
{
  "publisherId": "research-lead",
  "role": "editor",
  "displayName": "Research Lead"
}
```

The dashboard Saved Memo Workspace includes a compact members panel for team pilots. Owners/admins can
invite a publisher, change roles, or revoke non-owner members from the selected session workspace.
Every membership write appends an immutable audit record with actor, previous role/status, next
role/status, and action (`invited`, `promoted`, `demoted`, `revoked`, or `restored`).
The dashboard surfaces the latest audit entries directly in the members panel.

Organization-level workspaces group many saved market sessions under one pilot/team. This prevents
each completed market from behaving like an isolated workspace and gives paid pilots a shared research
memory surface.

`POST /api/organizations` accepts:

```json
{
  "name": "Northstar Capital Pilot",
  "slug": "northstar-capital",
  "status": "active"
}
```

`POST /api/organizations/:id/sessions` assigns an existing market session to that pilot/team:

```json
{
  "sessionId": "394f18fe-842e-4243-8b84-8a1365b4a31c"
}
```

The same workspace HMAC header model protects organization writes when a workspace/API secret is
configured. Creating a new organization makes the signed creator its first owner. Updating an existing
organization, assigning sessions, or managing organization members requires `owner`/`admin` on that
organization. The dashboard can create a pilot/team workspace, assign the selected session, and show how
many saved sessions belong to each organization.

Organization membership is now an inherited permission scope. When a session is assigned to an
organization, a publisher with `owner`, `admin`, or `editor` on `organization:<organizationId>` can edit
memo workspace state for any assigned session. `owner` and `admin` can also manage organization members
and assign sessions. If the same publisher has an explicit session-level membership, that session role
takes precedence, so a session-level `viewer` can intentionally narrow access even when the publisher is
an organization-level editor.

The dashboard Pilot / Team Workspace panel now exposes organization member administration directly:
invite or update publishers, promote/demote roles, revoke non-owner members, and review the latest
organization access audit events without calling the API manually.

The same panel includes a saved Pilot Workspace view with all assigned sessions, memo review status
counts, reviewers, export-ready memo counts, settlement-proof readiness, and organization access
activity.

## Execution Flow And Recovery

| Step | Input | Output | Failure mode | Recovery |
| --- | --- | --- | --- | --- |
| Frontend | User clicks Start Market | `POST /api/start` | API unavailable | Restart `npm run judge`, confirm port `4000` |
| API | Start request | Session ID and namespace | launcher timeout | Inspect feed logs and Docker status |
| Marketplace launcher | `.env`, CoralOS URL | buyer and seller containers | Docker unavailable | Start Docker or use Codespaces |
| Buyer | session graph | `WANT`, `AWARD`, `DEPOSITED`, `VERIFIED`, `RELEASED` | wallet unfunded or no bids | Fund devnet wallet, inspect buyer logs |
| CoralOS | agent messages | session extended state | namespace/session not found | feed retries and namespace scan; restart CoralOS if persistent |
| Sellers | `WANT`, `AWARD`, `DEPOSITED` | `BID`, `ESCROW_REQUIRED`, `DELIVERED` | seller startup or escrow check failure | inspect seller logs, verify settlement mode |
| Data providers | optional API keys | live or fallback evidence | provider outage | deterministic fallback with data badge |
| Settlement | escrow terms | deposit/release signatures | RPC/funding issue | fund buyer wallet, retry session |
| Persistence | folded rounds | JSONL records | local write failure | check `OMNIQUANT_DATA_DIR` permissions |

## Error Shape

Errors are JSON and include actionable context where possible:

```json
{
  "session": "session-id",
  "namespace": "omniquant",
  "rounds": [],
  "updatedAt": "2026-07-09T12:00:00.000Z",
  "error": "feed failed: coral 404: Session not found",
  "diagnostics": {
      "api": "ok",
      "coral": "unreachable",
      "currentStage": "ERROR",
      "currentStageLabel": "Runtime error",
      "buyerStatus": "CoralOS extended state could not be read for this session.",
      "sellerStatus": "Unknown",
      "settlementStatus": "Unknown",
      "escrowStatus": "Unknown"
  }
}
```

## Security Notes

- The API does not expose wallet private keys.
- Provider API keys are read from server-side environment variables only.
- The frontend should call the API, not CoralOS directly.
- The demo is research infrastructure and not financial advice.
