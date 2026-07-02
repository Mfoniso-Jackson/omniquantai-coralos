/**
 * Standalone CoralOS MCP agent entrypoint.
 *
 * Usage (in each coral-agent's index.ts):
 *   await startCoralAgent({ agentName: 'seller-agent' }, async (ctx) => {
 *     while (true) {
 *       const mention = await ctx.waitForMention()
 *       if (!mention) continue
 *       await ctx.reply(mention, 'hello back')
 *     }
 *   })
 *
 * CORAL_CONNECTION_URL is injected by CoralOS at container start (see the Docker runtime docs below).
 *
 * CoralOS docs:
 *   Writing agents   https://docs.coralos.ai/guides/writing-agents
 *   Docker runtime   https://docs.coralos.ai/reference/agent/tables/runtimes/docker  (injects CORAL_CONNECTION_URL)
 *   MCP interface    https://docs.coralos.ai/concepts/mcp
 * Whole-kit walkthrough: /CORAL.md.
 */

import { CoralMcpAgent, CoralMention } from './mcp.js'

export { CoralMention }

export interface CoralAgentConfig {
  agentName?: string
  version?: string
}

export interface CoralAgentContext {
  /** Block until the next @mention arrives. Returns null on timeout — keep looping. */
  waitForMention(maxWaitMs?: number): Promise<CoralMention | null>
  /** Like waitForMention, but only returns a mention in `threadId` (skips other threads). */
  waitForMentionInThread(threadId: string, maxWaitMs?: number): Promise<CoralMention | null>
  /** Block until a message from `agentName` arrives. Use to wait for a counterparty to come online. */
  waitForAgent(agentName: string, maxWaitMs?: number): Promise<CoralMention | null>
  /** Reply to a mention in its thread, @mentioning the original sender. */
  reply(mention: CoralMention, content: string): Promise<void>
  /** Send a message into a specific thread, optionally @mentioning agents. */
  send(content: string, threadId: string, mentions?: string[]): Promise<void>
  /** Create a new thread with the given participants. Returns threadId. */
  createThread(name: string, participants: string[]): Promise<string>
}

/**
 * Connect to CoralOS and hand control to `run`.
 * Handles connection, reconnection logging, and clean shutdown on SIGINT/SIGTERM.
 */
export async function startCoralAgent(
  config: CoralAgentConfig,
  run: (ctx: CoralAgentContext) => Promise<void>,
): Promise<void> {
  const url = process.env.CORAL_CONNECTION_URL
  if (!url) {
    console.error('CORAL_CONNECTION_URL not set — CoralOS injects this at container start')
    process.exit(1)
  }

  const agentName = config.agentName ?? process.env.AGENT_NAME ?? 'ts-agent'
  console.error(`[${agentName}] connecting to ${url}`)

  const agent = new CoralMcpAgent({
    connectionUrl: url,
    agentName,
    version: config.version ?? '0.1.0',
  })

  await agent.connect()
  console.error(`[${agentName}] connected`)

  const ctx: CoralAgentContext = {
    waitForMention: (maxWaitMs) => agent.waitForMention(maxWaitMs),

    waitForMentionInThread: (threadId, maxWaitMs) => agent.waitForMentionInThread(threadId, maxWaitMs),

    waitForAgent: (agentName, maxWaitMs) => agent.waitForAgent(agentName, maxWaitMs),

    reply: async (mention, content) => {
      if (!mention.threadId) throw new Error('mention has no threadId')
      await agent.sendMessage(
        content,
        mention.threadId,
        mention.sender ? [mention.sender] : [],
      )
    },

    send: async (content, threadId, mentions) => {
      await agent.sendMessage(content, threadId, mentions ?? [])
    },

    createThread: async (name, participants) => {
      return agent.createThread(name, participants)
    },
  }

  const shutdown = async () => {
    console.error(`[${agentName}] shutting down`)
    await agent.disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await run(ctx)
}
