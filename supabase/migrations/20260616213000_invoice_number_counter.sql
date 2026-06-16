-- Atomic, per-user, per-year invoice numbering — replaces the racy client-side count+1
-- (which could duplicate numbers under concurrency or collide after a delete).
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  user_id uuid NOT NULL,
  year int NOT NULL,
  seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only the SECURITY DEFINER function below touches it (definer bypasses RLS)

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  y int := EXTRACT(year FROM now())::int;
  n int;
BEGIN
  INSERT INTO public.invoice_counters (user_id, year, seq)
  VALUES (p_user, y, 1)
  ON CONFLICT (user_id, year) DO UPDATE SET seq = invoice_counters.seq + 1
  RETURNING seq INTO n;
  RETURN 'INV-' || y::text || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;

-- Seed: continue each user's existing sequence so new numbers never collide with already-minted ones.
-- Use the greater of (count of invoices) and (max INV-YYYY-NNNN suffix) per user.
INSERT INTO public.invoice_counters (user_id, year, seq)
SELECT
  i.user_id,
  EXTRACT(year FROM now())::int AS year,
  GREATEST(
    COUNT(*)::int,
    COALESCE(MAX(NULLIF(regexp_replace(i.invoice_number, '^INV-\d{4}-(\d+)$', '\1'), i.invoice_number)::int), 0)
  ) AS seq
FROM public.invoices i
GROUP BY i.user_id
ON CONFLICT (user_id, year) DO UPDATE SET seq = GREATEST(invoice_counters.seq, EXCLUDED.seq);
