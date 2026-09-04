-- Per-client Calendly connection. Each client connects their OWN Calendly
-- account (their own customers book calls with them) — not a single
-- platform-wide calendar. We validate the pasted API key against Calendly,
-- then use it once to create a webhook subscription pointed at
-- /api/webhooks/calendly/<clientId> with a signing key we generate, so a
-- booking's client_id comes directly from the route, never guessed from an
-- email match.
alter table clients
  add column if not exists calendly_api_key_encrypted text,
  add column if not exists calendly_api_key_masked text,
  add column if not exists calendly_webhook_signing_key_encrypted text,
  add column if not exists calendly_webhook_subscription_uri text,
  add column if not exists calendly_organization_uri text,
  add column if not exists calendly_user_uri text,
  add column if not exists calendly_connected_at timestamptz;
