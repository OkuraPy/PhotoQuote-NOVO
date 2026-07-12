-- ============================================================================
-- ONDA B / Fase 1 — Fundação multi-usuário (owner + field; office = RLS pronta)
-- ============================================================================
-- Fonte: docs/ESTUDO_2026-07-11.md §2 (Opção B "dono continua sendo a chave",
-- aprovada pelo dono). MUDANÇA DE DESIGN aprovada 07/2026: SEM convite por
-- código — o dono cria a conta do funcionário direto pela edge function
-- create-team-member (service role), que insere a membership já ATIVA.
-- Portanto: nada de invite_code / redeem_team_invite aqui.
--
-- DEPENDE de 20260712100000_rls_hygiene_phase0.sql (roda depois por timestamp).
--
-- Invariante de proteção do usuário real (build 30): conta SEM membros ativos
-- percorre exatamente os caminhos atuais — todos os ramos novos dependem de
-- member_owner_ids()/member_project_ids()/financial_owner_ids(), que retornam
-- VAZIO para quem não é membro ativo de ninguém; e as policies substituídas
-- (View clients/estimates/line_items/invoices/invoice_line_items) preservam
-- bit a bit os caminhos do DONO (verificado em prod 2026-07-12: 0 estimates e
-- 0 invoices com user_id NULL ou diferente do dono do project).
--
-- Papéis MVP: 'office' (secretária — vê tudo do dono; UI na onda 2) e
-- 'field' (peão — só obras atribuídas; valores só com can_see_financials).
-- Financeiro pesado (invoices/agreements/schedule/payments) FICA owner-only.
--
-- Idempotente/re-rodável. Rollback em comentário no fim.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. team_members — DDL
-- ----------------------------------------------------------------------------
-- Toggle POR MEMBRO: field enxergar valores (enforced na RLS, não só na UI).
alter table public.team_members
  add column if not exists can_see_financials boolean not null default false;

-- O fluxo novo cria o auth user na hora; o e-mail vira informativo (e pode
-- ser NULL em memberships históricas/futuras importações).
alter table public.team_members
  alter column member_email drop not null;

-- Papéis v1 (admin/estimator/viewer) → MVP (office/field).
-- Ordem obrigatória: (a) derrubar o CHECK velho ANTES do UPDATE (o CHECK v1
-- não aceita 'office'), (b) apagar o lixo pendente, (c) remapear, (d) CHECK novo.
alter table public.team_members
  drop constraint if exists team_members_role_check;

-- Lixo de abril/2026: 2 convites que nunca tiveram fluxo de aceite
-- (a7ab61c4 "Danilo"/estimator e 57522733 "Vitor Reche"/admin, ambos do owner
-- 06432de1-cd61-40e5-aaa5-e3cffcc0f5c4 = Gladson, status pending e
-- member_user_id NULL — verificado por SELECT em prod 2026-07-12).
-- Delete cirúrgico por condição, não por id: re-rodável e só pega lixo
-- estrutural (pending sem usuário vinculado não tem como virar membro).
delete from public.team_members
 where status = 'pending'
   and member_user_id is null;

update public.team_members set role = 'office' where role in ('admin', 'estimator');
update public.team_members set role = 'field'  where role = 'viewer';

-- default v1 era 'viewer' (violaria o CHECK novo em INSERT sem role explícita)
alter table public.team_members
  alter column role set default 'field';

alter table public.team_members
  add constraint team_members_role_check
  check ((role)::text = any (array['office'::text, 'field'::text]));

-- 1 equipe por usuário no MVP: no máximo UMA membership ativa por auth user.
-- (NULLs não colidem — memberships removed/históricas não travam nada.)
create unique index if not exists team_members_active_member_uniq
  on public.team_members (member_user_id)
  where status = 'active';

-- O parcial não-unique da Fase 0 fica subsumido pelo unique acima — fora.
drop index if exists public.idx_team_members_member_active;

-- ----------------------------------------------------------------------------
-- 2. Atribuição de autoria (quem criou fase/foto — dono OU membro)
-- ----------------------------------------------------------------------------
-- user_id nessas tabelas continua sendo o DONO (chave de RLS/consultas do app);
-- created_by registra o autor real. DEFAULT auth.uid() resolve app dono e
-- membro sem mudança de código; inserts service-role ficam NULL (não há hoje).
-- Sem FK para auth.users de propósito: campo de atribuição, evita mais um FK
-- sem índice e churn com deleção de usuário (histórico fica).
alter table public.project_phases
  add column if not exists created_by uuid default auth.uid();
