-- Replace client-side Stripe OAuth Connect with a pasted secret key per client.
-- Legacy stripe_account_id / stripe_connected_at columns are left in place and
-- unused going forward (existing OAuth-connected clients keep working via the
-- old code path in sync-revenue until they re-key).
alter table clients
  add column if not exists stripe_secret_key_encrypted text,
  add column if not exists stripe_secret_key_masked text,
  add column if not exists stripe_secret_key_valid boolean default false,
  add column if not exists stripe_key_added_at timestamptz,
  add column if not exists stripe_key_last_validated_at timestamptz;
