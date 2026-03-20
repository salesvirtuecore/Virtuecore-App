-- Add sender metadata to messages table
alter table messages
  add column if not exists sender_name text,
  add column if not exists sender_role text check (sender_role in ('admin', 'client', 'va'));

-- Push subscriptions table for web push notifications
create table if not exists push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade not null,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Users can only manage their own push subscriptions
create policy "Users manage own push subscriptions"
  on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable realtime on messages table
alter publication supabase_realtime add table messages;