alter table public.phase_photos
  add column if not exists created_by uuid default auth.uid();

-- Backfill do legado: tudo que existe foi criado pelo próprio dono.
update public.project_phases set created_by = user_id where created_by is null;
update public.phase_photos  set created_by = user_id where created_by is null;

-- ----------------------------------------------------------------------------
-- 3. Helpers de RLS — contrato com o app (nomes EXATOS)
-- ----------------------------------------------------------------------------
-- Set-returning + STABLE + argumentos constantes ⇒ o planner avalia UMA vez
-- por query (hashed subplan) em vez de por linha. SECURITY DEFINER: leem
-- team_members/project_members por baixo da RLS (sem recursão de policy).

-- Donos das equipes em que EU sou membro ativo (opcionalmente filtrado por papel).
create or replace function public.member_owner_ids(p_roles text[] default null)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tm.owner_id
    from public.team_members tm
   where tm.member_user_id = auth.uid()
     and tm.status = 'active'
     and (p_roles is null or tm.role = any (p_roles));
$$;

-- Projects a que EU estou atribuído (project_members × minha membership ativa).
create or replace function public.member_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pm.project_id
    from public.project_members pm
    join public.team_members tm on tm.id = pm.member_id
   where tm.member_user_id = auth.uid()
     and tm.status = 'active';
$$;

-- Donos cujos VALORES eu posso ver: office por papel, field só com o toggle.
create or replace function public.financial_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tm.owner_id
    from public.team_members tm
   where tm.member_user_id = auth.uid()
     and tm.status = 'active'
     and (tm.role = 'office' or tm.can_see_financials);
$$;

-- Higiene de EXECUTE: anon PRECISA manter execute (policies TO public podem
-- avaliá-las no futuro; para anon auth.uid() é NULL ⇒ conjunto vazio, inócuo).
revoke all on function public.member_owner_ids(text[]) from public;
revoke all on function public.member_project_ids() from public;
revoke all on function public.financial_owner_ids() from public;
grant execute on function public.member_owner_ids(text[]) to authenticated, anon, service_role;
grant execute on function public.member_project_ids() to authenticated, anon, service_role;
grant execute on function public.financial_owner_ids() to authenticated, anon, service_role;

-- ----------------------------------------------------------------------------
-- 4. Policies de membro (ADITIVAS) + substituições cirúrgicas onde a v1 vazaria
-- ----------------------------------------------------------------------------

-- ---- projects ---------------------------------------------------------------
-- Membro ATRIBUÍDO já enxerga o project pela "View projects" v1
-- (user_has_project_access). Falta só: office vê TODOS os projects do dono.
drop policy if exists "Team office views owner projects" on public.projects;
create policy "Team office views owner projects" on public.projects
  for select to authenticated
  using (user_id in (select public.member_owner_ids(array['office'])));

-- ---- project_phases ---------------------------------------------------------
-- Membro atribuído (field E office) vê e atualiza fases da obra. INSERT/DELETE
-- de fase seguem owner-only no MVP (field não cria fase; office = onda 2).
drop policy if exists "Team member views assigned phases" on public.project_phases;
create policy "Team member views assigned phases" on public.project_phases
  for select to authenticated
  using (project_id in (select public.member_project_ids()));

drop policy if exists "Team member updates assigned phases" on public.project_phases;
create policy "Team member updates assigned phases" on public.project_phases
  for update to authenticated
  using (project_id in (select public.member_project_ids()))
  with check (
    -- não pode mover a fase pra fora das obras atribuídas...
    project_id in (select public.member_project_ids())
    -- ...nem sequestrar a linha do dono (user_id TEM que continuar sendo o
    -- dono da equipe — com 1 equipe/usuário isso é exatamente 1 uuid possível)
    and user_id in (select public.member_owner_ids())
  );

-- ---- phase_photos -----------------------------------------------------------
-- Bucket phase-photos é PÚBLICO (leitura via URL); aqui é a METADATA da foto.
drop policy if exists "Team member views assigned phase photos" on public.phase_photos;
create policy "Team member views assigned phase photos" on public.phase_photos
  for select to authenticated
  using (project_id in (select public.member_project_ids()));

