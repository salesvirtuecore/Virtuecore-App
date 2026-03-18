-- Add Stripe account ID field for client-owned Stripe Connect onboarding
alter table if exists clients
add column if not exists stripe_account_id text;