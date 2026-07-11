-- G1: client-facing note on the quote/invoice/contract. NOT the same field as
-- estimates.notes/estimate_notes — those hold the AI's INTERNAL note in the contractor's own
-- language and must never print on a document. customer_note is written in ENGLISH (documents
-- are always English; the translate-note function helps a pt/es contractor get there) and
-- customer_note_src keeps what the contractor originally typed when a translation was applied.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS customer_note_src text;

COMMENT ON COLUMN public.estimates.customer_note IS
  'Client-facing note printed on the quote/invoice PDF and the contract (always English). Distinct from notes/estimate_notes (internal AI note, contractor language, never printed).';
COMMENT ON COLUMN public.estimates.customer_note_src IS
  'Original text the contractor typed when customer_note came from the AI translation (pt/es → en). NULL when the note was written in English directly.';