drop policy if exists "Team member adds assigned phase photos" on public.phase_photos;
create policy "Team member adds assigned phase photos" on public.phase_photos
  for insert to authenticated
  with check (
    project_id in (select public.member_project_ids())
    -- a linha nasce em nome do DONO (user_id = dono) para o app do dono e o
    -- portal continuarem enxergando tudo pelos caminhos atuais; autoria real
    -- fica em created_by (DEFAULT auth.uid())
    and user_id in (select public.member_owner_ids())
    -- coerência fase×obra: não dá pra pendurar foto numa fase de outra obra
    and phase_id in (select ph.id from public.project_phases ph
                      where ph.project_id = phase_photos.project_id)
  );

-- ---- TRAVA anti-sequestro (RESTRITIVAS — AND sobre o OR das permissivas) ----
-- Achado da matriz de testes na réplica local: com as policies de membro
-- acima, a ALL legada do dono ("Users manage own phases/phase photos", WITH
-- CHECK user_id = auth.uid()) vira VÁLVULA DE ESCAPE no OR das permissivas:
-- um membro atribuído conseguiria (a) UPDATE na fase pondo user_id=ele mesmo
-- (a fase SOME do app do dono) e (b) INSERT de foto com user_id=ele mesmo.
-- Estas restritivas amarram o user_id da linha ao DONO do project — para o
-- dono nada muda (todas as linhas de prod têm user_id = dono do project;
-- verificado 2026-07-12: 0 divergências em project_phases e phase_photos).
-- Bônus: fecham também o buraco v1 pré-existente de qualquer authenticated
-- inserir foto "sua" apontando para project alheio. service_role (portal/
-- functions) tem BYPASSRLS — não é afetado.
drop policy if exists "Phase rows must belong to project owner" on public.project_phases;
create policy "Phase rows must belong to project owner" on public.project_phases
  as restrictive for insert to authenticated
  with check (user_id = (select p.user_id from public.projects p where p.id = project_id));

drop policy if exists "Phase updates keep project owner" on public.project_phases;
create policy "Phase updates keep project owner" on public.project_phases
  as restrictive for update to authenticated
  using (true)
  with check (user_id = (select p.user_id from public.projects p where p.id = project_id));

drop policy if exists "Phase photo rows must belong to project owner" on public.phase_photos;
create policy "Phase photo rows must belong to project owner" on public.phase_photos
  as restrictive for insert to authenticated
  with check (user_id = (select p.user_id from public.projects p where p.id = project_id));

drop policy if exists "Phase photo updates keep project owner" on public.phase_photos;
create policy "Phase photo updates keep project owner" on public.phase_photos
  as restrictive for update to authenticated
  using (true)
  with check (user_id = (select p.user_id from public.projects p where p.id = project_id));

-- ---- phase_comments ---------------------------------------------------------
-- author_type/author_name ficam livres (o app manda 'contractor' + nome do
-- membro) — mesmo contrato do dono hoje.
drop policy if exists "Team member views assigned phase comments" on public.phase_comments;
create policy "Team member views assigned phase comments" on public.phase_comments
  for select to authenticated
  using (project_id in (select public.member_project_ids()));

drop policy if exists "Team member comments on assigned phases" on public.phase_comments;
create policy "Team member comments on assigned phases" on public.phase_comments
  for insert to authenticated
  with check (
    project_id in (select public.member_project_ids())
    and phase_id in (select ph.id from public.project_phases ph
                      where ph.project_id = phase_comments.project_id)
  );

-- ---- clients ----------------------------------------------------------------
-- A v1 "View clients" tinha user_has_team_access(user_id): QUALQUER membro
-- ativo (inclusive field) veria a carteira INTEIRA do dono assim que a
-- primeira membership ativasse. Substituída por: dono + office (tudo) +
-- membro atribuído (SÓ clientes de obras atribuídas).
drop policy if exists "View clients" on public.clients;
create policy "View clients" on public.clients
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "Team office views clients" on public.clients;
create policy "Team office views clients" on public.clients
  for select to authenticated
  using (user_id in (select public.member_owner_ids(array['office'])));

drop policy if exists "Team member views clients of assigned jobs" on public.clients;
create policy "Team member views clients of assigned jobs" on public.clients
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.client_id = clients.id
      and p.id in (select public.member_project_ids())
  ));

