-- Fix: estimate totals trigger zeroed out tax (and margin).
--
-- Root cause: the `estimates` table has duplicate columns (tax_rate/tax_percent,
-- margin_rate/margin_percent, total/grand_total). The app writes tax_rate/margin_rate,
-- but this trigger read COALESCE(tax_percent, tax_rate). Since tax_percent has a
-- DEFAULT of 0 (never NULL), COALESCE always picked 0 -> tax_amount was always 0,
-- even when the contractor set a 7% rate. Same latent bug for margin.
--
-- This rewrite:
--   1. Reads the rate from the column the app actually writes: COALESCE(tax_rate, tax_percent).
--   2. Applies tax ONLY to taxable line items (the previous version ignored the flag).
--   3. Keeps both naming conventions in sync so they can never diverge again.
--   4. Sets a fixed search_path (security hardening).

CREATE OR REPLACE FUNCTION public.update_estimate_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
  new_subtotal numeric(12,2);
  new_taxable_subtotal numeric(12,2);
  est_rate numeric;
  est_mrate numeric;
  new_tax numeric(12,2);
  new_margin numeric(12,2);
  new_grand_total numeric(12,2);
  target_estimate_id uuid;
BEGIN
  target_estimate_id := COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Subtotal over all line items.
  SELECT COALESCE(SUM(COALESCE(li.subtotal, li.total, li.quantity * li.unit_price)), 0)
    INTO new_subtotal
  FROM line_items li
  WHERE li.estimate_id = target_estimate_id;

  -- Taxable subtotal: only items flagged taxable (NULL treated as taxable, matching app default).
  SELECT COALESCE(SUM(COALESCE(li.subtotal, li.total, li.quantity * li.unit_price)), 0)
    INTO new_taxable_subtotal
  FROM line_items li
  WHERE li.estimate_id = target_estimate_id
    AND COALESCE(li.taxable, true) = true;

  -- Read rates from the columns the app writes, falling back to legacy *_percent.
  SELECT COALESCE(tax_rate, tax_percent, 0),
         COALESCE(margin_rate, margin_percent, 0)
    INTO est_rate, est_mrate
  FROM estimates
  WHERE id = target_estimate_id;

  new_tax := new_taxable_subtotal * (COALESCE(est_rate, 0) / 100);
  new_margin := (new_subtotal + new_tax) * (COALESCE(est_mrate, 0) / 100);
  new_grand_total := new_subtotal + new_tax + new_margin;

  UPDATE estimates
  SET subtotal = new_subtotal,
      tax_amount = new_tax,
      tax_rate = est_rate,
      tax_percent = est_rate,
      margin_amount = new_margin,
      margin_rate = est_mrate,
      margin_percent = est_mrate,
      grand_total = new_grand_total,
      total = new_grand_total,
      updated_at = NOW()
  WHERE id = target_estimate_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
