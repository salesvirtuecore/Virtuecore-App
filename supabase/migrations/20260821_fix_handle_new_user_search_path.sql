-- Root cause of the "Database error saving new user" 500 (confirmed via
-- Postgres logs: 42P01 "relation profiles does not exist" at the moment of
-- signup failure). handle_new_user() is SECURITY DEFINER and never pinned
-- search_path — an unqualified `profiles` reference can fail to resolve to
-- public.profiles depending on the calling context's search_path, which is
-- exactly what happened here. Fully qualifying the table name AND pinning
-- search_path explicitly (also standard hardening for SECURITY DEFINER
-- functions, to prevent search_path-based hijacking) fixes it for good.
create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  safe_role text := case when requested_role = 'admin' then 'client' else requested_role end;
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', safe_role);
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

-- Same hardening for the other profiles-touching SECURITY DEFINER function
-- added this session, so it can't silently fail the same way.
create or replace function prevent_self_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = public;