-- ---- users (perfil do DONO para o membro) ------------------------------------
-- Membro precisa do perfil da empresa (company_name/logo no header, e office
-- de tudo na onda 2). Abre EXATAMENTE as linhas dos donos das minhas
-- memberships ativas (com 1 equipe/usuário: 1 linha) — nada além de own-row
-- (policy "Users manage own record" intacta) + dono-do-membro.
-- Residual documentado: RLS é por LINHA — field tecnicamente lê também os
-- defaults do dono (ex.: default_labor_rate) via REST cru; aceito no MVP.
drop policy if exists "Team member views owner profile" on public.users;
create policy "Team member views owner profile" on public.users
  for select to authenticated
  using (id in (select public.member_owner_ids()));

-- ---- estimates (gate financeiro) ---------------------------------------------
-- A v1 "View estimates" tinha user_has_project_access(project_id): membro
-- atribuído veria valores SEM gate. Substituída pelos 2 caminhos do DONO
-- (user_id OU dono do project — equivalência verificada em prod: 0 mismatch)
-- + policy nova de membro com gate financeiro:
--   financial_owner_ids()  ⇒ office por papel, field só com can_see_financials
--   E (office ⇒ todos os estimates do dono | field ⇒ só de obra atribuída).
drop policy if exists "View estimates" on public.estimates;
create policy "View estimates" on public.estimates
  for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.projects p
      where p.id = estimates.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Team member views estimates (financial gate)" on public.estimates;
create policy "Team member views estimates (financial gate)" on public.estimates
  for select to authenticated
  using (
    user_id in (select public.financial_owner_ids())
    and (
      user_id in (select public.member_owner_ids(array['office']))
      or project_id in (select public.member_project_ids())
    )
  );

-- ---- line_items (mesmo gate, via estimate→project) ----------------------------
drop policy if exists "View line items" on public.line_items;
create policy "View line items" on public.line_items
  for select
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and (e.user_id = (select auth.uid())
           or exists (
             select 1 from public.projects p
             where p.id = e.project_id
               and p.user_id = (select auth.uid())
           ))
  ));

drop policy if exists "Team member views line items (financial gate)" on public.line_items;
create policy "Team member views line items (financial gate)" on public.line_items
  for select to authenticated
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id in (select public.financial_owner_ids())
      and (
        e.user_id in (select public.member_owner_ids(array['office']))
        or e.project_id in (select public.member_project_ids())
      )
  ));

-- ---- invoices / invoice_line_items: OWNER-ONLY (onda 2) -----------------------
-- Mandato da Onda B: faturas/pagamentos/contratos ficam do dono. As Views v1
-- tinham user_has_project_access ⇒ membro atribuído veria FATURA inteira.
-- Substituídas pelos 2 caminhos do dono, sem ramo de membro. NENHUMA policy
-- de membro é criada aqui (invoice_payments/invoice_schedule/agreements já
-- são owner-only e ficam intactas).
drop policy if exists "View invoices" on public.invoices;
create policy "View invoices" on public.invoices
  for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.projects p
      where p.id = invoices.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "View invoice line items" on public.invoice_line_items;
create policy "View invoice line items" on public.invoice_line_items
  for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and (i.user_id = (select auth.uid())
           or exists (
             select 1 from public.projects p
             where p.id = i.project_id
               and p.user_id = (select auth.uid())
           ))
  ));

-- NOTA (decisão documentada): "View media" fica COMO ESTÁ — o ramo v1
-- user_has_project_access passa a valer para membro atribuído e é exatamente
-- o comportamento desejado (fotos da obra, zero conteúdo financeiro).
-- Os ramos v1 com get_member_role IN ('admin','estimator') em
-- estimates/line_items/media INSERT-UPDATE e projects UPDATE ficam MORTOS
-- após o remap de papéis (nenhum membro terá esses papéis) — inócuos; a onda
-- 2 (office escreve) os substitui de vez.

-- ----------------------------------------------------------------------------
-- 5. Storage — membro atribuído grava foto de fase NA PASTA DO DONO (§7)
-- ----------------------------------------------------------------------------
-- Caminho contratual do app: phase-photos/<owner_uid>/... (igual hoje). Nome
-- único por upload (sem upsert): INSERT basta; UPDATE/DELETE de objeto seguem
-- owner-only. Leitura é por URL pública (bucket public).
drop policy if exists "Team member uploads phase photos to owner folder" on storage.objects;
create policy "Team member uploads phase photos to owner folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'phase-photos'
    and (storage.foldername(name))[1] in (
      select o::text from public.member_owner_ids() as t(o)
    )
  );

