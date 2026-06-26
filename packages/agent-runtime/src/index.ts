// @pay/agent-runtime — the CoralOS MCP client. The agent economy's entire runtime surface.

// CoralOS MCP client
export { CoralMcpAgent } from './coral_mcp.js'
export type { CoralMention, CoralMcpConfig } from './coral_mcp.js'

// Standalone CoralOS agent entrypoint (injected CORAL_CONNECTION_URL → your run loop)
export { startCoralAgent } from './coral_mcp_server.js'
export type { CoralAgentConfig, CoralAgentContext } from './coral_mcp_server.js'

// Devnet safety — guard agent payment code against a stray mainnet RPC
export { assertDevnet, solanaConnection, DEVNET_RPC } from './solana.js'

// Solana Pay — settlement primitives (reference-bound), shared by all agents
export { generatePaymentUrl, verifyPayment, signTransfer, loadKeypairB58 } from './solana_pay.js'
export type { PaymentUrl } from './solana_pay.js'

// LLM — provider-agnostic completion (Anthropic default, OpenAI via LLM_PROVIDER=openai)
export { complete, pickProvider, parseJsonReply } from './llm.js'
export type { LlmProvider, CompleteOpts } from './llm.js'

// Market protocol — the marketplace wire format (pure, network-free)
export {
  formatWant, parseWant, formatBid, parseBid, formatAward, parseAward,
  formatEscrowRequired, parseEscrowRequired, selectBids, pickCheapest, verb, messageRound,
} from './market.js'
export type { Want, Bid, EscrowTerms } from './market.js'
