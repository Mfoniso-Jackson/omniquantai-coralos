-- OmniQuantAI Supabase persistence schema.
--
-- Run this in the Supabase SQL editor before setting:
--   SUPABASE_URL=https://<project>.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
--
-- The feed server writes through the service-role REST API and falls back to
-- JSONL if Supabase is not configured or temporarily unavailable.

create table if not exists agents (
  agent_id text primary key,
  display_name text not null,
  specialization text not null,
  registry_status text not null default 'active',
  updated_at timestamptz not null default now()
);

create table if not exists market_sessions (
  session_id text primary key,
  namespace text not null,
  status text not null,
  current_stage text not null,
  winning_agent_id text references agents(agent_id),
  settlement_status text,
  data_source text,
  created_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists research_requests (
  session_id text not null references market_sessions(session_id) on delete cascade,
  round integer not null,
  buyer_id text not null,
  service text not null,
  argument text not null,
  budget_sol numeric not null,
  asset_symbol text,
  created_at timestamptz not null,
  primary key (session_id, round)
);

create table if not exists market_events (
  event_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  round integer not null,
  type text not null,
  actor_id text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists agent_bids (
  bid_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  round integer not null,
  seller_id text not null references agents(agent_id),
  bid_price_sol numeric not null,
  confidence numeric,
  delivery_time_seconds integer,
  reasoning text,
  created_at timestamptz not null
);

create table if not exists investment_memos (
  memo_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  round integer not null,
  agent_id text references agents(agent_id),
  question text,
  recommendation text,
  confidence numeric,
  data_sources jsonb not null default '[]'::jsonb,
  provider_observability jsonb not null default '[]'::jsonb,
  memo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists settlements (
  settlement_id text not null,
  session_id text not null references market_sessions(session_id) on delete cascade,
  round integer not null,
  status text not null,
  reference text,
  deposit_signature text,
  release_signature text,
  amount_sol numeric,
  seller_wallet text,
  explorer_url text,
  created_at timestamptz not null,
  primary key (settlement_id, status)
);

create table if not exists agent_reputation (
  reputation_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  agent_id text not null references agents(agent_id),
  jobs_completed integer not null default 0,
  wins integer not null default 0,
  revenue_sol numeric not null default 0,
  win_rate numeric not null default 0,
  average_confidence numeric,
  average_delivery_time_seconds numeric,
  market_domain text not null,
  created_at timestamptz not null
);

create table if not exists financial_graph_nodes (
  node_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  type text not null,
  label text not null,
  entity_id text not null,
  properties jsonb,
  created_at timestamptz not null
);

create table if not exists financial_graph_edges (
  edge_id text primary key,
  session_id text not null references market_sessions(session_id) on delete cascade,
  from_node text not null,
  to_node text not null,
  type text not null,
  properties jsonb,
  created_at timestamptz not null
);

create table if not exists memo_workspaces (
  workspace_id text not null,
  session_id text primary key references market_sessions(session_id) on delete cascade,
  memo_id text,
  review_status text not null default 'Needs Review',
  note text not null default '',
  reviewer text,
  export_ready boolean not null default false,
  export_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists workspace_memberships (
  membership_id text primary key,
  workspace_scope text not null,
  publisher_id text not null,
  role text not null,
  display_name text,
  status text not null default 'active',
  granted_by text,
  granted_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists workspace_membership_audit (
  audit_id text primary key,
  workspace_scope text not null,
  publisher_id text not null,
  action text not null,
  from_role text,
  to_role text,
  from_status text,
  to_status text not null,
  actor text,
  display_name text,
  created_at timestamptz not null
);

create table if not exists organization_workspaces (
  organization_id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists organization_sessions (
  assignment_id text not null,
  organization_id text not null references organization_workspaces(organization_id) on delete cascade,
  -- This projection can be written as soon as a worker receives the real session ID.
  -- The market session projection may arrive moments later from the feed fold, so keep
  -- this link logical instead of enforcing a foreign key here.
  session_id text primary key,
  assigned_by text,
  assigned_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists market_sessions_updated_at_idx on market_sessions(updated_at desc);
create index if not exists research_requests_session_idx on research_requests(session_id, created_at);
create index if not exists market_events_session_idx on market_events(session_id, created_at);
create index if not exists agent_bids_session_idx on agent_bids(session_id, created_at);
create index if not exists investment_memos_session_idx on investment_memos(session_id, created_at);
create index if not exists settlements_session_idx on settlements(session_id, created_at);
create index if not exists memo_workspaces_updated_at_idx on memo_workspaces(updated_at desc);
create index if not exists workspace_memberships_scope_idx on workspace_memberships(workspace_scope, status);
create index if not exists workspace_membership_audit_scope_idx on workspace_membership_audit(workspace_scope, created_at desc);
create index if not exists organization_sessions_org_idx on organization_sessions(organization_id, updated_at desc);
