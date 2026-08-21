-- Found via a live production schema audit: both tables existed but with
-- fewer columns than schema.sql / their own migration ever specified (same
-- class of gap as messages.client_id and clients.stripe_connected_at —
-- `create table if not exists` is a no-op once the table already exists
-- with a partial column set, so simply re-running the original file
-- would not add these). Purely additive, nullable columns.
alter table reports
  add column if not exists client_id uuid references clients(id) on delete cascade,
  add column if not exists deliverable_id uuid references deliverables(id) on delete set null,
  add column if not exists period text,
  add column if not exists generated_by uuid references profiles(id);

alter table nps_responses
  add column if not exists user_id uuid references profiles(id) on delete set null,
  add column if not exists client_name text;
