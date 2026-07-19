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

export async function readCollectionRecords<T>(collection: string): Promise<T[] | undefined> {
  if (!supabaseConfigured()) return undefined
  const table = readTableFor(collection)
  if (!table) return undefined
  const rows = await selectRows(table)
  return rows.map((row) => recordFromRow(collection, row)).filter(Boolean) as T[]
}

export async function readCollectionRecord<T>(
  collection: string,
  column: string,
  value: string,
): Promise<T[] | undefined> {
  if (!supabaseConfigured()) return undefined
  const table = readTableFor(collection)
  if (!table) return undefined
  const rows = await selectRows(table, { column, value })
  return rows.map((row) => recordFromRow(collection, row)).filter(Boolean) as T[]
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

async function selectRows(table: string, filter?: { column: string; value: string }): Promise<Record<string, unknown>[]> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !serviceRoleKey) return []
  const url = new URL(`${base}/rest/v1/${table}`)
  url.searchParams.set('select', '*')
  if (filter) url.searchParams.set(filter.column, `eq.${filter.value}`)
  const res = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  })
  if (!res.ok) throw new Error(`supabase read ${table} ${res.status}: ${(await res.text()).slice(0, 240)}`)
  return await res.json() as Record<string, unknown>[]
}

function readTableFor(collection: string): string | undefined {
  const target = targetFor(collection, emptyRecordFor(collection))
  return target?.table
}

