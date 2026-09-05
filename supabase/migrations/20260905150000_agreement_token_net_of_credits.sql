-- BLOQUEANTE achado na revisão de lógica (05/09): a página de ASSINATURA do portal imprimia o
-- valor BRUTO da fatura. O corpo do contrato é congelado com o valor DEVIDO (createAgreement usa
-- invoiceDue), mas esta RPC devolvia i.total cru — o cliente via "Invoice #N • $580.55" no
-- cabeçalho, acima de um contrato dizendo $540.55, na mesma tela em que assina. Dois números para a
-- mesma dívida, no único documento com assinatura.
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
    -- net of credits: same number the contract body was frozen with
    'totalAmount', greatest(
      i.total - coalesce((select sum(ic.amount) from public.invoice_credits ic where ic.invoice_id = i.id), 0),
      0
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
