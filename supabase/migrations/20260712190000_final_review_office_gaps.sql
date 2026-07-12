-- REVISÃO FINAL INTEGRAL 12/07 — fecha os achados dos auditores de banco e portal:
-- H1/H2: office não tinha policy em agreements/project_share_tokens → 403 ao enviar
--        contrato e ao gerar link de progresso (UI de office usa os caminhos do dono).
-- H3:    next_invoice_number/next_receipt_number chaveavam o contador em auth.uid() —
--        office numeraria fatura do DONO com o contador PRÓPRIO (colisão 23505 na
--        sequência do dono). Agora o contador é do DONO EFETIVO (effective_owner_id).
--        De carona: lpad com greatest() — mesma classe do truncamento da numeração de
--        estimates corrigido na 120000 (INV/RCPT > 9999 no ano não trunca mais).
-- M1(portal): get_agreement_by_token entregava contrato COMPLETO (preços, HTML e o
--        pivô projectToken) para agreement VOID via PostgREST cru — agora status fora
--        de {sent, pending_signature, signed} devolve só {status, companyName}.
--        + rotação do token de teste adivinhável (test_agreement_token_2026_demo).

-- ---------- H1: agreements para office ----------
drop policy if exists "Team office views agreements" on public.agreements;
create policy "Team office views agreements" on public.agreements
  for select to authenticated
  using (user_id in (select member_owner_ids(array['office'])));

drop policy if exists "Team office inserts agreements" on public.agreements;
create policy "Team office inserts agreements" on public.agreements
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (select 1 from public.invoices i where i.id = agreements.invoice_id and i.user_id = agreements.user_id)
    and exists (select 1 from public.projects p where p.id = agreements.project_id and p.user_id = agreements.user_id)
  );

drop policy if exists "Team office updates agreements" on public.agreements;
create policy "Team office updates agreements" on public.agreements
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (select 1 from public.invoices i where i.id = agreements.invoice_id and i.user_id = agreements.user_id)
    and exists (select 1 from public.projects p where p.id = agreements.project_id and p.user_id = agreements.user_id)
  );

-- ---------- H2: share tokens para office ----------
drop policy if exists "Team office manages share tokens" on public.project_share_tokens;
create policy "Team office manages share tokens" on public.project_share_tokens
  for all to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (select 1 from public.projects p where p.id = project_share_tokens.project_id and p.user_id = project_share_tokens.user_id)
  );

-- ---------- A3: office carimba o número do recibo no pagamento ----------
-- (INSERT/SELECT já existiam; sem UPDATE o ensureReceiptNumber gravava 0 linhas em
--  silêncio e o PDF saía com número fantasma)
drop policy if exists "Team office updates invoice payments" on public.invoice_payments;
create policy "Team office updates invoice payments" on public.invoice_payments
  for update to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

-- ---------- H3: contador de numeração pertence ao DONO EFETIVO ----------
create or replace function public.effective_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select tm.owner_id from public.team_members tm
      where tm.member_user_id = auth.uid() and tm.status = 'active' and tm.role = 'office'
      limit 1),
    auth.uid());
$$;
revoke all on function public.effective_owner_id() from public;
grant execute on function public.effective_owner_id() to authenticated;

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := public.effective_owner_id();
  y int := extract(year from now())::int;
  n int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.invoice_counters (user_id, year, seq)
  values (uid, y, 1)
  on conflict (user_id, year) do update set seq = invoice_counters.seq + 1
  returning seq into n;
  return 'INV-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

create or replace function public.next_receipt_number()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := public.effective_owner_id();
  y int := extract(year from now())::int;
  n int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.receipt_counters (user_id, year, seq)
  values (uid, y, 1)
  on conflict (user_id, year) do update set seq = receipt_counters.seq + 1
  returning seq into n;
  return 'RCPT-' || y::text || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

-- ---------- M1 portal: void não entrega mais o contrato via RPC crua ----------
create or replace function public.get_agreement_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
  v_status text;
  v_company text;
begin
  select a.status, u.company_name into v_status, v_company
  from agreements a
  left join public.users u on u.id = a.user_id
  where a.token = p_token;

  if v_status is null then
    return jsonb_build_object('error', 'Agreement not found');
  end if;

  -- não-assinável e não-assinado (void/draft/…): só o mínimo pro portal dizer
  -- "not available" — nada de contrato, total ou pivô de token via REST cru
  if v_status not in ('sent', 'pending_signature', 'signed') then
    return jsonb_build_object('status', v_status, 'companyName', coalesce(v_company, ''));
  end if;

  select jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'contractHtml', a.contract_html,
    'signedName', a.signed_name,
    'signedDate', a.signed_date,
    'signatureImageUrl', a.signature_image_url,
    'clientName', c.full_name,
    'companyName', u.company_name,
    'invoiceNumber', i.invoice_number,
    'totalAmount', i.total,
    'createdAt', a.created_at,
    'projectToken', (
      select pst.token from public.project_share_tokens pst
       where pst.project_id = a.project_id
         and pst.is_active = true
         and (pst.expires_at is null or pst.expires_at > now())
       order by pst.created_at desc
       limit 1
    )
  )
  into v_result
  from agreements a
  join invoices i on i.id = a.invoice_id
  join clients c on c.id = a.client_id
  left join public.users u on u.id = a.user_id
  where a.token = p_token;

  return v_result;
end;
$$;

-- token de teste ADIVINHÁVEL apontando p/ dados reais → rotaciona p/ aleatório
update public.agreements
   set token = 'agr_' || replace(gen_random_uuid()::text, '-', '')
 where token = 'test_agreement_token_2026_demo';
