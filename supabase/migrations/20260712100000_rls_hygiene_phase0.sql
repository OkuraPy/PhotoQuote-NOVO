-- ============================================================================
-- ONDA B / Fase 0 — Higiene RLS (SEM mudança de comportamento)
-- ============================================================================
-- Fonte: docs/ESTUDO_2026-07-11.md §2 ("Fase 0 (higiene RLS, pré-requisito)").
-- Advisor 2026-07-12: 52 policies auth_rls_initplan + 20 unindexed_foreign_keys.
--
-- O que este arquivo faz (e NADA além disso):
--   1) Reescreve as 52 policies de `public` que usam auth.uid() "nu" para
--      (select auth.uid()) — o planner transforma o subselect em InitPlan e
--      avalia 1x por query em vez de 1x por LINHA. DROP + CREATE fiéis:
--      mesmo nome, mesmo cmd, mesmos roles, mesma USING/WITH CHECK; a ÚNICA
--      diferença é o wrap do uid. (As chamadas a user_has_team_access /
--      user_has_project_access / get_member_role ficam como estão — são
--      SECURITY DEFINER e recebem argumento por linha; não há InitPlan possível.)
--   2) Consolida as 2 duplicatas comprovadamente seguras (line_items e media):
--      dropa a policy ALL legada "Users manage own ..." porque o conjunto
--      granular v1 (View/Insert/Update/Delete) concede TUDO que a ALL concedia
--      (prova nos comentários inline).
--   3) Cria os 20 índices de FK apontados pelo advisor + 1 índice parcial de
--      hot-path para o lookup de membership ativa (RLS da Onda B).
--
-- Idempotente/re-rodável: drop policy if exists + create; create index if not
-- exists. Rollback completo em comentário no fim do arquivo.
-- Conta sem membros ativos: comportamento bit a bit idêntico ao atual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REESCRITA DAS POLICIES — (select auth.uid()) em vez de auth.uid()
-- ----------------------------------------------------------------------------

-- ------------------------- agreements (1) -----------------------------------
drop policy if exists "Owner manages agreements" on public.agreements;
create policy "Owner manages agreements" on public.agreements
  for all
  using (user_id = (select auth.uid()));

-- ------------------------- ai_jobs (1) --------------------------------------
drop policy if exists "Users read own ai jobs" on public.ai_jobs;
create policy "Users read own ai jobs" on public.ai_jobs
  for select
  using (user_id = (select auth.uid()));

-- ------------------------- clients (4) --------------------------------------
drop policy if exists "Delete clients" on public.clients;
create policy "Delete clients" on public.clients
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "Insert clients" on public.clients;
create policy "Insert clients" on public.clients
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Update clients" on public.clients;
create policy "Update clients" on public.clients
  for update
  using (user_id = (select auth.uid()));

drop policy if exists "View clients" on public.clients;
create policy "View clients" on public.clients
  for select
  using ((user_id = (select auth.uid())) or user_has_team_access(user_id));

-- ------------------------- contract_templates (2) ---------------------------
drop policy if exists "Manage own contract templates" on public.contract_templates;
create policy "Manage own contract templates" on public.contract_templates
  for all
  using (user_id = (select auth.uid()));

drop policy if exists "View contract templates" on public.contract_templates;
create policy "View contract templates" on public.contract_templates
  for select
  using ((user_id = (select auth.uid())) or (user_id is null));

-- ------------------------- estimates (4) ------------------------------------
drop policy if exists "Delete estimates" on public.estimates;
create policy "Delete estimates" on public.estimates
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "Insert estimates" on public.estimates;
create policy "Insert estimates" on public.estimates
  for insert
  with check (
    (user_id = (select auth.uid()))
    or (user_has_project_access(project_id)
        and (get_member_role(project_id))::text = any (array['admin'::text, 'estimator'::text]))
  );

drop policy if exists "Update estimates" on public.estimates;
create policy "Update estimates" on public.estimates
  for update
  using (
    (user_id = (select auth.uid()))
    or (user_has_project_access(project_id)
        and (get_member_role(project_id))::text = any (array['admin'::text, 'estimator'::text]))
  );

drop policy if exists "View estimates" on public.estimates;
create policy "View estimates" on public.estimates
  for select
  using ((user_id = (select auth.uid())) or user_has_project_access(project_id));

