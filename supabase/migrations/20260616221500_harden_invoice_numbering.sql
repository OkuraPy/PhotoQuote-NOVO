-- Review hardening of the invoice numbering added earlier today:
-- 1) The function trusted its p_user argument → any authenticated user could bump another user's
--    counter (cross-tenant tampering). Force the caller's identity via auth.uid() and drop the arg.
-- 2) There was no UNIQUE on invoices.invoice_number → a number could duplicate if the counter ever
--    failed/was tampered. Add a per-user unique index as a hard guarantee.

DROP FUNCTION IF EXISTS public.next_invoice_number(uuid);

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  y int := EXTRACT(year FROM now())::int;
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.invoice_counters (user_id, year, seq)
  VALUES (uid, y, 1)
  ON CONFLICT (user_id, year) DO UPDATE SET seq = invoice_counters.seq + 1
  RETURNING seq INTO n;
  RETURN 'INV-' || y::text || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM public;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_uniq ON public.invoices (user_id, invoice_number);
