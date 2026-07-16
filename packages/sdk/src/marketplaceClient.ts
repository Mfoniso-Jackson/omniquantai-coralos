import type { AgentManifest, AgentRegistration, AgentReputation, BidResponse, Capability, MarketContext, MemoResponse } from './types.js'

export class MarketplaceClient {
  constructor(
    readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  async registerAgent(manifest: AgentManifest): Promise<unknown> {
    return this.post('/api/agents/register', manifest)
  }

  async updateAgent(manifest: AgentManifest): Promise<unknown> {
    return this.patch(`/api/agents/${encodeURIComponent(manifest.id)}`, manifest)
  }

  async listRegisteredAgents(): Promise<AgentRegistration[]> {
    const body = await this.get('/api/registry/agents') as { agents?: AgentRegistration[] }
    return body.agents ?? []
  }

  async discoverAgents(input: { market?: string; capabilities?: Capability[] } = {}): Promise<AgentRegistration[]> {
    const query = new URLSearchParams()
    if (input.market) query.set('market', input.market)
    if (input.capabilities?.length) query.set('capabilities', input.capabilities.join(','))
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const body = await this.get(`/api/registry/discover${suffix}`) as { agents?: AgentRegistration[] }
    return body.agents ?? []
  }

  async receiveMarket(sessionId: string): Promise<MarketContext> {
    return this.get(`/api/markets/${encodeURIComponent(sessionId)}`) as Promise<MarketContext>
  }

  async submitBid(sessionId: string, bid: BidResponse): Promise<unknown> {
    return this.post(`/api/markets/${encodeURIComponent(sessionId)}/bids`, bid)
  }

  async deliverMemo(sessionId: string, memo: MemoResponse): Promise<unknown> {
    return this.post(`/api/markets/${encodeURIComponent(sessionId)}/memo`, memo)
  }

  async queryReputation(agentId: string): Promise<AgentReputation[]> {
    const body = await this.get(`/api/reputation/${encodeURIComponent(agentId)}`) as { reputation?: AgentReputation[] }
    return body.reputation ?? []
  }

  async queryHistory(agentId: string): Promise<unknown> {
    return this.get(`/api/agents/${encodeURIComponent(agentId)}`)
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() })
    if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private headers(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {}
  }
}
