-- ─────────────────────────────────────────────────────────────────────────────
-- Automated billing system migration
-- Adds support for: saved payment methods, 28-day billing cycles,
-- auto-charging based on Stripe revenue, retry logic, onboarding tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Add billing-related columns to clients
alter table clients
  add column if not exists stripe_customer_id text,
  add column if not exists default_payment_method_id text,
  add column if not exists billing_cycle_anchor_date date,
  add column if not exists next_billing_date date,
  add column if not exists auto_charge_enabled boolean default true,
  add column if not exists billing_model text default 'revenue_share' check (billing_model in ('revenue_share', 'profit_share', 'retainer_only')),
  add column if not exists payment_method_added_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

-- Add billing period tracking to invoices
alter table invoices
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists revenue_snapshot jsonb,
  add column if not exists revenue_amount numeric(12,2) default 0,
  add column if not exists commission_amount numeric(12,2) default 0,
  add column if not exists retainer_amount numeric(12,2) default 0,
  add column if not exists stripe_payment_intent_id text;

-- Update invoice status check to include new statuses
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'overdue', 'auto_charging', 'payment_failed'));

-- Update invoice type constraint
alter table invoices drop constraint if exists invoices_type_check;
alter table invoices add constraint invoices_type_check
  check (type in ('retainer', 'commission', 'auto_billing', 'one_off'));

-- Track billing attempts for retries
create table if not exists billing_attempts (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'final_failed')),
  error_message text,
  stripe_error_code text,
  attempted_at timestamptz default now(),
  next_retry_at timestamptz
);

alter table billing_attempts enable row level security;

create policy "Admins full access to billing_attempts" on billing_attempts
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create index if not exists idx_billing_attempts_retry on billing_attempts(next_retry_at) where status = 'failed';
create index if not exists idx_clients_next_billing on clients(next_billing_date) where auto_charge_enabled = true;

-- Allow clients to read their own billing_attempts (for transparency)
create policy "Clients can read own billing_attempts" on billing_attempts
  for select using (
    client_id in (select client_id from profiles where id = auth.uid())
  );
