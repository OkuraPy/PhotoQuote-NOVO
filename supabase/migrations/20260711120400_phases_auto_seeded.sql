-- G4: phases pre-seeded from the quote's line items. auto_seeded marks the phases the app
-- created from items (1 phase per item, name = item description) so "Sync with quote" can later
-- remove/recreate ONLY those — a manual phase, or any phase with progress/photos/comments, is
-- never touched by the sync. Default false keeps every existing phase counted as manual.
ALTER TABLE public.project_phases
  ADD COLUMN IF NOT EXISTS auto_seeded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_phases.auto_seeded IS
  'TRUE when the phase was created from a quote line item (G4). Sync-with-quote may delete such a phase only while it is still not_started with no photos/comments; manual phases (false) are never auto-removed.';
