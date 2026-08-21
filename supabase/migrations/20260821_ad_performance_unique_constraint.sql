-- The Meta insights sync upserts on (client_id, platform, date), but no
-- unique constraint ever existed for that to conflict against — every sync
-- attempt failed with "no unique or exclusion constraint matching the ON
-- CONFLICT specification" and silently wrote zero rows. Table is currently
-- empty so this is safe to add with no existing-data conflicts.
alter table ad_performance
  add constraint ad_performance_client_platform_date_key unique (client_id, platform, date);
