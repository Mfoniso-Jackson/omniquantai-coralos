/**
 * echo-agent — the smallest possible CoralOS agent.
 *
 * It exists to prove ONE thing: a standalone TypeScript container can join a CoralOS
 * session over MCP and reply to an @mention. No payment, no LLM, no Solana.
 *
 * This is the Part A gate from IMPLEMENTATION_SPEC.md. When this round-trips a mention
 * against a live coral-server, the entire downstream agent-economy plan stops being theory.
 *
 * Gate pass criteria (see scripts/smoke/smoke-mcp.ts):
 *   1. logs "connected"
 *   2. logs "got: <text>"
 *   3. the thread shows "echo: <text>" back
 */
import { startCoralAgent } from '@pay/agent-core-ts'

await startCoralAgent({ agentName: 'echo-agent' }, async (ctx) => {
  console.error('[echo-agent] waiting for mentions')
  while (true) {
    const mention = await ctx.waitForMention(30_000)
    if (!mention) continue // timeout — keep waiting
    console.error(`[echo-agent] got: ${mention.text} (from ${mention.sender ?? 'unknown'})`)
    await ctx.reply(mention, `echo: ${mention.text}`)
  }
})
