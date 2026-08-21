-- CRITICAL SECURITY FIX: handle_new_user() previously trusted whatever
-- `role` a client passed in signup metadata (new.raw_user_meta_data->>'role')
-- and inserted it directly via a security-definer trigger, bypassing RLS.
-- Since Signup.jsx accepts ?role=admin as a URL param and forwards it into
-- supabase.auth.signUp()'s metadata, anyone could self-register as a full
-- admin. Self-signup can now only ever produce 'client' or 'va' — 'admin'
-- is silently downgraded to 'client'. New admins must be created by an
-- existing admin directly updating profiles.role (e.g. via the Supabase
-- table editor), not through public signup.
create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  safe_role text := case when requested_role = 'admin' then 'client' else requested_role end;
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', safe_role);
  return new;
end;
$$ language plpgsql security definer;

-- SECOND, MORE DIRECT HOLE: "Users can update own profile" has no WITH CHECK
-- clause, so Postgres defaults it to the same as USING (id = auth.uid()) —
-- meaning any logged-in user could set their OWN role to 'admin' with a
-- single client-side .update() call, no signup trickery required at all.
-- No legitimate code path in the app updates profiles.role, so this trigger
-- silently reverts any role change attempted by a non-admin.
create or replace function prevent_self_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_self_role_escalation_trigger on profiles;
create trigger prevent_self_role_escalation_trigger
  before update on profiles
  for each row execute procedure prevent_self_role_escalation();
