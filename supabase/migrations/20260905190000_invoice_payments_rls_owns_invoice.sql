-- Mesmo furo corrigido em invoice_credits (20260905170000), aqui na tabela ANTIGA e em uso:
-- a policy só provava que a LINHA era do usuário (auth.uid() = user_id), nunca que a FATURA era.
-- CONFIRMADO em produção (com rollback) antes de mexer: um autenticado qualquer registrava
-- pagamento na fatura de outra pessoa — e o dono não veria a linha (o SELECT também filtra por
-- user_id), só veria a fatura fechar sozinha.
-- Depois da correção, re-testado em produção (com rollback): estranho BARRADO, dono registra e lê
-- normalmente. O acesso do membro OFFICE vem das policies "Team office …", que são PERMISSIVAS e
-- independentes desta — continuam valendo.
drop policy if exists "Users manage own invoice payments" on public.invoice_payments;
create policy "Users manage own invoice payments" on public.invoice_payments
  for all
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and i.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and i.user_id = (select auth.uid()))
  );
