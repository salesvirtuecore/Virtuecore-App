-- CRITICAL FIX: handle_new_user() has never set profiles.client_id for a new
-- client signup. Confirmed live: inviting a client creates their `clients`
-- row correctly, but when they actually sign up, the resulting profile gets
-- client_id = null forever — which breaks every client-facing feature in the
-- app for them (Dashboard, Billing, Onboarding, Messages, Web Analytics all
-- key off profile.client_id). This links the new profile to the clients row
-- the admin already created at invite time, matched by contact_email
-- (case-insensitive, most-recently-created match if more than one exists).
create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  safe_role text := case when requested_role = 'admin' then 'client' else requested_role end;
  matched_client_id uuid;
begin
  if safe_role = 'client' then
    select id into matched_client_id
    from public.clients
    where lower(contact_email) = lower(new.email)
    order by created_at desc
    limit 1;
  end if;

  insert into public.profiles (id, email, full_name, role, client_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', safe_role, matched_client_id);
  return new;
end;
$$ language plpgsql security definer
set search_path = public;
