create extension if not exists pgcrypto;

create table if not exists market_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  namespace text not null default 'omniquant',
  status text not null,
  current_stage text not null,
  winning_agent_id text,
  settlement_status text,
  data_source text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (session_id)
);

create table if not exists research_requests (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  round int not null,
  buyer_id text not null,
  service text not null,
  argument text not null,
  budget_sol numeric(18, 9),
  asset_symbol text,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  unique (session_id, round)
);

create table if not exists market_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  session_id text not null,
  round int not null,
  type text not null,
  actor_id text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  foreign key (seller_id) references agents (agent_id)
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  display_name text,
  specialization text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists agent_bids (
  id uuid primary key default gen_random_uuid(),
  bid_id text not null unique,
  session_id text not null,
  round int not null,
  seller_id text not null,
  bid_price_sol numeric(18, 9) not null,
  confidence numeric(6, 2),
  delivery_time_seconds numeric(10, 2),
  reasoning text,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  foreign key (seller_id) references agents (agent_id)
);

create table if not exists winners (
  id uuid primary key default gen_random_uuid(),
  winner_id text not null unique,
  session_id text not null,
  round int not null,
  seller_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  foreign key (agent_id) references agents (agent_id)
);

create table if not exists market_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null unique,
  session_id text not null,
  symbol text not null,
  data_mode text not null,
  provider text not null,
  price numeric(24, 8),
  volatility numeric(12, 6),
  liquidity text,
  summary text,
  captured_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  foreign key (agent_id) references agents (agent_id)
);

create table if not exists investment_memos (
  id uuid primary key default gen_random_uuid(),
  memo_id text not null unique,
  session_id text not null,
  round int not null,
  agent_id text,
  question text,
  recommendation text,
  confidence numeric(6, 2),
  data_sources jsonb not null default '[]'::jsonb,
  provider_observability jsonb not null default '[]'::jsonb,
  memo jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (session_id) references market_sessions (session_id)
);

create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  verification_id text not null unique,
  session_id text not null,
  round int not null,
  status text not null,
  score numeric(6, 2),
  decision text,
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id)
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_id text not null,
  session_id text not null,
  round int not null,
  status text not null,
  reference text,
  deposit_signature text,
  release_signature text,
  amount_sol numeric(18, 9),
  seller_wallet text,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  unique (settlement_id, status)
);

create table if not exists explorer_transactions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  settlement_id text not null,
  kind text not null check (kind in ('deposit', 'release', 'refund')),
  signature text not null,
  cluster text not null default 'devnet',
  explorer_url text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id),
  unique (signature, cluster)
);

create table if not exists agent_reputation (
  id uuid primary key default gen_random_uuid(),
  reputation_id text not null unique,
  session_id text not null,
  agent_id text not null,
  jobs_completed int not null default 0,
  wins int not null default 0,
  revenue_sol numeric(18, 9) not null default 0,
  win_rate numeric(8, 4),
  average_confidence numeric(6, 2),
  average_delivery_time_seconds numeric(10, 2),
  verification_rate numeric(8, 4),
  dispute_rate numeric(8, 4),
  market_domain text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id)
);

create table if not exists graph_nodes (
  id uuid primary key default gen_random_uuid(),
  node_id text not null unique,
  session_id text not null,
  type text not null,
  label text not null,
  entity_id text not null,
  properties jsonb,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id)
);

create table if not exists graph_edges (
  id uuid primary key default gen_random_uuid(),
  edge_id text not null unique,
  session_id text not null,
  from_node text not null,
  to_node text not null,
  type text not null,
  properties jsonb,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id)
);

create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  outcome_id text not null unique,
  session_id text not null,
  memo_id text,
  evaluation_window text,
  recommendation text,
  baseline_price numeric(24, 8),
  realized_price numeric(24, 8),
  performance_score numeric(10, 4),
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (session_id) references market_sessions (session_id)
);

create index if not exists idx_market_sessions_session_id on market_sessions (session_id);
create index if not exists idx_market_sessions_completed_at on market_sessions (completed_at desc);
create index if not exists idx_research_requests_asset on research_requests (asset_symbol);
create index if not exists idx_market_events_session_time on market_events (session_id, created_at);
create index if not exists idx_agent_bids_seller on agent_bids (seller_id, created_at desc);
create index if not exists idx_memos_session on investment_memos (session_id, created_at desc);
create index if not exists idx_memos_agent on investment_memos (agent_id, created_at desc);
create index if not exists idx_settlements_session on settlements (session_id, created_at desc);
create index if not exists idx_reputation_agent on agent_reputation (agent_id, created_at desc);
create index if not exists idx_graph_nodes_session on graph_nodes (session_id, type);
create index if not exists idx_graph_edges_session on graph_edges (session_id, type);

create index if not exists idx_research_requests_search
  on research_requests using gin (to_tsvector('english', coalesce(argument, '') || ' ' || coalesce(service, '')));

create index if not exists idx_memos_search
  on investment_memos using gin (to_tsvector('english', coalesce(question, '') || ' ' || coalesce(recommendation, '') || ' ' || memo::text));
