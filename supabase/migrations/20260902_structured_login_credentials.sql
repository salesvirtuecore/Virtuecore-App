-- Structured login handover: clients enter individual app logins (grouped by
-- shared email/password) instead of only uploading a single doc/link.
-- Passwords are stored encrypted (see api/_lib/crypto.js) — never plaintext.
-- Safe to re-run in full: table uses IF NOT EXISTS, policy is dropped-then-recreated.

create table if not exists client_login_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) not null,
  group_id uuid not null,
  app_name text not null,
  login_email text not null,
  login_password_encrypted text not null,
  notes text,
  submitted_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists client_login_credentials_group_id_idx on client_login_credentials (group_id);

alter table client_login_credentials enable row level security;

drop policy if exists "clients manage own login credentials" on client_login_credentials;
create policy "clients manage own login credentials" on client_login_credentials
  for all to authenticated
  using (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );
