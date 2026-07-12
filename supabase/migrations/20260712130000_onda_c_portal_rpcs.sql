-- ONDA C — portal do cliente: campos aditivos nos RPCs de share token.
-- (1) get_agreement_by_token passa a devolver signatureImageUrl (para a página do contrato
--     ASSINADO mostrar a assinatura) e projectToken (link para a página de progresso da obra).
--     signed_ip NUNCA sai para o browser.
-- (2) get_project_by_share_token passa a devolver agreementToken/agreementStatus (link
--     progresso -> contrato). Corpo idêntico ao da 20260712120000 + os 2 campos.

create or replace function public.get_agreement_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
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
       limit 1
    )
  )
  into v_result
  from agreements a
  join invoices i on i.id = a.invoice_id
  join clients c on c.id = a.client_id
  left join public.users u on u.id = a.user_id
  where a.token = p_token;

  if v_result is null then
    return jsonb_build_object('error', 'Agreement not found');
  end if;

  return v_result;
end;
$$;

create or replace function public.get_project_by_share_token(p_token text)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_token_row record;
  v_project record;
  v_contractor record;
  v_client record;
  v_phases json;
  v_agreement record;
  v_result json;
begin
  select * into v_token_row
  from project_share_tokens
  where token = p_token
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    return null;
  end if;

  update project_share_tokens
  set last_accessed_at = now()
  where id = v_token_row.id;

  select * into v_project
  from projects
  where id = v_token_row.project_id;

  if not found then
    return null;
  end if;

  select * into v_contractor
  from users
  where id = v_project.user_id;

  select * into v_client
  from clients
  where id = v_project.client_id;

  -- contrato mais recente "com cara de contrato" (enviado/pendente/assinado) para o cross-link
  select ag.token, ag.status into v_agreement
    from agreements ag
   where ag.project_id = v_token_row.project_id
     and ag.status in ('sent', 'pending_signature', 'signed')
   order by ag.created_at desc
   limit 1;

  select json_agg(phase_data order by phase_data.phase_order) into v_phases
  from (
    select
      pp.id,
      pp.name,
      pp.phase_order,
      pp.status,
      coalesce(pp.notes, '') as notes,
      pp.expected_completion_date,
      pp.actual_completion_date,
      pp.is_visible_to_client,
      coalesce(
        (select json_agg(photo_row order by photo_row.display_order)
         from (
           select ph.id, ph.file_url, coalesce(ph.caption, '') as caption, ph.display_order, ph.created_at
           from phase_photos ph
           where ph.phase_id = pp.id
         ) photo_row),
        '[]'::json
      ) as photos,
      coalesce(
        (select json_agg(comment_row order by comment_row.created_at)
         from (
           select pc.id, pc.author_type, coalesce(pc.author_name, '') as author_name, pc.content, pc.created_at
           from phase_comments pc
           where pc.phase_id = pp.id
         ) comment_row),
        '[]'::json
      ) as comments
    from project_phases pp
    where pp.project_id = v_token_row.project_id
      and pp.is_visible_to_client = true
  ) phase_data;

  v_result := json_build_object(
    'projectName', v_project.name,
    'clientName', coalesce(v_client.full_name, ''),
    'contractorName', coalesce(v_contractor.company_name, ''),
    'contractorLogo', v_contractor.logo_url,
    'contractorPhone', coalesce(v_contractor.company_phone, ''),
    'contractorEmail', coalesce(v_contractor.email, ''),
    'address', coalesce(v_project.address, ''),
    'city', coalesce(v_project.city, ''),
    'zip', coalesce(v_project.zip, ''),
    'status', coalesce(v_project.status, ''),
    'activatedAt', v_project.activated_at,
    'showValues', v_token_row.show_values,
    'estimateTotal', case when coalesce(v_token_row.show_values, false)
      then (select total from estimates where id = v_project.activated_estimate_id)
      else null end,
    'agreementToken', v_agreement.token,
    'agreementStatus', v_agreement.status,
    'phases', coalesce(v_phases, '[]'::json)
  );

  return v_result;
end;
$$;
