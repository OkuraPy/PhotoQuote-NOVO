-- Additive, non-breaking: stores the public URLs of the estimate's source photos.
-- Existing rows + the external Next.js portal are unaffected (new column, default []).
alter table public.projects add column if not exists photo_urls jsonb not null default '[]'::jsonb;
