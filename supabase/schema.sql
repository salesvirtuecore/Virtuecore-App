-- ─────────────────────────────────────────────────────────────────────────────
-- VirtueCore Supabase Schema
-- Run this in the Supabase SQL editor after creating your project
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('admin', 'client', 'va')),
  avatar_url text,
  client_id uuid, -- only set for clients, links to clients table
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'client'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── CLIENTS ──────────────────────────────────────────────────────────────────
create table clients (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text,
  contact_email text,
  package_tier text check (package_tier in ('Starter', 'Growth', 'Premium')),
  monthly_retainer numeric(10,2) default 0,
  revenue_share_percentage numeric(5,2) default 0,
  status text default 'onboarding' check (status in ('active', 'onboarding', 'churned')),
  health_score text default 'green' check (health_score in ('green', 'amber', 'red')),
  onboarding_started_at timestamptz,
  created_at timestamptz default now()
);

-- ─── TASKS ────────────────────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  brief text,
  client_id uuid references clients(id) on delete cascade,
  assigned_va_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  status text default 'not_started' check (status in ('not_started', 'in_progress', 'complete')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  deadline date,
  time_logged_minutes integer default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ─── DELIVERABLES ─────────────────────────────────────────────────────────────
create table deliverables (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  file_url text,
  type text check (type in ('ad_creative', 'content_calendar', 'report', 'website', 'lead_magnet', 'other')),
  status text default 'draft' check (status in ('draft', 'pending_review', 'approved', 'changes_requested')),
  feedback text,
  created_at timestamptz default now()
);

-- ─── MESSAGES ─────────────────────────────────────────────────────────────────
create table messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

-- ─── INVOICES ─────────────────────────────────────────────────────────────────
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  amount numeric(10,2) not null,
  type text check (type in ('retainer', 'commission')),
  status text default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  stripe_invoice_id text,
  due_date date,
  paid_date date,
  created_at timestamptz default now()
);

-- ─── AD PERFORMANCE ───────────────────────────────────────────────────────────
create table ad_performance (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  platform text check (platform in ('meta', 'google')),
  date date not null,
  spend numeric(10,2) default 0,
  impressions integer default 0,
  clicks integer default 0,
  leads integer default 0,
  conversions integer default 0,
  ctr numeric(5,2) default 0,
  cpl numeric(10,2) default 0,
  roas numeric(8,2) default 0,
  created_at timestamptz default now()
);

