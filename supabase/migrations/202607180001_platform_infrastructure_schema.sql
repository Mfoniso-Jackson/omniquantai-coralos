create extension if not exists pgcrypto;

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  display_name text,
  specialization text,
  registry_status text not null default 'pending' check (registry_status in ('pending', 'active', 'verified', 'suspended')),
  manifest jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists market_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  namespace text not null default 'omniquant',
  status text not null default 'created',
  current_stage text not null default 'SESSION_CREATED',
  winning_agent_id text references agents (agent_id),
  settlement_status text,
  data_source text,
  correlation_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists research_requests (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null,
  buyer_id text not null,
  service text not null,
  argument text not null,
  budget_sol numeric(18, 9),
  asset_symbol text,
  created_at timestamptz not null default now(),
  unique (session_id, round)
);

create table if not exists market_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null default 1,
  type text not null,
  actor_id text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now()
);

create table if not exists agent_bids (
  id uuid primary key default gen_random_uuid(),
  bid_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null,
  seller_id text not null references agents (agent_id),
  bid_price_sol numeric(18, 9) not null,
  confidence numeric(6, 2),
  delivery_time_seconds numeric(10, 2),
  reasoning text,
  created_at timestamptz not null default now()
);

create table if not exists buyer_scores (
  id uuid primary key default gen_random_uuid(),
  score_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null,
  seller_id text not null references agents (agent_id),
  relevance numeric(6, 2),
  confidence numeric(6, 2),
  expected_quality numeric(6, 2),
  domain_fit numeric(6, 2),
  price_score numeric(6, 2),
  speed_score numeric(6, 2),
  reasoning_quality numeric(6, 2),
  total_score numeric(8, 3),
  rationale text,
  created_at timestamptz not null default now()
);

create table if not exists investment_memos (
  id uuid primary key default gen_random_uuid(),
  memo_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null,
  agent_id text references agents (agent_id),
  question text,
  recommendation text,
  confidence numeric(6, 2),
  data_sources jsonb not null default '[]'::jsonb,
  provider_observability jsonb not null default '[]'::jsonb,
  memo jsonb not null,
  object_uri text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id text not null,
  session_id text not null references market_sessions (session_id) on delete cascade,
  round int not null,
  status text not null,
  reference text,
  deposit_signature text,
  release_signature text,
  refund_signature text,
  amount_sol numeric(18, 9),
  seller_wallet text,
  explorer_url text,
  created_at timestamptz not null default now(),
  unique (settlement_id, status)
);

create table if not exists agent_reputation (
  id uuid primary key default gen_random_uuid(),
  reputation_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  agent_id text not null references agents (agent_id),
  jobs_completed int not null default 0,
  wins int not null default 0,
  revenue_sol numeric(18, 9) not null default 0,
  win_rate numeric(8, 4),
  average_confidence numeric(6, 2),
  average_delivery_time_seconds numeric(10, 2),
  verification_rate numeric(8, 4),
  dispute_rate numeric(8, 4),
  market_domain text not null,
  created_at timestamptz not null default now()
);

create table if not exists financial_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  node_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  type text not null,
  label text not null,
  entity_id text not null,
  properties jsonb,
  created_at timestamptz not null default now()
);

create table if not exists financial_graph_edges (
  id uuid primary key default gen_random_uuid(),
  edge_id text not null unique,
  session_id text not null references market_sessions (session_id) on delete cascade,
  from_node text not null,
  to_node text not null,
  type text not null,
  properties jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_sessions_stage on market_sessions (current_stage, updated_at desc);
create index if not exists idx_market_sessions_completed_at on market_sessions (completed_at desc);
create index if not exists idx_research_requests_asset on research_requests (asset_symbol);
create index if not exists idx_market_events_session_time on market_events (session_id, created_at);
create index if not exists idx_market_events_type_time on market_events (type, created_at desc);
create index if not exists idx_agent_bids_session_round on agent_bids (session_id, round);
create index if not exists idx_memos_session_round on investment_memos (session_id, round);
create index if not exists idx_settlements_session_status on settlements (session_id, status);
create index if not exists idx_reputation_agent on agent_reputation (agent_id, created_at desc);
create index if not exists idx_graph_nodes_session on financial_graph_nodes (session_id, type);
create index if not exists idx_graph_edges_session on financial_graph_edges (session_id, type);
