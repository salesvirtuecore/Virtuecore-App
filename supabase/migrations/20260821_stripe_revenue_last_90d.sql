alter table clients
  add column if not exists stripe_revenue_last_90d numeric(12,2) default 0;
