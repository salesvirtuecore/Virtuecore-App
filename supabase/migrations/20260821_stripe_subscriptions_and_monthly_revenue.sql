alter table clients
  add column if not exists stripe_revenue_by_month jsonb not null default '{}'::jsonb,
  add column if not exists stripe_active_subscriptions integer not null default 0,
  add column if not exists stripe_mrr numeric(12,2) not null default 0,
  add column if not exists stripe_customer_count integer not null default 0;
