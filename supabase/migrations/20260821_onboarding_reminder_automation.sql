alter table clients
  add column if not exists onboarding_reminder_sent_at timestamptz,
  add column if not exists onboarding_reminder_count integer not null default 0,
  add column if not exists onboarding_welcome_sent_at timestamptz;
