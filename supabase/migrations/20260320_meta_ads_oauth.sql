-- Add Meta Ads OAuth fields to clients table
alter table clients
  add column if not exists meta_access_token text,
  add column if not exists meta_ad_account_id text,
  add column if not exists meta_token_expires_at timestamptz;