-- ─── PIPELINE LEADS ───────────────────────────────────────────────────────────
create table pipeline_leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  company text,
  source text,
  score integer default 0,
  stage text default 'captured' check (stage in ('captured', 'call_booked', 'call_completed', 'proposal_sent', 'contract_signed', 'onboarding')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── VA TIME ENTRIES ──────────────────────────────────────────────────────────
create table va_time_entries (
  id uuid primary key default uuid_generate_v4(),
  va_id uuid references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer
);

-- ─── CONTENT CALENDAR ─────────────────────────────────────────────────────────
create table content_calendar (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  platform text,
  post_date date not null,
  content text,
  status text default 'draft' check (status in ('draft', 'scheduled', 'published')),
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table clients enable row level security;
alter table tasks enable row level security;
alter table deliverables enable row level security;
alter table messages enable row level security;
alter table invoices enable row level security;
alter table ad_performance enable row level security;
alter table pipeline_leads enable row level security;
alter table va_time_entries enable row level security;
alter table content_calendar enable row level security;

-- Helper: get current user's role
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: get current user's linked client_id
create or replace function get_my_client_id()
returns uuid as $$
  select client_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ─── PROFILES POLICIES ────────────────────────────────────────────────────────
create policy "Users can read own profile" on profiles
  for select using (id = auth.uid() or get_my_role() = 'admin');

create policy "Users can update own profile" on profiles
  for update using (id = auth.uid());

create policy "Admins can insert profiles" on profiles
  for insert with check (get_my_role() = 'admin');

-- ─── CLIENTS POLICIES ─────────────────────────────────────────────────────────
create policy "Admins can do anything with clients" on clients
  for all using (get_my_role() = 'admin');

create policy "Clients can read own record" on clients
  for select using (id = get_my_client_id());

-- ─── TASKS POLICIES ───────────────────────────────────────────────────────────
create policy "Admins can do anything with tasks" on tasks
  for all using (get_my_role() = 'admin');

create policy "VAs can read assigned tasks" on tasks
  for select using (assigned_va_id = auth.uid() or get_my_role() = 'admin');

create policy "VAs can update assigned tasks" on tasks
  for update using (assigned_va_id = auth.uid());

create policy "Clients can read their tasks" on tasks
  for select using (client_id = get_my_client_id());

-- ─── DELIVERABLES POLICIES ────────────────────────────────────────────────────
create policy "Admins full access to deliverables" on deliverables
  for all using (get_my_role() = 'admin');

create policy "Clients can read own deliverables" on deliverables
  for select using (client_id = get_my_client_id());

create policy "Clients can update status on own deliverables" on deliverables
  for update using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());

create policy "VAs can read all deliverables" on deliverables
  for select using (get_my_role() = 'va');

-- ─── MESSAGES POLICIES ────────────────────────────────────────────────────────
create policy "Admins full access to messages" on messages
  for all using (get_my_role() = 'admin');

create policy "Clients can read/write own messages" on messages
  for all using (client_id = get_my_client_id());

-- ─── INVOICES POLICIES ────────────────────────────────────────────────────────
create policy "Admins full access to invoices" on invoices
  for all using (get_my_role() = 'admin');

create policy "Clients can read own invoices" on invoices
  for select using (client_id = get_my_client_id());

-- ─── AD PERFORMANCE POLICIES ──────────────────────────────────────────────────
create policy "Admins full access to ad_performance" on ad_performance
  for all using (get_my_role() = 'admin');

create policy "Clients can read own ad performance" on ad_performance
  for select using (client_id = get_my_client_id());

-- ─── PIPELINE LEADS POLICIES ──────────────────────────────────────────────────
create policy "Admins full access to pipeline_leads" on pipeline_leads
  for all using (get_my_role() = 'admin');

-- ─── VA TIME ENTRIES POLICIES ─────────────────────────────────────────────────
create policy "Admins full access to time entries" on va_time_entries
  for all using (get_my_role() = 'admin');

create policy "VAs can manage own time entries" on va_time_entries
  for all using (va_id = auth.uid());

-- ─── CONTENT CALENDAR POLICIES ────────────────────────────────────────────────
create policy "Admins full access to content_calendar" on content_calendar
  for all using (get_my_role() = 'admin');

create policy "Clients can read own content calendar" on content_calendar
  for select using (client_id = get_my_client_id());

create policy "VAs can read all content calendar" on content_calendar
  for select using (get_my_role() = 'va');

-- ─── REPORTS (AI-generated) ───────────────────────────────────────────────────
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade,
  deliverable_id uuid references deliverables(id) on delete set null,
  content text not null,
  period text not null,
  generated_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- ─── ACADEMY MODULES ─────────────────────────────────────────────────────────
create table if not exists academy_modules (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  video_url text,
  content_html text,
  order_index integer default 0,
  estimated_minutes integer default 30,
  created_at timestamp with time zone default now()
);

-- ─── QUIZ QUESTIONS ───────────────────────────────────────────────────────────
create table if not exists quiz_questions (
  id uuid default gen_random_uuid() primary key,
  module_id uuid references academy_modules(id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of {id, text}
  correct_option_id text not null,
  explanation text,
  order_index integer default 0
);

-- ─── MODULE COMPLETIONS ───────────────────────────────────────────────────────
create table if not exists module_completions (
  id uuid default gen_random_uuid() primary key,
  va_id uuid references profiles(id) on delete cascade,
  module_id uuid references academy_modules(id) on delete cascade,
  score integer, -- percentage 0-100
  completed boolean default false,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  unique(va_id, module_id)
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text not null, -- 'deliverable_review', 'deliverable_approved', 'message', 'invoice_due'
  title text not null,
  body text,
  read boolean default false,
  meta jsonb, -- { deliverable_id, client_id, etc. }
  created_at timestamp with time zone default now()
);

-- ─── RLS FOR NEW TABLES ───────────────────────────────────────────────────────
alter table reports enable row level security;
alter table academy_modules enable row level security;
alter table quiz_questions enable row level security;
alter table module_completions enable row level security;
alter table notifications enable row level security;

create policy "Admins manage reports" on reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Clients view own reports" on reports for select using (
  client_id in (select id from clients where id = (
    select client_id from profiles where id = auth.uid()
  ))
);
create policy "Academy modules readable by VAs and admins" on academy_modules for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('va', 'admin'))
);
create policy "Admins manage academy" on academy_modules for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Quiz questions readable" on quiz_questions for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('va', 'admin'))
);
create policy "VAs manage own completions" on module_completions for all using (
  va_id = auth.uid()
);
create policy "Admins view all completions" on module_completions for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Users view own notifications" on notifications for all using (
  user_id = auth.uid()
);
