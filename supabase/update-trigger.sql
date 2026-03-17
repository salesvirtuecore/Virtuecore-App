-- Run this in Supabase SQL editor to update the user creation trigger
-- to support client_id from invite metadata

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role, client_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    (new.raw_user_meta_data->>'client_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;
