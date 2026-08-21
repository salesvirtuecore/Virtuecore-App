-- Client onboarding video progress + contract/credentials handoff.

create table if not exists client_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) not null,
  step_id text not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique (client_id, step_id)
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) not null,
  file_path text not null,
  file_name text,
  status text default 'submitted' check (status in ('submitted', 'signed', 'archived')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists client_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) not null,
  doc_type text not null check (doc_type in ('file', 'google_doc_link')),
  file_path text,
  external_link text,
  notes text,
  submitted_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table client_onboarding_progress enable row level security;
alter table contracts enable row level security;
alter table client_credentials enable row level security;

create policy "clients manage own onboarding progress" on client_onboarding_progress
  for all to authenticated
  using (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "clients manage own contracts" on contracts
  for all to authenticated
  using (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "clients manage own credentials" on client_credentials
  for all to authenticated
  using (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    client_id = (select client_id from profiles where id = auth.uid())
    or (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Private bucket — unlike the public `deliverables` bucket, contracts and
-- credentials are sensitive and must never be publicly readable by URL.
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "clients insert own documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = (select client_id::text from profiles where id = auth.uid())
  );

create policy "clients and admins select own documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and (
      (storage.foldername(name))[1] = (select client_id::text from profiles where id = auth.uid())
      or (select role from profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "admins manage all documents" on storage.objects
  for update, delete to authenticated
  using (
    bucket_id = 'client-documents'
    and (select role from profiles where id = auth.uid()) = 'admin'
  );
