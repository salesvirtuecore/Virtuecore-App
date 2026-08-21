-- The original "Clients can read/write own messages" policy referenced
-- messages.client_id, which didn't exist on the live table until the
-- messages.client_id fix earlier in this session — so CREATE POLICY would
-- have failed silently when schema.sql originally ran, leaving RLS enabled
-- on messages with no working client-facing policy at all (only whatever
-- admin policy existed, if any). Confirmed live: a client got "new row
-- violates row-level security policy" trying to send their own message.
drop policy if exists "Admins full access to messages" on messages;
create policy "Admins full access to messages" on messages
  for all using (get_my_role() = 'admin');

drop policy if exists "Clients can read/write own messages" on messages;
create policy "Clients can read/write own messages" on messages
  for all
  using (client_id = get_my_client_id())
  with check (client_id = get_my_client_id());
