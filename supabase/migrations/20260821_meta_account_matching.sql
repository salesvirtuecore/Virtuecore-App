-- Queue for matching Meta ad accounts (pulled via a shared Business Manager
-- System User token) to clients by business name. Nothing beyond an exact
-- normalized name match is ever auto-written to clients.meta_ad_account_id —
-- everything else lands here for a human to confirm or reject.
create table if not exists meta_account_match_queue (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null unique,
  ad_account_name text,
  business_name text,
  suggested_client_id uuid references clients(id),
  suggested_client_name text,
  match_type text check (match_type in ('exact', 'ai_suggested', 'none')),
  confidence_score numeric,
  status text default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table meta_account_match_queue enable row level security;

create policy "admins manage match queue" on meta_account_match_queue
  for all to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');
