-- The Sheet<->Supabase sync workflows read/write a single named tab per
-- client sheet. The fresh CRM template (and Aqua Jetz's existing sheet)
-- both use "Leads", but Science Sphere's pre-existing sheet splits leads
-- across "Parents"/"Students" tabs instead — hardcoding "Leads" would
-- silently break sync for any client whose sheet doesn't use that name.
alter table clients
  add column if not exists crm_sheet_tab_name text not null default 'Leads';
