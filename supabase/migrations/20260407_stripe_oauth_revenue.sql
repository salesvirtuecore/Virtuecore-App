-- Add columns for Stripe Standard OAuth Connect + revenue tracking
alter table clients
  add column if not exists stripe_connected_at timestamptz,
  add column if not exists stripe_total_revenue numeric(12,2) default 0,
  add column if not exists stripe_revenue_synced_at timestamptz;
