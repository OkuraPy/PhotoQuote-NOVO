-- G1: give every contract template a {{customer_notes_block}} placeholder, injected right
-- before {{terms_blocks}}. createAgreement fills it with "<h3>NOTES</h3><p>…</p>" (escaped
-- customer note) or '' when the estimate has no note — so old agreements and note-less
-- contracts render exactly as before. fillTemplate blanks unknown keys, so a template that
-- somehow misses this UPDATE keeps working (it just never prints the note).
-- Idempotent: the NOT LIKE guard skips templates already carrying the placeholder, and
-- templates without {{terms_blocks}} are a permanent no-op (replace() finds nothing).
UPDATE public.contract_templates
SET content = replace(content, '{{terms_blocks}}', '{{customer_notes_block}}' || chr(10) || '{{terms_blocks}}')
WHERE content NOT LIKE '%customer_notes_block%';
