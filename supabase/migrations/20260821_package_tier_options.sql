-- Widen the allowed package_tier values to the real package names, while
-- keeping the old Starter/Growth/Premium values valid too (existing client
-- rows already use them — this only adds new options, nothing is removed).
alter table clients drop constraint if exists clients_package_tier_check;
alter table clients add constraint clients_package_tier_check
  check (package_tier in (
    'Starter', 'Growth', 'Premium',
    'Website Only', 'Automations', 'Website + Paid Ads', 'VA Package', 'Full Package'
  ));
