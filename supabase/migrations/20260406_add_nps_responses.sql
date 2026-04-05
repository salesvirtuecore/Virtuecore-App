-- NPS feedback responses from clients
create table if not exists nps_responses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  client_id uuid references clients(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 10),
  comment text,
  client_name text,
  created_at timestamptz default now()
);

alter table nps_responses enable row level security;

create policy "Admins full access to nps_responses" on nps_responses
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Clients can insert own nps_responses" on nps_responses
  for insert with check (user_id = auth.uid());

-- Add facebook_user_id to clients for Meta data deletion callback
alter table clients
  add column if not exists facebook_user_id text;
