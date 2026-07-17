import type { AgentManifest, AgentRegistration, AgentReputation, BidResponse, Capability, MarketContext, MemoResponse } from './types.js'
import { signedAuthHeaders } from './auth.js'

export interface MarketplaceClientOptions {
  token?: string
  publisherId?: string
}

export class MarketplaceClient {
  private readonly token?: string
  private readonly publisherId?: string

  constructor(
    readonly baseUrl: string,
    tokenOrOptions?: string | MarketplaceClientOptions,
  ) {
    if (typeof tokenOrOptions === 'string') {
      this.token = tokenOrOptions
    } else {
      this.token = tokenOrOptions?.token
      this.publisherId = tokenOrOptions?.publisherId
    }
  }

  async registerAgent(manifest: AgentManifest): Promise<unknown> {
    return this.post('/api/agents/register', manifest)
  }

  async updateAgent(manifest: AgentManifest): Promise<unknown> {
    return this.patch(`/api/agents/${encodeURIComponent(manifest.id)}`, manifest)
  }

  async setAgentStatus(agentId: string, status: AgentRegistration['status']): Promise<unknown> {
    return this.post(`/api/registry/agents/${encodeURIComponent(agentId)}/status`, { status })
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
    const payload = JSON.stringify(body)
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers('POST', path, payload), 'content-type': 'application/json' },
      body: payload,
    })
    if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    const payload = JSON.stringify(body)
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...this.headers('PATCH', path, payload), 'content-type': 'application/json' },
      body: payload,
    })
    if (!res.ok) throw new Error(`Marketplace API ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private headers(method = 'GET', path = '', body = ''): Record<string, string> {
    return signedAuthHeaders({
      method,
      path,
      body,
      secret: this.token,
      publisherId: this.publisherId,
    })
  }
}
