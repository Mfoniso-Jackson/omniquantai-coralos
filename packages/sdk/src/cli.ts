#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateAgentManifest } from './manifest.js'
import { MarketplaceClient } from './marketplaceClient.js'
import type { AgentManifest } from './types.js'

const [, , command, ...args] = process.argv

async function main(): Promise<void> {
  switch (command) {
    case 'create-agent':
      await createAgent(args[0] ?? 'my-agent')
      return
    case 'validate':
      await validate(args[0] ?? 'agent.json')
      return
    case 'register':
      await register(args[0] ?? 'agent.json')
      return
    case 'dev':
    case 'test':
    case 'simulate':
    case 'package':
    case 'publish':
      console.log(`oq ${command}: available in SDK v1 scaffold. Use "oq validate agent.json" before ${command}.`)
      return
    default:
      usage()
  }
}

async function createAgent(name: string): Promise<void> {
  const dir = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  if (existsSync(dir)) throw new Error(`${dir} already exists`)
  await mkdir(join(dir, 'src'), { recursive: true })
  const agentId = dir
  await writeFile(join(dir, 'agent.json'), `${JSON.stringify({
    id: agentId,
    name: title(agentId),
    version: '0.1.0',
    author: 'Your Name',
    description: 'A specialist financial-intelligence agent for OmniQuantAI.',
    specialization: 'Describe your edge.',
    supportedMarkets: ['omniquant'],
    capabilities: ['equities', 'valuation'],
    pricing: { floorSol: 0.01, suggestedSol: 0.015, currency: 'SOL' },
    dependencies: [],
    requiredData: ['market-price', 'fundamentals'],
    riskLevel: 'medium',
    homepage: '',
    repository: '',
    license: 'MIT',
  }, null, 2)}\n`, 'utf8')
  await writeFile(join(dir, 'src', 'agent.ts'), starterSource(agentId), 'utf8')
  console.log(`Created ${dir}`)
  console.log(`Next: cd ${dir} && oq validate agent.json`)
}

async function validate(path: string): Promise<void> {
  const manifest = await readManifest(path)
  const result = validateAgentManifest(manifest)
  if (!result.ok) {
    console.error(`Invalid manifest:\n- ${result.errors.join('\n- ')}`)
    process.exitCode = 1
    return
  }
  console.log(`Valid agent manifest: ${manifest.id}`)
}

async function register(path: string): Promise<void> {
  const manifest = await readManifest(path)
  const result = validateAgentManifest(manifest)
  if (!result.ok) {
    console.error(`Invalid manifest:\n- ${result.errors.join('\n- ')}`)
    process.exitCode = 1
    return
  }
  const apiUrl = process.env.MARKETPLACE_API_URL
  if (!apiUrl) {
    console.log(`Valid agent manifest: ${manifest.id}`)
    console.log('Set MARKETPLACE_API_URL to register this agent with a marketplace feed server.')
    return
  }
  const client = new MarketplaceClient(apiUrl, process.env.MARKETPLACE_API_TOKEN)
  const response = await client.registerAgent(manifest)
  console.log(JSON.stringify(response, null, 2))
}

async function readManifest(path: string): Promise<AgentManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as AgentManifest
}

function usage(): void {
  console.log(`OmniQuantAI CLI

Usage:
  oq create-agent <name>
  oq validate <agent.json>
  oq register <agent.json>
  oq dev
  oq test
  oq simulate
  oq package
  oq publish
`)
}

function title(value: string): string {
  return value.split('-').map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join(' ')
}

function starterSource(agentId: string): string {
  return `import { FinancialAgent, type MarketContext } from '@omniquant/sdk'
import manifest from '../agent.json' assert { type: 'json' }

export class ${title(agentId).replace(/[^A-Za-z0-9]/g, '')} extends FinancialAgent {
  constructor() {
    super(manifest)
  }

  async evaluate(context: MarketContext) {
    return {
      supported: context.service === 'omniquant',
      confidence: 75,
      rationale: 'This request matches my declared capabilities.',
    }
  }

  async bid(context: MarketContext) {
    return this.createBid(context, {
      priceSol: manifest.pricing.suggestedSol ?? manifest.pricing.floorSol,
      confidence: 75,
      deliveryTimeSeconds: 30,
      reasoning: 'Specialist edge for this market.',
    })
  }

  async generateMemo(context: MarketContext) {
    return this.createMemo(context, {
      recommendation: 'HOLD',
      confidence: 70,
      executiveSummary: 'Replace this with your agent research.',
      disclaimer: 'Not financial advice. Research support only.',
    })
  }
}
`
}

main().catch((error) => {
  console.error((error as Error).message)
  process.exit(1)
})