-- ============================================================================
-- ROLLBACK (reverte APENAS esta migration, de volta ao estado pós-Fase 0).
-- Atenção: os UPDATEs de dados (remap de papéis, delete dos 2 pending de
-- abril, backfill de created_by) não são reversíveis por DDL — os 2 pending
-- eram lixo sem fluxo de aceite; o remap só re-etiqueta.
-- ============================================================================
-- -- 5) storage
-- drop policy if exists "Team member uploads phase photos to owner folder" on storage.objects;
-- -- 4) policies novas de membro
-- drop policy if exists "Team office views owner projects" on public.projects;
-- drop policy if exists "Team member views assigned phases" on public.project_phases;
-- drop policy if exists "Team member updates assigned phases" on public.project_phases;
-- drop policy if exists "Phase rows must belong to project owner" on public.project_phases;
-- drop policy if exists "Phase updates keep project owner" on public.project_phases;
-- drop policy if exists "Phase photo rows must belong to project owner" on public.phase_photos;
-- drop policy if exists "Phase photo updates keep project owner" on public.phase_photos;
-- drop policy if exists "Team member views assigned phase photos" on public.phase_photos;
-- drop policy if exists "Team member adds assigned phase photos" on public.phase_photos;
-- drop policy if exists "Team member views assigned phase comments" on public.phase_comments;
-- drop policy if exists "Team member comments on assigned phases" on public.phase_comments;
-- drop policy if exists "Team office views clients" on public.clients;
-- drop policy if exists "Team member views clients of assigned jobs" on public.clients;
-- drop policy if exists "Team member views owner profile" on public.users;
-- drop policy if exists "Team member views estimates (financial gate)" on public.estimates;
-- drop policy if exists "Team member views line items (financial gate)" on public.line_items;
-- -- 4b) restaurar as 5 Views substituídas (formas da Fase 0, com v1 helpers)
-- drop policy if exists "View clients" on public.clients;
-- create policy "View clients" on public.clients for select
--   using ((user_id = (select auth.uid())) or user_has_team_access(user_id));
-- drop policy if exists "View estimates" on public.estimates;
-- create policy "View estimates" on public.estimates for select
--   using ((user_id = (select auth.uid())) or user_has_project_access(project_id));
-- drop policy if exists "View line items" on public.line_items;
-- create policy "View line items" on public.line_items for select
--   using (exists (select 1 from public.estimates e where e.id = line_items.estimate_id
--     and (e.user_id = (select auth.uid()) or user_has_project_access(e.project_id))));
-- drop policy if exists "View invoices" on public.invoices;
-- create policy "View invoices" on public.invoices for select
--   using ((user_id = (select auth.uid())) or user_has_project_access(project_id));
-- drop policy if exists "View invoice line items" on public.invoice_line_items;
-- create policy "View invoice line items" on public.invoice_line_items for select
--   using (exists (select 1 from public.invoices i where i.id = invoice_line_items.invoice_id
--     and (i.user_id = (select auth.uid()) or user_has_project_access(i.project_id))));
-- -- 3) helpers
-- drop function if exists public.financial_owner_ids();
-- drop function if exists public.member_project_ids();
-- drop function if exists public.member_owner_ids(text[]);
-- -- 2) autoria
-- alter table public.project_phases drop column if exists created_by;
-- alter table public.phase_photos  drop column if exists created_by;
-- -- 1) team_members
-- drop index if exists public.team_members_active_member_uniq;
-- create index if not exists idx_team_members_member_active
--   on public.team_members (member_user_id) where status = 'active';
-- alter table public.team_members drop constraint if exists team_members_role_check;
-- update public.team_members set role = 'viewer' where role = 'field';
-- -- (office → 'admin' ou 'estimator' é indecidível; escolher 'admin')
-- update public.team_members set role = 'admin' where role = 'office';
-- alter table public.team_members alter column role set default 'viewer';
-- alter table public.team_members add constraint team_members_role_check
--   check ((role)::text = any (array['admin'::text,'estimator'::text,'viewer'::text]));
-- alter table public.team_members alter column member_email set not null; -- só se não houver NULLs
-- alter table public.team_members drop column if exists can_see_financials;
-- ============================================================================