-- ------------------------- invoice_line_items (4) ---------------------------
drop policy if exists "Delete invoice line items" on public.invoice_line_items;
create policy "Delete invoice line items" on public.invoice_line_items
  for delete
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.user_id = (select auth.uid())
  ));

drop policy if exists "Insert invoice line items" on public.invoice_line_items;
create policy "Insert invoice line items" on public.invoice_line_items
  for insert
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.user_id = (select auth.uid())
  ));

drop policy if exists "Update invoice line items" on public.invoice_line_items;
create policy "Update invoice line items" on public.invoice_line_items
  for update
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.user_id = (select auth.uid())
  ));

drop policy if exists "View invoice line items" on public.invoice_line_items;
create policy "View invoice line items" on public.invoice_line_items
  for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and (i.user_id = (select auth.uid()) or user_has_project_access(i.project_id))
  ));

-- ------------------------- invoice_payments (1) -----------------------------
drop policy if exists "Users manage own invoice payments" on public.invoice_payments;
create policy "Users manage own invoice payments" on public.invoice_payments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------- invoice_schedule (1) -----------------------------
drop policy if exists "Users manage own schedule rows" on public.invoice_schedule;
create policy "Users manage own schedule rows" on public.invoice_schedule
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ------------------------- invoices (4) -------------------------------------
drop policy if exists "Delete invoices" on public.invoices;
create policy "Delete invoices" on public.invoices
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "Insert invoices" on public.invoices;
create policy "Insert invoices" on public.invoices
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Update invoices" on public.invoices;
create policy "Update invoices" on public.invoices
  for update
  using (user_id = (select auth.uid()));

drop policy if exists "View invoices" on public.invoices;
create policy "View invoices" on public.invoices
  for select
  using ((user_id = (select auth.uid())) or user_has_project_access(project_id));

-- ------------------------- line_items (4 + consolidação) --------------------
drop policy if exists "Delete line items" on public.line_items;
create policy "Delete line items" on public.line_items
  for delete
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id = (select auth.uid())
  ));

drop policy if exists "Insert line items" on public.line_items;
create policy "Insert line items" on public.line_items
  for insert
  with check (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and (e.user_id = (select auth.uid())
           or (user_has_project_access(e.project_id)
               and (get_member_role(e.project_id))::text = any (array['admin'::text, 'estimator'::text])))
  ));

drop policy if exists "Update line items" on public.line_items;
create policy "Update line items" on public.line_items
  for update
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and (e.user_id = (select auth.uid())
           or (user_has_project_access(e.project_id)
               and (get_member_role(e.project_id))::text = any (array['admin'::text, 'estimator'::text])))
  ));

drop policy if exists "View line items" on public.line_items;
create policy "View line items" on public.line_items
  for select
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and (e.user_id = (select auth.uid()) or user_has_project_access(e.project_id))
  ));

-- CONSOLIDAÇÃO (segura): "Users manage own line items" (ALL, owner-only via
-- estimate_id IN (estimates do dono)) é 100% coberta pelo conjunto granular:
--   SELECT → "View line items"   1º ramo (e.user_id = uid)
--   INSERT → "Insert line items" 1º ramo (idem, mesma WITH CHECK)
--   UPDATE → "Update line items" 1º ramo (USING sem WITH CHECK = USING)
--   DELETE → "Delete line items" (exatamente o ramo do dono)
-- Ambas as formas passam pela RLS de estimates do usuário corrente — dono
-- enxerga os próprios estimates nas duas. Nenhum caso concedido só pela ALL.
drop policy if exists "Users manage own line items" on public.line_items;

