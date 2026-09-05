-- A policy anterior ("FOR ALL ... auth.uid() = user_id") só provava que a LINHA era do usuário, e
-- nunca que a FATURA era. Um autenticado qualquer podia inserir um abatimento numa fatura alheia
-- passando o próprio user_id: o dono nem via a linha (o SELECT também filtra por user_id) e o saldo
-- da fatura dele caía. Provado em produção, com rollback, na revisão de 05/09 — e o mesmo padrão
-- existe em invoice_payments (anotado para uma rodada própria).
drop policy if exists "Users manage own invoice credits" on public.invoice_credits;
create policy "Users manage own invoice credits" on public.invoice_credits
  for all
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.invoices i where i.id = invoice_credits.invoice_id and i.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.invoices i where i.id = invoice_credits.invoice_id and i.user_id = (select auth.uid()))
  );
