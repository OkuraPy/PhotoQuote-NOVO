-- G3: payment receipts. Each ledger row (invoice_payments) can mint ONE receipt number,
-- RCPT-YYYY-NNNN, per user per year — an exact clone of the hardened invoice numbering
-- (20260616221500): SECURITY DEFINER + auth.uid() so a caller can never bump another user's
-- counter, and a partial unique index as the hard guarantee against duplicates.
-- Legacy invoices marked Paid WITHOUT ledger rows have nothing to attach a receipt to — by design.

ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS receipt_number text;
COMMENT ON COLUMN public.invoice_payments.receipt_number IS
  'Receipt number (RCPT-YYYY-NNNN) minted once per payment on the first "send receipt"; re-issuing reuses it. NULL = no receipt issued yet.';

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_user_receipt_uniq
  ON public.invoice_payments (user_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.receipt_counters (
  user_id uuid NOT NULL,
  year int NOT NULL,
  seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only the SECURITY DEFINER function below touches it (definer bypasses RLS)

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  y int := EXTRACT(year FROM now())::int;
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.receipt_counters (user_id, year, seq)
  VALUES (uid, y, 1)
  ON CONFLICT (user_id, year) DO UPDATE SET seq = receipt_counters.seq + 1
  RETURNING seq INTO n;
  RETURN 'RCPT-' || y::text || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_receipt_number() FROM public;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO authenticated;
