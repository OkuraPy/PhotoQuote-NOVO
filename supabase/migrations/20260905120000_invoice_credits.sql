-- Credits on an invoice — the mirror of the complementary invoice (G-9).
--
-- Real case (dono, 05/09): a $580.55 invoice for 3 smoke detectors, half already paid by Zelle.
-- On site only 2 fit, one went back to the supplier. The invoice stops following the quote once a
-- payment lands (by design — the client already acted on that document), so the difference stayed
-- as a balance that would never be paid and the job could never close.
--
-- A credit is NOT a payment: no money changed hands. It reduces what is owed while keeping the
-- original billed amount on the record, and carries a reason that prints on the document.
create table if not exists public.invoice_credits (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz default now()
);

create index if not exists invoice_credits_invoice_id_idx on public.invoice_credits(invoice_id);
create index if not exists invoice_credits_user_id_idx on public.invoice_credits(user_id);

alter table public.invoice_credits enable row level security;

-- Same shape as invoice_payments: the owner does everything on their own rows; an OFFICE member
-- reads, records and edits credits on their owner's invoices. Field members see nothing (money).
drop policy if exists "Users manage own invoice credits" on public.invoice_credits;
create policy "Users manage own invoice credits" on public.invoice_credits
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Team office views invoice credits" on public.invoice_credits;
create policy "Team office views invoice credits" on public.invoice_credits
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_credits.invoice_id
        and i.user_id in (select member_owner_ids(array['office']))
    )
  );

drop policy if exists "Team office records invoice credits" on public.invoice_credits;
create policy "Team office records invoice credits" on public.invoice_credits
  for insert with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_credits.invoice_id
        and i.user_id in (select member_owner_ids(array['office']))
    )
  );

drop policy if exists "Team office updates invoice credits" on public.invoice_credits;
create policy "Team office updates invoice credits" on public.invoice_credits
  for update using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_credits.invoice_id
        and i.user_id in (select member_owner_ids(array['office']))
    )
  ) with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_credits.invoice_id
        and i.user_id in (select member_owner_ids(array['office']))
    )
  );
