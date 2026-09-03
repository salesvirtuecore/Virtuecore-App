-- Per-client CRM leads table, backing an auto-provisioned Google Sheet per
-- eligible client (see api/admin/[action].js handleInviteUser + the n8n
-- "Provision Client CRM" workflow). NOT related to `pipeline_leads`, which
-- is VirtueCore's own internal sales pipeline (admin-only, no client_id) —
-- deliberately named differently to avoid any confusion between the two.

create table if not exists client_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  source text,
  package_interest text,
  payment_method text,
  amount numeric(10,2),
  payment_date date,
  total_paid numeric(10,2) default 0,
  status text not null default 'New' check (status in ('New', 'Called', 'Churned', 'Later', 'Paid')),
  notes text,
  -- 'app' = last written by the portal (client or admin); 'sheet' = last
  -- written by the n8n Sheet->Supabase poll. Sync loop-prevention flag only
  -- — never rendered as an editable UI field.
  synced_from text not null default 'app' check (synced_from in ('app', 'sheet')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One lead per (client, email) — matches how the existing per-client Sheet
-- sync workflows already dedupe/match rows. Partial so phone-only/no-email
-- leads aren't forced unique against each other.
create unique index if not exists client_leads_client_email_unique
  on client_leads (client_id, lower(email))
  where email is not null and email <> '';

create index if not exists client_leads_client_id_idx on client_leads (client_id);

-- CRM sheet identity on the clients row, for admin link-outs and n8n
-- provisioning idempotency (skip if crm_provisioned_at is already set).
alter table clients
  add column if not exists crm_sheet_id text,
  add column if not exists crm_sheet_leads_gid text,
  add column if not exists crm_provisioned_at timestamptz;

alter table client_leads enable row level security;

create policy "Admins full access to client_leads" on client_leads
  for all using (get_my_role() = 'admin');

create policy "Clients can read own leads" on client_leads
  for select using (client_id = get_my_client_id());

-- USING/WITH CHECK only gate *which rows* a client can touch — the trigger
-- below is what actually blocks a client editing anything besides
-- status/notes on their own leads.
create policy "Clients can update status/notes on own leads" on client_leads
  for update using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());

-- Enforces: (a) an authenticated non-admin session may only ever change
-- status/notes on a lead row, (b) updated_at is always stamped server-side,
-- (c) a client-originated edit is always tagged synced_from='app' — a
-- client cannot spoof 'sheet' to hide their edit from the Sheet-push sync.
-- auth.uid() is null for service-role callers (n8n's Sheet->Supabase poll),
-- so that path is intentionally NOT restricted here — this table's
-- financial columns are legitimately written by that sync job, not by a
-- logged-in client.
create or replace function client_leads_before_update()
returns trigger as $$
begin
  if auth.uid() is not null and get_my_role() <> 'admin' then
    if new.client_id is distinct from old.client_id
       or new.name is distinct from old.name
       or new.email is distinct from old.email
       or new.phone is distinct from old.phone
       or new.source is distinct from old.source
       or new.package_interest is distinct from old.package_interest
       or new.payment_method is distinct from old.payment_method
       or new.amount is distinct from old.amount
       or new.payment_date is distinct from old.payment_date
       or new.total_paid is distinct from old.total_paid
       or new.created_at is distinct from old.created_at
    then
      raise exception 'Clients may only update status and notes on their own leads';
    end if;
    new.synced_from := 'app';
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists client_leads_before_update_trigger on client_leads;
create trigger client_leads_before_update_trigger
  before update on client_leads
  for each row execute procedure client_leads_before_update();
