alter table clients
  add column if not exists revenue_share_basis text not null default 'revenue'
    check (revenue_share_basis in ('revenue', 'revenue_minus_ad_spend')),
  add column if not exists manual_costs_by_month jsonb not null default '{}'::jsonb;

alter table invoices
  add column if not exists ad_spend_amount numeric(12,2);