-- ------------------------- media (4 + consolidação) -------------------------
drop policy if exists "Delete media" on public.media;
create policy "Delete media" on public.media
  for delete
  using (exists (
    select 1 from public.projects p
    where p.id = media.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "Insert media" on public.media;
create policy "Insert media" on public.media
  for insert
  with check (
    (exists (
      select 1 from public.projects p
      where p.id = media.project_id
        and p.user_id = (select auth.uid())
    ))
    or (user_has_project_access(project_id)
        and (get_member_role(project_id))::text = any (array['admin'::text, 'estimator'::text]))
  );

drop policy if exists "Update media" on public.media;
create policy "Update media" on public.media
  for update
  using (exists (
    select 1 from public.projects p
    where p.id = media.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "View media" on public.media;
create policy "View media" on public.media
  for select
  using (
    user_has_project_access(project_id)
    or exists (
      select 1 from public.projects p
      where p.id = media.project_id
        and p.user_id = (select auth.uid())
    )
  );

-- CONSOLIDAÇÃO (segura): "Users manage own media" (ALL, owner-only via
-- project_id IN (projects do dono)) é coberta pelo conjunto granular:
--   SELECT → "View media" (2º ramo = EXISTS projects do dono)
--   INSERT → "Insert media" 1º ramo   UPDATE → "Update media"   DELETE → "Delete media"
drop policy if exists "Users manage own media" on public.media;

-- ------------------------- phase_comments (1) -------------------------------
drop policy if exists "Users manage own project comments" on public.phase_comments;
create policy "Users manage own project comments" on public.phase_comments
  for all
  using (project_id in (
    select projects.id from public.projects
    where projects.user_id = (select auth.uid())
  ))
  with check (project_id in (
    select projects.id from public.projects
    where projects.user_id = (select auth.uid())
  ));

-- ------------------------- phase_photos (1) ---------------------------------
drop policy if exists "Users manage own phase photos" on public.phase_photos;
create policy "Users manage own phase photos" on public.phase_photos
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------- price_tables (1) ---------------------------------
drop policy if exists "Users manage own price tables" on public.price_tables;
create policy "Users manage own price tables" on public.price_tables
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------- project_members (5) ------------------------------
drop policy if exists "Member can view own project assignments" on public.project_members;
create policy "Member can view own project assignments" on public.project_members
  for select
  using (exists (
    select 1 from public.team_members tm
    where tm.id = project_members.member_id
      and tm.member_user_id = (select auth.uid())
      and (tm.status)::text = 'active'
  ));

drop policy if exists "Owner can delete project members" on public.project_members;
create policy "Owner can delete project members" on public.project_members
  for delete
  using (exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "Owner can insert project members" on public.project_members;
create policy "Owner can insert project members" on public.project_members
  for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "Owner can update project members" on public.project_members;
create policy "Owner can update project members" on public.project_members
  for update
  using (exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  ));

drop policy if exists "Owner can view project members" on public.project_members;
create policy "Owner can view project members" on public.project_members
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  ));

-- ------------------------- project_phases (1) -------------------------------
drop policy if exists "Users manage own phases" on public.project_phases;
create policy "Users manage own phases" on public.project_phases
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------- project_share_tokens (1) -------------------------
drop policy if exists "Users manage own share tokens" on public.project_share_tokens;
create policy "Users manage own share tokens" on public.project_share_tokens
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------- projects (4) -------------------------------------
drop policy if exists "Delete projects" on public.projects;
create policy "Delete projects" on public.projects
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "Insert projects" on public.projects;
create policy "Insert projects" on public.projects
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Update projects" on public.projects;
create policy "Update projects" on public.projects
  for update
  using (
    (user_id = (select auth.uid()))
    or (user_has_project_access(id) and (get_member_role(id))::text = 'admin')
  );

drop policy if exists "View projects" on public.projects;
create policy "View projects" on public.projects
  for select
  using ((user_id = (select auth.uid())) or user_has_project_access(id));

-- ------------------------- team_members (5) ---------------------------------
drop policy if exists "Member can view own membership" on public.team_members;
create policy "Member can view own membership" on public.team_members
  for select
  using (((select auth.uid()) = member_user_id) and (status)::text = 'active');

drop policy if exists "Owner can delete team members" on public.team_members;
create policy "Owner can delete team members" on public.team_members
  for delete
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owner can insert team members" on public.team_members;
create policy "Owner can insert team members" on public.team_members
  for insert
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owner can update team members" on public.team_members;
create policy "Owner can update team members" on public.team_members
  for update
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owner can view team members" on public.team_members;
create policy "Owner can view team members" on public.team_members
  for select
  using ((select auth.uid()) = owner_id);

-- ------------------------- users (1) ----------------------------------------
drop policy if exists "Users manage own record" on public.users;
create policy "Users manage own record" on public.users
  for all
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- (Não tocadas: "regional_pricing readable" e "Anyone can read subscription
--  plans" — qual = true, sem auth.uid(), fora do lint.)

-- ----------------------------------------------------------------------------
-- 2. ÍNDICES — 20 FKs sem índice (advisor unindexed_foreign_keys 2026-07-12)
--    + 1 parcial de hot-path p/ membership ativa
-- ----------------------------------------------------------------------------
create index if not exists idx_agreements_client_id          on public.agreements (client_id);
create index if not exists idx_agreements_project_id         on public.agreements (project_id);
create index if not exists idx_contract_templates_user_id    on public.contract_templates (user_id);
create index if not exists idx_estimates_user_id             on public.estimates (user_id);
create index if not exists idx_invoice_line_items_invoice_id on public.invoice_line_items (invoice_id);
create index if not exists idx_invoice_payments_schedule_id  on public.invoice_payments (schedule_id);
create index if not exists idx_invoice_schedule_phase_id     on public.invoice_schedule (phase_id);
create index if not exists idx_invoices_estimate_id          on public.invoices (estimate_id);
create index if not exists idx_invoices_project_id           on public.invoices (project_id);
create index if not exists idx_phase_comments_project_id     on public.phase_comments (project_id);
create index if not exists idx_phase_photos_project_id       on public.phase_photos (project_id);
create index if not exists idx_phase_photos_user_id          on public.phase_photos (user_id);
create index if not exists idx_project_members_assigned_by   on public.project_members (assigned_by);
create index if not exists idx_project_members_member_id     on public.project_members (member_id);
create index if not exists idx_project_phases_estimate_id    on public.project_phases (estimate_id);
create index if not exists idx_project_phases_user_id        on public.project_phases (user_id);
create index if not exists idx_project_share_tokens_user_id  on public.project_share_tokens (user_id);
create index if not exists idx_projects_activated_estimate_id on public.projects (activated_estimate_id);
create index if not exists idx_team_members_member_user_id   on public.team_members (member_user_id);
create index if not exists idx_users_subscription_plan_id    on public.users (subscription_plan_id);

-- Hot-path RLS da Onda B: lookup "sou membro ativo de quem?".
-- (Índice parcial NÃO conta como cobertura de FK pro advisor, por isso o
--  idx_team_members_member_user_id cheio acima continua necessário. Este
--  parcial será SUBSTITUÍDO pelo unique team_members_active_member_uniq na
--  migration 20260712100100 — que o dropa ao criar o unique.)
create index if not exists idx_team_members_member_active
  on public.team_members (member_user_id)
  where status = 'active';

-- ============================================================================
-- ROLLBACK (colar num SQL editor se precisar reverter — reverte APENAS esta
-- migration: policies voltam à forma com auth.uid() nu e os índices caem).
-- ============================================================================
-- -- 2) índices
-- drop index if exists public.idx_team_members_member_active;
-- drop index if exists public.idx_users_subscription_plan_id;
-- drop index if exists public.idx_team_members_member_user_id;
-- drop index if exists public.idx_projects_activated_estimate_id;
-- drop index if exists public.idx_project_share_tokens_user_id;
-- drop index if exists public.idx_project_phases_user_id;
-- drop index if exists public.idx_project_phases_estimate_id;
-- drop index if exists public.idx_project_members_member_id;
-- drop index if exists public.idx_project_members_assigned_by;
-- drop index if exists public.idx_phase_photos_user_id;
-- drop index if exists public.idx_phase_photos_project_id;
-- drop index if exists public.idx_phase_comments_project_id;
-- drop index if exists public.idx_invoices_project_id;
-- drop index if exists public.idx_invoices_estimate_id;
-- drop index if exists public.idx_invoice_schedule_phase_id;
-- drop index if exists public.idx_invoice_payments_schedule_id;
-- drop index if exists public.idx_invoice_line_items_invoice_id;
-- drop index if exists public.idx_estimates_user_id;
-- drop index if exists public.idx_contract_templates_user_id;
-- drop index if exists public.idx_agreements_project_id;
-- drop index if exists public.idx_agreements_client_id;
-- -- 1b) re-criar as 2 ALL consolidadas (formas originais)
-- create policy "Users manage own line items" on public.line_items for all
--   using (estimate_id in (select estimates.id from public.estimates where estimates.user_id = auth.uid()))
--   with check (estimate_id in (select estimates.id from public.estimates where estimates.user_id = auth.uid()));
-- create policy "Users manage own media" on public.media for all
--   using (project_id in (select projects.id from public.projects where projects.user_id = auth.uid()))
--   with check (project_id in (select projects.id from public.projects where projects.user_id = auth.uid()));
-- -- 1a) para reverter o wrap do uid: rodar este mesmo arquivo trocando
-- --     "(select auth.uid())" por "auth.uid()" nas 50 policies recriadas
-- --     (nomes/cmd/roles idênticos aos originais de prod capturados em
-- --      2026-07-12 via pg_policies).
-- ============================================================================
