create extension if not exists pgcrypto;

create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  ok boolean not null,
  model text not null,
  prompt_id text,
  payload text,
  output text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scope text not null,
  window_starts_at timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_user_scope_window
  on public.rate_limits(user_id, scope, window_starts_at);
