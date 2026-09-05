-- O contrato é um retrato, como o recibo. O corpo (contract_html) já congela os números na geração,
-- mas o cabeçalho da página de assinatura vinha de uma conta AO VIVO sobre a fatura: abater (ou
-- desfazer um abatimento) depois de assinado mudava o valor exibido acima de um contrato que dizia
-- outro. Esta coluna guarda o total com que o documento foi gerado.
-- NULL = contrato anterior a isto: a RPC cai na conta líquida, como vinha fazendo.
alter table public.agreements add column if not exists total_amount numeric(12,2);

comment on column public.agreements.total_amount is
  'Total com que o contrato foi GERADO (retrato). NULL = contrato antigo, a RPC calcula.';

-- A RPC passa a ler o retrato, caindo na conta líquida só para contratos antigos.
create or replace function public.get_agreement_by_token(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    'totalAmount', coalesce(
      a.total_amount,
      greatest(i.total - coalesce((select sum(ic.amount) from public.invoice_credits ic where ic.invoice_id = i.id), 0), 0)
    ),
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
$function$;

-- Back-fill dos contratos que já existiam (30, sendo 17 assinados). Sem isto a coluna só valeria
-- para os futuros e o bloqueante voltaria pelos antigos. Seguro no momento em que foi aplicado:
-- invoice_credits estava vazia, então invoices.total ainda era o número congelado em cada corpo.
update public.agreements a
   set total_amount = i.total
  from public.invoices i
 where i.id = a.invoice_id
   and a.total_amount is null;
