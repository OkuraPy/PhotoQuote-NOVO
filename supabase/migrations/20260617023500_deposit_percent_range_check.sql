-- Review hardening (Phase C): the deposit % is clamped 0–100 in the UI, but add a DB CHECK as a
-- defense in depth so a bad value (e.g. 200% → negative balance) can never be stored directly.
ALTER TABLE public.users
  ADD CONSTRAINT users_deposit_pct_range CHECK (default_deposit_percent IS NULL OR default_deposit_percent BETWEEN 0 AND 100);
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_deposit_pct_range CHECK (deposit_percent IS NULL OR deposit_percent BETWEEN 0 AND 100);
