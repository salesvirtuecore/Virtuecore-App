-- Same reasoning as crm_sheet_tab_name: the sync workflows match a sheet
-- row by its email column, matched against the client's own header text
-- exactly. The fresh template and Aqua Jetz's existing sheet both header
-- it "Email", but Science Sphere's pre-existing sheet uses lowercase
-- "email" — this lets the push-to-sheet sync target the real header per
-- client instead of assuming "Email" everywhere.
alter table clients
  add column if not exists crm_sheet_email_column text not null default 'Email';
