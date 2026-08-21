-- CRITICAL: profiles is a table shared across multiple products on this
-- Supabase project (its rows carry columns like plan_tier, searches_used_this_week
-- that belong to a different app). Postgres combines multiple PERMISSIVE
-- policies on the same table with OR — so some other app's broader "read
-- all profiles" policy was overriding VirtueCore's own narrower one for
-- everyone, letting any logged-in user (even a brand-new signup) read every
-- other user's email/name/role, including the admin's.
--
-- A RESTRICTIVE policy is the correct tool here: it ANDs against whatever
-- permissive policies exist, so it can only narrow access, never grant new
-- access. This cannot break another app's legitimate functionality on this
-- table — it can only stop profiles.id/email/full_name/role from being
-- over-shared beyond "your own row, or you're an admin".
drop policy if exists "vc_restrict_profile_reads" on profiles;
create policy "vc_restrict_profile_reads" on profiles
  as restrictive
  for select
  using (id = auth.uid() or get_my_role() = 'admin');
