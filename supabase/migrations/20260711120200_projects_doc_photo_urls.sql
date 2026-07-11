-- G2: which job photos print on the quote PDF. A curated SUBSET of projects.photo_urls
-- (jsonb array of URL strings, same format — builds 28-30 in the field read [0] as a string).
-- Default '[]'; createJob seeds it with the first 4 uploaded photos (owner's decision: ON by
-- default) and the app's photo strip edits it, capped at 6.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS doc_photo_urls jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.projects.doc_photo_urls IS
  'Photos selected to print on the quote document (G2): jsonb array of URL strings, subset of photo_urls, max 6. Seeded with the first 4 photos on job creation.';
