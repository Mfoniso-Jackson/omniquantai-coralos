# Private API Runbook

This runbook verifies the MassifX private quant workflow against a running OmniQuantAI API.

## Environment

Use the same private key on both services:

```bash
export OMNIQUANT_API_KEY=local-private-key
```

OmniQuantAI API:

```bash
cd /Users/mfonisojackson/Documents/Codex/2026-07-01/files-mentioned-by-the-user-you/work/solana_coralOS/examples/marketplace/feed
OMNIQUANT_API_KEY=local-private-key PORT=4010 npm run start
```

MassifX web:

```bash
cd /Users/mfonisojackson/Documents/Codex/2026-07-09/files-mentioned-by-the-user-you/apps/web
OMNIQUANT_API_URL=http://127.0.0.1:4010 OMNIQUANT_API_KEY=local-private-key PORT=3010 npm run dev
```

Trigger the MassifX paper workflow:

```bash
curl -sS -X POST http://127.0.0.1:3010/api/paper/trade
```

## Expected Request Flow

The MassifX endpoint should call OmniQuantAI in this order:

```text
POST /v1/signals/generate
POST /v1/risk/evaluate
POST /v1/orders/prepare
POST /v1/orders/execute
```

The MassifX response should include:

```json
{
  "executed": true,
  "workflowRequestId": "...",
  "riskSource": "omniquant",
  "orderSource": "omniquant",
  "executionSource": "omniquant"
}
```

The OmniQuantAI logs should show one correlated workflow ID across all four calls:

```json
{"service":"omniquantai-private-api","event":"private_quant_request","requestId":"<same-id>","method":"POST","path":"/v1/signals/generate","statusCode":201}
{"service":"omniquantai-private-api","event":"private_quant_request","requestId":"<same-id>","method":"POST","path":"/v1/risk/evaluate","statusCode":201}
{"service":"omniquantai-private-api","event":"private_quant_request","requestId":"<same-id>","method":"POST","path":"/v1/orders/prepare","statusCode":201}
{"service":"omniquantai-private-api","event":"private_quant_request","requestId":"<same-id>","method":"POST","path":"/v1/orders/execute","statusCode":201}
```

## Auth

When `OMNIQUANT_API_KEY` is configured on OmniQuantAI, every private `/v1` call must include:

```text
Authorization: Bearer <OMNIQUANT_API_KEY>
```

MassifX sends this automatically when its own `OMNIQUANT_API_KEY` is set.

## Common Failure Modes

- **401 unauthorized**: MassifX is missing `OMNIQUANT_API_KEY`, or the key does not match the OmniQuantAI API key.
- **Local fallback response**: MassifX could not reach OmniQuantAI, so it fell back to local paper simulation.
- **No correlated request ID**: ensure MassifX is running the latest code and the response includes `workflowRequestId`.
- **Risk rejected**: check the `risk.reasons` array for stale data, hold signal, leverage, stop-loss, drawdown, daily loss, or kill switch refusal.
- **Port unavailable**: change `PORT=4010` or `PORT=3010`, then update `OMNIQUANT_API_URL`.

## Deployment Posture

For a real deployment:

1. Deploy OmniQuantAI API to a Docker-capable host.
2. Set `OMNIQUANT_API_KEY` on the OmniQuantAI service.
3. Set `OMNIQUANT_API_URL` and the same `OMNIQUANT_API_KEY` on MassifX.
4. Keep `/v1` private behind network policy or bearer-token auth.
5. Confirm structured logs show correlated `requestId` values for every workflow.
