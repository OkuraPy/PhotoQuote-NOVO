-- B1 (feedback Gladson 07/07): app photo uploads ALWAYS failed with x-upsert:true — storage's
-- upsert path needs SELECT visibility of the (possibly existing) row, and these buckets only had
-- INSERT/UPDATE/DELETE policies. Result: 403 "new row violates row-level security policy" wrapped
-- in HTTP 400 (seen in prod logs from PhotoQuoteAI/28), silently swallowed by createJob since the
-- beginning (the 0/56 photo_urls of the 16/06 audit). Additive + re-runnable.
-- APPLIED to prod 2026-07-08 ~02:00 UTC and PROVEN: upsert twice on the same path → 200/200.
drop policy if exists "Users read own project photos" on storage.objects;
create policy "Users read own project photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-photos' and (auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users read own phase photos" on storage.objects;
create policy "Users read own phase photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'phase-photos' and (auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users read own logo" on storage.objects;
create policy "Users read own logo" on storage.objects
  for select to authenticated
  using (bucket_id = 'company-logos' and (auth.uid())::text = (storage.foldername(name))[1]);
