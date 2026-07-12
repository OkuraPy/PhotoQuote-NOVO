-- REVISÃO GERAL 12/07 — pacote de higiene do banco (achados dos agentes BANCO/PORTAL).
-- Tudo aqui é correção de defeito ou fechamento de superfície; zero mudança de comportamento
-- para o owner solo e para o portal (caminhos felizes preservados e provados no E2E pós-apply).

------------------------------------------------------------------------------
-- 1) BLOQUEANTE: numeração de estimates.
--    generate_estimate_number() usava LPAD(n,3) — LPAD TRUNCA acima de 999
--    ('1004' -> '100'), e o UNIQUE era GLOBAL: a conta de teste colide no
--    próximo insert (EST-100 já existe) e QUALQUER usuário quebra no nº 1000;
--    com o unique global, o 100º orçamento do 2º usuário também colidiria.
--    Fix: unique por usuário + lpad sem truncar + advisory lock (mata a race
--    do MAX()+1). Remove também o trigger legado adormecido (formato
--    EST-YYYY-NNN) e a função uuid órfã — mesma classe do bug do imposto.
------------------------------------------------------------------------------
alter table public.estimates drop constraint if exists estimates_estimate_number_key;
alter table public.estimates drop constraint if exists estimates_user_number_key;
alter table public.estimates add constraint estimates_user_number_key unique (user_id, estimate_number);

create or replace function public.generate_estimate_number()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  next_num integer;
begin
  -- serializa a numeração por dono (o MAX()+1 sem lock permitia 23505 em inserts simultâneos)
  perform pg_advisory_xact_lock(hashtext('est_num_' || new.user_id::text));
  select coalesce(max(
    case when estimate_number ~ '^EST-[0-9]+$'
    then cast(substring(estimate_number from 5) as integer)
    else 0 end
  ), 0) + 1 into next_num
  from public.estimates
  where user_id = new.user_id;

  -- greatest(): preserva o formato EST-001 e NUNCA trunca (lpad corta acima do alvo)
  new.estimate_number := 'EST-' || lpad(next_num::text, greatest(3, length(next_num::text)), '0');
  return new;
end;
$$;

drop trigger if exists trigger_generate_estimate_number on public.estimates;
drop function if exists public.trigger_generate_estimate_number();
drop function if exists public.generate_estimate_number(uuid);

------------------------------------------------------------------------------
-- 2) FÁBRICA do bug recorrente do service_role (ai_jobs em abril, 5 tabelas de
--    equipe em julho): o revoke de abril alterou os DEFAULT PRIVILEGES — toda
--    tabela nova nascia com service_role sem DML (e anon com TRUNCATE).
--    Corrige o estoque (18 tabelas) e a fábrica.
------------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

-- grant morto (sem policy de INSERT anon; o portal comenta via RPC definer)
revoke insert on public.phase_comments from anon;

------------------------------------------------------------------------------
-- 3) show_values fail-open: COALESCE(show_values, true) exibia o total do
--    orçamento no JSON do portal quando a coluna fosse NULL explícito.
--    Fecha a coluna e troca o default do CASE para false. Também fixa
--    search_path com pg_temp (padrão das funções novas).
------------------------------------------------------------------------------
update public.project_share_tokens set show_values = false where show_values is null;
alter table public.project_share_tokens alter column show_values set default false;
alter table public.project_share_tokens alter column show_values set not null;

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

  -- estimateTotal só com show_values LIGADO — fail-closed (era COALESCE(..., true))
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
    'phases', coalesce(v_phases, '[]'::json)
  );

  return v_result;
end;
$$;

------------------------------------------------------------------------------
-- 4) Comentário de membro: trava author_type (membro logado podia inserir
--    author_type='client' via REST e se passar pelo cliente no chat da obra).
--    O cliente anônimo já era não-forjável (add_client_comment hardcoda).
------------------------------------------------------------------------------
drop policy if exists "Team member comments on assigned phases" on public.phase_comments;
create policy "Team member comments on assigned phases" on public.phase_comments
  for insert to authenticated
  with check (
    project_id in (select member_project_ids())
    and phase_id in (select ph.id from public.project_phases ph
                      where ph.project_id = phase_comments.project_id)
    and author_type = 'contractor'
  );

------------------------------------------------------------------------------
-- 5) Ramos mortos 'admin'/'estimator' nas policies de ESCRITA (roles que não
--    existem mais no CHECK de team_members — office/field). Hoje nunca-verdade;
--    se um dia um role 'admin' nascesse, ligariam escrita em estimates/line_items
--    por fora do gate financeiro. Ficam owner-only (comportamento idêntico ao
--    de hoje). "View projects"/"View media" NÃO são tocadas — o
--    user_has_project_access delas é o que dá leitura ao field atribuído.
------------------------------------------------------------------------------
drop policy if exists "Insert estimates" on public.estimates;
create policy "Insert estimates" on public.estimates
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Update estimates" on public.estimates;
create policy "Update estimates" on public.estimates
  for update
  using (user_id = (select auth.uid()));

