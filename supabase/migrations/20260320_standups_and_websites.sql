-- ─── STANDUPS ──────────────────────────────────────────────────────────────────
create table if not exists standups (
  id uuid primary key default uuid_generate_v4(),
  va_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  yesterday text not null,
  today text not null,
  blockers text,
  created_at timestamptz default now(),
  unique(va_id, date)
);

alter table standups enable row level security;

create policy "Admins full access to standups" on standups
  for all using (get_my_role() = 'admin');

create policy "VAs can read/write own standups" on standups
  for all using (va_id = auth.uid());

-- ─── CLIENT WEBSITES ───────────────────────────────────────────────────────────
create table if not exists client_websites (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  url text not null,
  ga_measurement_id text,
  meta_pixel_id text,
  notes text,
  created_at timestamptz default now()
);

alter table client_websites enable row level security;

create policy "Admins full access to client_websites" on client_websites
  for all using (get_my_role() = 'admin');

create policy "Clients can read own websites" on client_websites
  for select using (client_id = get_my_client_id());
