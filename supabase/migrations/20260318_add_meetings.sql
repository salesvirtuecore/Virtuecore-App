-- ─── MEETINGS ─────────────────────────────────────────────────────────────────
-- Stores Calendly booking events received via webhook.
-- Run this in the Supabase SQL editor.

create table if not exists meetings (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete set null,
  calendly_event_uuid text unique,
  calendly_invitee_uuid text,
  event_type_name text,
  invitee_name text,
  invitee_email text,
  start_time timestamptz not null,
  end_time timestamptz,
  join_url text,
  status text default 'active' check (status in ('active', 'canceled')),
  created_at timestamptz default now()
);

-- Clients can only read their own meetings
alter table meetings enable row level security;

create policy "Clients read own meetings"
  on meetings for select
  using (
    client_id in (
      select client_id from profiles where id = auth.uid()
    )
  );

create policy "Service role full access on meetings"
  on meetings for all
  using (auth.role() = 'service_role');