drop policy if exists "Insert line items" on public.line_items;
create policy "Insert line items" on public.line_items
  for insert
  with check (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id = (select auth.uid())
  ));

drop policy if exists "Update line items" on public.line_items;
create policy "Update line items" on public.line_items
  for update
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id = (select auth.uid())
  ));

drop policy if exists "Insert media" on public.media;
create policy "Insert media" on public.media
  for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = media.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "Update projects" on public.projects;
create policy "Update projects" on public.projects
  for update
  using (user_id = (select auth.uid()));

-- helpers agora órfãos de policy (get_member_role só existia nos ramos mortos;
-- user_has_team_access saiu de "View clients" na Onda B). Menos superfície definer.
drop function if exists public.get_member_role(uuid);
drop function if exists public.user_has_team_access(uuid);

-- helpers de equipe: EXECUTE de anon fora (todas as policies que os usam são
-- TO authenticated — anon nunca os avalia; advisors reclamavam com razão)
revoke execute on function public.member_owner_ids(text[]) from anon;
revoke execute on function public.member_project_ids() from anon;
revoke execute on function public.financial_owner_ids() from anon;

------------------------------------------------------------------------------
-- 6) sign_agreement: caps e validação (aceitava nome/URL/IP de qualquer
--    tamanho e URL arbitrária — contrato "assinado" com imagem inexistente).
--    Mantém EXECUTE de anon (o portal assina via anon key HOJE; a migração
--    para service-role na Vercel é a Onda C).
------------------------------------------------------------------------------
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
  -- a imagem tem que apontar pro bucket/pasta que o portal realmente usa
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
  where id = v_agreement.id;

  return jsonb_build_object(
    'success', true,
    'agreement_id', v_agreement.id,
    'signed_date', now()
  );
end;
$$;

------------------------------------------------------------------------------
-- 7) Bucket contract-signatures: era file host público irrestrito (INSERT
--    {public} sem pasta/mime/tamanho, via anon key extraível). Fecha para
--    PNG <=512KB dentro de signatures/ — exatamente o que o /api/sign do
--    portal envia; nada muda pro fluxo real.
------------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 524288,
       allowed_mime_types = array['image/png']
 where id = 'contract-signatures';

drop policy if exists "Anyone can upload signatures" on storage.objects;
drop policy if exists "Anon uploads signature into signatures folder" on storage.objects;
create policy "Anon uploads signature into signatures folder" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'contract-signatures'
    and (storage.foldername(name))[1] = 'signatures'
  );

------------------------------------------------------------------------------
-- 8) Perfil do dono p/ membro: a policy dava a LINHA INTEIRA de users (labor
--    rate, margens, plano). O membro só precisa do branding — vira função
--    definer com projeção explícita; a policy morre.
------------------------------------------------------------------------------
drop policy if exists "Team member views owner profile" on public.users;

create or replace function public.get_owner_branding()
returns table (
  id uuid,
  company_name varchar,
  company_address varchar,
  company_phone varchar,
  company_email varchar,
  company_license varchar,
  company_website varchar,
  logo_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.company_name, u.company_address, u.company_phone,
         u.company_email, u.company_license, u.company_website, u.logo_url
    from public.users u
   where u.id in (select public.member_owner_ids());
$$;

revoke all on function public.get_owner_branding() from public;
grant execute on function public.get_owner_branding() to authenticated;

------------------------------------------------------------------------------
-- 9) Miudezas de higiene dos advisors/auditoria
------------------------------------------------------------------------------
-- handle_new_user: cap no company_name vindo do metadata + pg_temp no path
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.users (id, email, company_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data->>'company_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- pg_temp nas definer antigas que só pinavam 'public'
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('add_client_comment', 'next_invoice_number', 'next_receipt_number')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- invariantes de numeração documentadas em constraint (0 duplicatas hoje)
alter table public.invoices drop constraint if exists invoices_user_number_key;
alter table public.invoices add constraint invoices_user_number_key unique (user_id, invoice_number);
alter table public.invoice_payments drop constraint if exists invoice_payments_user_receipt_key;
alter table public.invoice_payments add constraint invoice_payments_user_receipt_key unique (user_id, receipt_number);

-- templates de contrato default eram legíveis por anon (REST cru); vira authenticated-only
drop policy if exists "View contract templates" on public.contract_templates;
create policy "View contract templates" on public.contract_templates
  for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

-- rollback (referência):
--   * numeração: recriar unique global + generate_estimate_number com LPAD 3 (não recomendado)
--   * defaults: ALTER DEFAULT PRIVILEGES ... revoke/grant inversos
--   * policies: corpos anteriores estão em pg_policies do backup/histórico desta migration
