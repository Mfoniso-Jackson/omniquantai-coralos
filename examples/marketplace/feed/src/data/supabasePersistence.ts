import type {
  AgentBidRecord,
  AgentReputationRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
  InvestmentMemoRecord,
  MarketEventRecord,
  MarketSessionRecord,
  MemoWorkspaceRecord,
  OrganizationSessionRecord,
  OrganizationWorkspaceRecord,
  ResearchRequestRecord,
  SettlementRecord,
  WorkspaceMembershipAuditRecord,
  WorkspaceMembershipRecord,
} from './models.js'

type CollectionRecord =
  | MarketSessionRecord
  | ResearchRequestRecord
  | MarketEventRecord
  | AgentBidRecord
  | InvestmentMemoRecord
  | SettlementRecord
  | AgentReputationRecord
  | GraphNodeRecord
  | GraphEdgeRecord
  | MemoWorkspaceRecord
  | WorkspaceMembershipRecord
  | WorkspaceMembershipAuditRecord
  | OrganizationWorkspaceRecord
  | OrganizationSessionRecord

interface SupabaseTarget {
  table: string
  onConflict: string
  row: Record<string, unknown>
  before?: Array<{ table: string; onConflict: string; row: Record<string, unknown> }>
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function mirrorCollectionRecord(collection: string, record: unknown): Promise<void> {
  const target = targetFor(collection, record as CollectionRecord)
  if (!target || !supabaseConfigured()) return
  try {
    for (const before of target.before ?? []) await upsert(before.table, before.row, before.onConflict)
    await upsert(target.table, target.row, target.onConflict)
  } catch (error) {
    const message = (error as Error).message
    console.error(`[feed] supabase mirror failed collection=${collection}: ${message}`)
    if (process.env.SUPABASE_STRICT === '1') throw error
  }
}

export function targetFor(collection: string, record: CollectionRecord): SupabaseTarget | undefined {
  switch (collection) {
    case 'market_sessions':
      return {
        table: 'market_sessions',
        onConflict: 'session_id',
        row: {
          session_id: (record as MarketSessionRecord).sessionId,
          namespace: (record as MarketSessionRecord).namespace,
          status: (record as MarketSessionRecord).status,
          current_stage: (record as MarketSessionRecord).currentStage,
          winning_agent_id: (record as MarketSessionRecord).winningAgentId,
          settlement_status: (record as MarketSessionRecord).settlementStatus,
          data_source: (record as MarketSessionRecord).dataSource,
          created_at: (record as MarketSessionRecord).createdAt,
          completed_at: (record as MarketSessionRecord).completedAt,
          updated_at: (record as MarketSessionRecord).updatedAt,
        },
      }
    case 'research_requests':
      return {
        table: 'research_requests',
        onConflict: 'session_id,round',
        row: {
          session_id: (record as ResearchRequestRecord).sessionId,
          round: (record as ResearchRequestRecord).round,
          buyer_id: (record as ResearchRequestRecord).buyerId,
          service: (record as ResearchRequestRecord).service,
          argument: (record as ResearchRequestRecord).argument,
          budget_sol: (record as ResearchRequestRecord).budgetSol,
          asset_symbol: symbolFromArgument((record as ResearchRequestRecord).argument),
          created_at: (record as ResearchRequestRecord).timestamp,
        },
      }
    case 'market_events':
      return {
        table: 'market_events',
        onConflict: 'event_id',
        row: {
          event_id: (record as MarketEventRecord).id,
          session_id: (record as MarketEventRecord).sessionId,
          round: (record as MarketEventRecord).round,
          type: (record as MarketEventRecord).type,
          actor_id: (record as MarketEventRecord).actorId,
          entity_id: (record as MarketEventRecord).entityId,
          payload: (record as MarketEventRecord).payload,
          created_at: (record as MarketEventRecord).timestamp,
        },
      }
    case 'agent_bids': {
      const bid = record as AgentBidRecord
      return {
        table: 'agent_bids',
        onConflict: 'bid_id',
        before: [agentUpsert(bid.sellerId)],
        row: {
          bid_id: bid.id,
          session_id: bid.sessionId,
          round: bid.round,
          seller_id: bid.sellerId,
          bid_price_sol: bid.bidPriceSol,
          confidence: bid.confidence,
          delivery_time_seconds: bid.deliveryTimeSeconds,
          reasoning: bid.reasoning,
          created_at: bid.timestamp,
        },
      }
    }
    case 'investment_memos': {
      const memo = record as InvestmentMemoRecord
      return {
        table: 'investment_memos',
        onConflict: 'memo_id',
        before: memo.agentId ? [agentUpsert(memo.agentId)] : undefined,
        row: {
          memo_id: memo.memoId,
          session_id: memo.sessionId,
          round: memo.round,
          agent_id: memo.agentId,
          question: memo.question,
          recommendation: memo.recommendation,
          confidence: memo.confidence,
          data_sources: memo.dataSources,
          provider_observability: memo.providerObservability,
          memo: memo.memo,
          created_at: memo.createdAt,
        },
      }
    }
    case 'settlements': {
      const settlement = record as SettlementRecord
      return {
        table: 'settlements',
        onConflict: 'settlement_id,status',
        row: {
          settlement_id: settlement.id,
          session_id: settlement.sessionId,
          round: settlement.round,
          status: settlement.status,
          reference: settlement.reference,
          deposit_signature: settlement.depositSignature,
          release_signature: settlement.releaseSignature,
          amount_sol: settlement.amountSol,
          seller_wallet: settlement.sellerWallet,
          explorer_url: explorerLink(settlement.releaseSignature ?? settlement.depositSignature),
          created_at: settlement.timestamp,
        },
      }
    }
    case 'agent_reputation': {
      const reputation = record as AgentReputationRecord
      return {
        table: 'agent_reputation',
        onConflict: 'reputation_id',
        before: [agentUpsert(reputation.agentId, reputation.specialization)],
        row: {
          reputation_id: reputation.id,
          session_id: reputation.sessionId,
          agent_id: reputation.agentId,
          jobs_completed: reputation.jobsCompleted,
          wins: reputation.wins,
          revenue_sol: reputation.revenueSol,
          win_rate: reputation.winRate,
          average_confidence: reputation.averageConfidence,
          average_delivery_time_seconds: reputation.averageDeliveryTimeSeconds,
          market_domain: reputation.marketDomain,
          created_at: reputation.timestamp,
        },
      }
    }
    case 'graph_nodes':
      return {
        table: 'financial_graph_nodes',
        onConflict: 'node_id',
        row: {
          node_id: (record as GraphNodeRecord).id,
          session_id: (record as GraphNodeRecord).sessionId,
          type: (record as GraphNodeRecord).type,
          label: (record as GraphNodeRecord).label,
          entity_id: (record as GraphNodeRecord).entityId,
          properties: (record as GraphNodeRecord).properties,
          created_at: (record as GraphNodeRecord).timestamp,
        },
      }
    case 'graph_edges':
      return {
        table: 'financial_graph_edges',
        onConflict: 'edge_id',
        row: {
          edge_id: (record as GraphEdgeRecord).id,
          session_id: (record as GraphEdgeRecord).sessionId,
          from_node: (record as GraphEdgeRecord).from,
          to_node: (record as GraphEdgeRecord).to,
          type: (record as GraphEdgeRecord).type,
          properties: (record as GraphEdgeRecord).properties,
          created_at: (record as GraphEdgeRecord).timestamp,
        },
      }
    case 'memo_workspace': {
      const workspace = record as MemoWorkspaceRecord
      return {
        table: 'memo_workspaces',
        onConflict: 'session_id',
        row: {
          workspace_id: workspace.id,
          session_id: workspace.sessionId,
          memo_id: workspace.memoId,
          review_status: workspace.reviewStatus,
          note: workspace.note,
          reviewer: workspace.reviewer,
          export_ready: workspace.exportReady,
          export_history: workspace.exportHistory,
          created_at: workspace.createdAt,
          updated_at: workspace.updatedAt,
        },
      }
    }
    case 'workspace_memberships': {
      const membership = record as WorkspaceMembershipRecord
      return {
        table: 'workspace_memberships',
        onConflict: 'membership_id',
        row: {
          membership_id: membership.id,
          workspace_scope: membership.sessionId,
          publisher_id: membership.publisherId,
          role: membership.role,
          display_name: membership.displayName,
          status: membership.status,
          granted_by: membership.grantedBy,
          granted_at: membership.grantedAt,
          updated_at: membership.updatedAt,
        },
      }
    }
    case 'workspace_membership_audit': {
      const audit = record as WorkspaceMembershipAuditRecord
      return {
        table: 'workspace_membership_audit',
        onConflict: 'audit_id',
        row: {
          audit_id: audit.id,
          workspace_scope: audit.sessionId,
          publisher_id: audit.publisherId,
          action: audit.action,
          from_role: audit.fromRole,
          to_role: audit.toRole,
          from_status: audit.fromStatus,
          to_status: audit.toStatus,
          actor: audit.actor,
          display_name: audit.displayName,
          created_at: audit.timestamp,
        },
      }
    }
    case 'organization_workspaces': {
      const organization = record as OrganizationWorkspaceRecord
      return {
        table: 'organization_workspaces',
        onConflict: 'organization_id',
        row: {
          organization_id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          created_by: organization.createdBy,
          created_at: organization.createdAt,
          updated_at: organization.updatedAt,
        },
      }
    }
    case 'organization_sessions': {
      const assignment = record as OrganizationSessionRecord
      return {
        table: 'organization_sessions',
        onConflict: 'session_id',
        row: {
          assignment_id: assignment.id,
          organization_id: assignment.organizationId,
          session_id: assignment.sessionId,
          assigned_by: assignment.assignedBy,
          assigned_at: assignment.assignedAt,
          updated_at: assignment.updatedAt,
        },
      }
    }
    default:
      return undefined
  }
}

function agentUpsert(agentId: string, specialization = agentId): { table: string; onConflict: string; row: Record<string, unknown> } {
  return {
    table: 'agents',
    onConflict: 'agent_id',
    row: {
      agent_id: agentId,
      display_name: displayName(agentId),
      specialization,
      registry_status: 'active',
      updated_at: new Date().toISOString(),
    },
  }
}

async function upsert(table: string, row: Record<string, unknown>, onConflict: string): Promise<void> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !serviceRoleKey) return
  const res = await fetch(`${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(stripUndefined(row)),
  })
  if (!res.ok) throw new Error(`supabase ${table} ${res.status}: ${(await res.text()).slice(0, 240)}`)
}

function stripUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))
}

function symbolFromArgument(argument: string): string | undefined {
  if (/nvda|nvidia/i.test(argument)) return 'NVDA'
  return argument.split(/[-_\s:]/)[0]?.toUpperCase()
}

function explorerLink(signature?: string): string | undefined {
  return signature ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : undefined
}

function displayName(agentId: string): string {
  return agentId.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
