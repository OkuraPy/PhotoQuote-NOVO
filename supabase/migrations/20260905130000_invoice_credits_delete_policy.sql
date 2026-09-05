-- Undoing a credit has to be possible: a typo (400 instead of 40) would otherwise mark an invoice
-- paid forever. Unlike a payment — money that really moved — a credit is just a number the owner
-- entered. The owner's ALL policy already covers their own rows; this adds the office member, who
-- can record credits and therefore must be able to take one back.
drop policy if exists "Team office deletes invoice credits" on public.invoice_credits;
create policy "Team office deletes invoice credits" on public.invoice_credits
  for delete using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_credits.invoice_id
        and i.user_id in (select member_owner_ids(array['office']))
    )
  );
