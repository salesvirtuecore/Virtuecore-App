-- Netlify site id per website, mirroring the existing GA4/Meta Pixel manual-entry
-- pattern. Real deploy/traffic data is deferred until a Netlify API token exists.
alter table client_websites
  add column if not exists netlify_site_id text;