function recordFromRow(collection: string, row: Record<string, unknown>): CollectionRecord | undefined {
  switch (collection) {
    case 'market_sessions':
      return {
        id: stringField(row.session_id),
        sessionId: stringField(row.session_id),
        namespace: stringField(row.namespace),
        status: stringField(row.status),
        currentStage: stringField(row.current_stage),
        winningAgentId: optionalString(row.winning_agent_id),
        settlementStatus: optionalString(row.settlement_status),
        dataSource: optionalString(row.data_source),
        createdAt: stringField(row.created_at),
        completedAt: optionalString(row.completed_at),
        updatedAt: stringField(row.updated_at),
      } satisfies MarketSessionRecord
    case 'research_requests':
      return {
        id: `${stringField(row.session_id)}:round:${numberField(row.round)}:request`,
        sessionId: stringField(row.session_id),
        round: numberField(row.round),
        buyerId: stringField(row.buyer_id),
        service: stringField(row.service),
        argument: stringField(row.argument),
        budgetSol: numberField(row.budget_sol),
        timestamp: stringField(row.created_at),
      } satisfies ResearchRequestRecord
    case 'agent_bids':
      return {
        id: stringField(row.bid_id),
        sessionId: stringField(row.session_id),
        round: numberField(row.round),
        sellerId: stringField(row.seller_id),
        bidPriceSol: numberField(row.bid_price_sol),
        confidence: optionalNumber(row.confidence),
        deliveryTimeSeconds: optionalNumber(row.delivery_time_seconds),
        reasoning: optionalString(row.reasoning),
        timestamp: stringField(row.created_at),
      } satisfies AgentBidRecord
    case 'investment_memos':
      return {
        id: stringField(row.memo_id),
        sessionId: stringField(row.session_id),
        round: numberField(row.round),
        memoId: stringField(row.memo_id),
        agentId: optionalString(row.agent_id),
        question: optionalString(row.question),
        recommendation: optionalString(row.recommendation),
        confidence: optionalNumber(row.confidence),
        dataSources: arrayField(row.data_sources),
        providerObservability: arrayField(row.provider_observability),
        memo: row.memo ?? {},
        createdAt: stringField(row.created_at),
      } satisfies InvestmentMemoRecord
    case 'settlements':
      return {
        id: stringField(row.settlement_id),
        sessionId: stringField(row.session_id),
        round: numberField(row.round),
        status: settlementStatus(row.status),
        reference: optionalString(row.reference),
        depositSignature: optionalString(row.deposit_signature),
        releaseSignature: optionalString(row.release_signature),
        amountSol: optionalNumber(row.amount_sol),
        sellerWallet: optionalString(row.seller_wallet),
        timestamp: stringField(row.created_at),
      } satisfies SettlementRecord
    case 'market_events':
      return {
        id: stringField(row.event_id),
        sessionId: stringField(row.session_id),
        round: numberField(row.round),
        type: marketEventType(row.type),
        actorId: optionalString(row.actor_id),
        entityId: optionalString(row.entity_id),
        payload: row.payload ?? {},
        timestamp: stringField(row.created_at),
      } satisfies MarketEventRecord
    case 'memo_workspace':
      return {
        id: stringField(row.workspace_id),
        sessionId: stringField(row.session_id),
        memoId: optionalString(row.memo_id),
        reviewStatus: memoReviewStatus(row.review_status),
        note: stringField(row.note),
        reviewer: optionalString(row.reviewer),
        exportReady: Boolean(row.export_ready),
        exportHistory: arrayField(row.export_history),
        createdAt: stringField(row.created_at),
        updatedAt: stringField(row.updated_at),
      } satisfies MemoWorkspaceRecord
    case 'workspace_memberships':
      return {
        id: stringField(row.membership_id),
        sessionId: stringField(row.workspace_scope),
        publisherId: stringField(row.publisher_id),
        role: workspaceRole(row.role),
        displayName: optionalString(row.display_name),
        status: row.status === 'revoked' ? 'revoked' : 'active',
        grantedBy: optionalString(row.granted_by),
        grantedAt: stringField(row.granted_at),
        updatedAt: stringField(row.updated_at),
      } satisfies WorkspaceMembershipRecord
    case 'workspace_membership_audit':
      return {
        id: stringField(row.audit_id),
        sessionId: stringField(row.workspace_scope),
        publisherId: stringField(row.publisher_id),
        action: membershipAuditAction(row.action),
        fromRole: optionalWorkspaceRole(row.from_role),
        toRole: optionalWorkspaceRole(row.to_role),
        fromStatus: optionalMembershipStatus(row.from_status),
        toStatus: optionalMembershipStatus(row.to_status) ?? 'active',
        actor: optionalString(row.actor),
        displayName: optionalString(row.display_name),
        timestamp: stringField(row.created_at),
      } satisfies WorkspaceMembershipAuditRecord
    case 'organization_workspaces':
      return {
        id: stringField(row.organization_id),
        name: stringField(row.name),
        slug: stringField(row.slug),
        status: row.status === 'archived' ? 'archived' : 'active',
        createdBy: optionalString(row.created_by),
        createdAt: stringField(row.created_at),
        updatedAt: stringField(row.updated_at),
      } satisfies OrganizationWorkspaceRecord
    case 'organization_sessions':
      return {
        id: stringField(row.assignment_id),
        organizationId: stringField(row.organization_id),
        sessionId: stringField(row.session_id),
        assignedBy: optionalString(row.assigned_by),
        assignedAt: stringField(row.assigned_at),
        updatedAt: stringField(row.updated_at),
      } satisfies OrganizationSessionRecord
    default:
      return undefined
  }
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

function emptyRecordFor(collection: string): CollectionRecord {
  const now = new Date().toISOString()
  switch (collection) {
    case 'market_sessions':
      return { id: '', sessionId: '', namespace: '', status: '', currentStage: '', createdAt: now, updatedAt: now } satisfies MarketSessionRecord
    case 'research_requests':
      return { id: '', sessionId: '', round: 0, buyerId: '', service: '', argument: '', budgetSol: 0, timestamp: now } satisfies ResearchRequestRecord
    case 'agent_bids':
      return { id: '', sessionId: '', round: 0, sellerId: '', bidPriceSol: 0, timestamp: now } satisfies AgentBidRecord
    case 'investment_memos':
      return { id: '', sessionId: '', round: 0, memoId: '', dataSources: [], providerObservability: [], memo: {}, createdAt: now } satisfies InvestmentMemoRecord
    case 'settlements':
      return { id: '', sessionId: '', round: 0, status: 'REQUESTED', timestamp: now } satisfies SettlementRecord
    case 'market_events':
      return { id: '', sessionId: '', round: 0, type: 'SessionCreated', payload: {}, timestamp: now } satisfies MarketEventRecord
    case 'agent_reputation':
      return { id: '', sessionId: '', agentId: '', jobsCompleted: 0, wins: 0, revenueSol: 0, winRate: 0, marketDomain: '', timestamp: now } satisfies AgentReputationRecord
    case 'graph_nodes':
      return { id: '', sessionId: '', type: '', label: '', entityId: '', timestamp: now } satisfies GraphNodeRecord
    case 'graph_edges':
      return { id: '', sessionId: '', from: '', to: '', type: '', timestamp: now } satisfies GraphEdgeRecord
    case 'memo_workspace':
      return { id: '', sessionId: '', reviewStatus: 'Needs Review', note: '', exportReady: false, exportHistory: [], createdAt: now, updatedAt: now } satisfies MemoWorkspaceRecord
    case 'workspace_memberships':
      return { id: '', sessionId: '', publisherId: '', role: 'viewer', status: 'active', grantedAt: now, updatedAt: now } satisfies WorkspaceMembershipRecord
    case 'workspace_membership_audit':
      return { id: '', sessionId: '', publisherId: '', action: 'role_changed', toStatus: 'active', timestamp: now } satisfies WorkspaceMembershipAuditRecord
    case 'organization_workspaces':
      return { id: '', name: '', slug: '', status: 'active', createdAt: now, updatedAt: now } satisfies OrganizationWorkspaceRecord
    case 'organization_sessions':
      return { id: '', organizationId: '', sessionId: '', assignedAt: now, updatedAt: now } satisfies OrganizationSessionRecord
    default:
      return { id: '', sessionId: '', namespace: '', status: '', currentStage: '', createdAt: now, updatedAt: now } satisfies MarketSessionRecord
  }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function optionalString(value: unknown): string | undefined {
  const text = stringField(value).trim()
  return text ? text : undefined
}

function numberField(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = numberField(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function arrayField<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function settlementStatus(value: unknown): SettlementRecord['status'] {
  if (value === 'DEPOSITED' || value === 'VERIFIED' || value === 'RELEASED' || value === 'REFUNDED') return value
  return 'REQUESTED'
}

function marketEventType(value: unknown): MarketEventRecord['type'] {
  const valid: MarketEventRecord['type'][] = [
    'SessionCreated',
    'WantBroadcast',
    'BidSubmitted',
    'WinnerSelected',
    'EscrowRequested',
    'SettlementInitiated',
    'MemoGenerated',
    'VerificationPassed',
    'VerificationFailed',
    'SettlementCompleted',
    'MarketClosed',
    'ReputationUpdated',
  ]
  return valid.includes(value as MarketEventRecord['type']) ? value as MarketEventRecord['type'] : 'SessionCreated'
}

function memoReviewStatus(value: unknown): MemoWorkspaceRecord['reviewStatus'] {
  if (value === 'Approved' || value === 'Watchlist' || value === 'Rejected') return value
  return 'Needs Review'
}

function workspaceRole(value: unknown): WorkspaceMembershipRecord['role'] {
  if (value === 'owner' || value === 'admin' || value === 'editor') return value
  return 'viewer'
}

function optionalWorkspaceRole(value: unknown): WorkspaceMembershipRecord['role'] | undefined {
  return value === undefined || value === null ? undefined : workspaceRole(value)
}

function optionalMembershipStatus(value: unknown): WorkspaceMembershipRecord['status'] | undefined {
  if (value === 'active' || value === 'revoked') return value
  return undefined
}

function membershipAuditAction(value: unknown): WorkspaceMembershipAuditRecord['action'] {
  if (value === 'invited' || value === 'promoted' || value === 'demoted' || value === 'revoked' || value === 'restored') return value
  return 'role_changed'
}
