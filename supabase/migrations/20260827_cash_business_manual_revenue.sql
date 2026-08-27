-- Cash-based / "blue collar" clients often can't or won't connect Stripe for
-- their own business revenue (they run on cash, not card payments). This
-- lets admin flag a client as cash-based at invite time, which relaxes the
-- onboarding gate's Stripe requirement and switches their revenue tracking
-- to manual monthly entries instead of a Stripe sync.
alter table clients
  add column if not exists is_cash_business boolean not null default false,
  add column if not exists manual_revenue_by_month jsonb not null default '{}'::jsonb;
