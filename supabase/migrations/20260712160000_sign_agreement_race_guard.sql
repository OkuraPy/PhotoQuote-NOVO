-- 2ª revisão da Onda C (B1): sign_agreement checava o status só no SELECT — dois POSTs
-- simultâneos do MESMO signatário davam ambos "success" (last-write-wins, PNG órfão).
-- Fix: o UPDATE re-exige o status assinável; se ninguém foi atualizado, devolve o erro
-- padrão. Mesma assinatura/retornos — portal não muda.

create or replace function public.sign_agreement(p_token text, p_signed_name text, p_signature_image_url text, p_signed_ip text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_agreement agreements%rowtype;
begin
  if p_signed_name is null or length(trim(p_signed_name)) < 1 or length(p_signed_name) > 120 then
    return jsonb_build_object('error', 'Invalid name');
  end if;
  if p_signature_image_url is null
     or length(p_signature_image_url) > 500
     or position('/contract-signatures/signatures/' in p_signature_image_url) = 0 then
    return jsonb_build_object('error', 'Invalid signature image');
  end if;

  select * into v_agreement from agreements where token = p_token and status in ('sent', 'pending_signature');

  if v_agreement.id is null then
    return jsonb_build_object('error', 'Agreement not found or already signed');
  end if;

  update agreements
  set status = 'signed',
      signed_name = left(trim(p_signed_name), 120),
      signature_image_url = p_signature_image_url,
      signed_date = now(),
      signed_ip = left(coalesce(p_signed_ip, ''), 64),
      updated_at = now()
  where id = v_agreement.id
    and status in ('sent', 'pending_signature'); -- race guard: só o PRIMEIRO commit assina

  if not found then
    return jsonb_build_object('error', 'Agreement not found or already signed');
  end if;

  return jsonb_build_object(
    'success', true,
    'agreement_id', v_agreement.id,
    'signed_date', now()
  );
end;
$$;
