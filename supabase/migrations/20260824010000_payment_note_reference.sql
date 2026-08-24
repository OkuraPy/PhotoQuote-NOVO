-- Onda G / G-6 — "quando o cara paga em cheque a gente coloca o número do cheque, e o nome do
-- banco… ou um campo observação. Seria bom sair no recibo do cliente." (Gladson, 31/07)
--
-- invoice_payments ALREADY had a `note` column, created with the table and never used (0 of 23
-- rows filled in production; neither v2 nor the legacy v1 code ever wrote it). So this is not a
-- new column — it is that one finally getting a meaning, a length limit and a comment. Adding a
-- second free-text column next to an empty one would have been the sloppy version.
--
-- The field is CLIENT-FACING: it prints on the receipt PDF, and the app labels it "Reference"
-- with the hint "Check #1234 · Chase". No policy work needed — invoice_payments already carries
-- the owner/office policies from the Onda E office pass, and a column inherits them.
comment on column public.invoice_payments.note is
  'Client-facing payment reference/note (check number, bank). Printed on the receipt PDF.';

-- Keep it a one-liner: it lands inside a PDF table row, and a pasted wall of text would break
-- the receipt layout. 120 chars is generous for "Check #1234 · Chase Bank".
alter table public.invoice_payments drop constraint if exists invoice_payments_note_len;
alter table public.invoice_payments
  add constraint invoice_payments_note_len check (note is null or char_length(note) <= 120);
