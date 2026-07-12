-- ONDA E — papel OFFICE completo no banco (a RLS de leitura básica veio na Onda B; aqui
-- entra o que faltava: faturas e ESCRITA). Modelo: office opera o negócio do DONO —
-- cria/edita clientes, jobs, orçamentos, faturas, pagamentos, fases e fotos — sempre com
-- user_id = dono (as restritivas anti-hijack da Onda B continuam valendo por cima).
-- O que office NÃO faz: gerenciar equipe (project_members/team_members ficam do dono),
-- billing, editar o perfil da empresa (users UPDATE segue own-row), deletar clientes/jobs.
-- Padrão das amarras: WITH CHECK user_id IN member_owner_ids(array['office']) prende o
-- tenant ao(s) dono(s) do MEMBRO; filhos são amarrados ao MESMO user_id do pai (um office
-- malicioso não consegue apontar client_id/estimate_id de outro tenant).

-- ---------- FATURAS: leitura que faltava (office sempre vê financeiro) ----------
drop policy if exists "Team office views invoices" on public.invoices;
create policy "Team office views invoices" on public.invoices
  for select to authenticated
  using (user_id in (select member_owner_ids(array['office'])));

drop policy if exists "Team office views invoice line items" on public.invoice_line_items;
create policy "Team office views invoice line items" on public.invoice_line_items
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office views invoice payments" on public.invoice_payments;
create policy "Team office views invoice payments" on public.invoice_payments
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office views invoice schedule" on public.invoice_schedule;
create policy "Team office views invoice schedule" on public.invoice_schedule
  for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_schedule.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

-- ---------- CLIENTES ----------
drop policy if exists "Team office inserts clients" on public.clients;
create policy "Team office inserts clients" on public.clients
  for insert to authenticated
  with check (user_id in (select member_owner_ids(array['office'])));

drop policy if exists "Team office updates clients" on public.clients;
create policy "Team office updates clients" on public.clients
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (user_id in (select member_owner_ids(array['office'])));

-- ---------- PROJETOS (jobs) ----------
drop policy if exists "Team office inserts projects" on public.projects;
create policy "Team office inserts projects" on public.projects
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and (client_id is null or exists (
      select 1 from public.clients c
      where c.id = projects.client_id and c.user_id = projects.user_id
    ))
  );

drop policy if exists "Team office updates projects" on public.projects;
create policy "Team office updates projects" on public.projects
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and (client_id is null or exists (
      select 1 from public.clients c
      where c.id = projects.client_id and c.user_id = projects.user_id
    ))
  );

-- ---------- ORÇAMENTOS ----------
drop policy if exists "Team office inserts estimates" on public.estimates;
create policy "Team office inserts estimates" on public.estimates
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = estimates.project_id and p.user_id = estimates.user_id
    ))
  );

drop policy if exists "Team office updates estimates" on public.estimates;
create policy "Team office updates estimates" on public.estimates
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])));

drop policy if exists "Team office manages line items" on public.line_items;
create policy "Team office manages line items" on public.line_items
  for all to authenticated
  using (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id in (select member_owner_ids(array['office']))
  ))
  with check (exists (
    select 1 from public.estimates e
    where e.id = line_items.estimate_id
      and e.user_id in (select member_owner_ids(array['office']))
  ));

-- ---------- FATURAS: escrita ----------
drop policy if exists "Team office inserts invoices" on public.invoices;
create policy "Team office inserts invoices" on public.invoices
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.user_id = invoices.user_id
    )
  );

drop policy if exists "Team office updates invoices" on public.invoices;
create policy "Team office updates invoices" on public.invoices
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])));

drop policy if exists "Team office inserts invoice line items" on public.invoice_line_items;
create policy "Team office inserts invoice line items" on public.invoice_line_items
  for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office records invoice payments" on public.invoice_payments;
create policy "Team office records invoice payments" on public.invoice_payments
  for insert to authenticated
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_payments.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office manages invoice schedule" on public.invoice_schedule;
create policy "Team office manages invoice schedule" on public.invoice_schedule
  for all to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_schedule.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_schedule.invoice_id
      and i.user_id in (select member_owner_ids(array['office']))
  ));

-- ---------- MÍDIA / FASES / FOTOS / COMENTÁRIOS ----------
drop policy if exists "Team office inserts media" on public.media;
create policy "Team office inserts media" on public.media
  for insert to authenticated
  with check (exists (
    select 1 from public.projects p
    where p.id = media.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ));

-- fases: office gerencia TODAS as fases dos projetos do dono (as restritivas da Onda B
-- garantem user_id = dono do projeto em INSERT/UPDATE por cima destas)
drop policy if exists "Team office manages phases" on public.project_phases;
create policy "Team office manages phases" on public.project_phases
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_phases.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (
      select 1 from public.projects p
      where p.id = project_phases.project_id
        and p.user_id = project_phases.user_id
    )
  );

drop policy if exists "Team office adds phase photos" on public.phase_photos;
create policy "Team office adds phase photos" on public.phase_photos
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (
      select 1 from public.projects p
      where p.id = phase_photos.project_id
        and p.user_id = phase_photos.user_id
    )
    and phase_id in (select ph.id from public.project_phases ph
                      where ph.project_id = phase_photos.project_id)
  );

drop policy if exists "Team office views phase photos" on public.phase_photos;
create policy "Team office views phase photos" on public.phase_photos
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = phase_photos.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office views phase comments" on public.phase_comments;
create policy "Team office views phase comments" on public.phase_comments
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = phase_comments.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ));

drop policy if exists "Team office comments on phases" on public.phase_comments;
create policy "Team office comments on phases" on public.phase_comments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = phase_comments.project_id
        and p.user_id in (select member_owner_ids(array['office']))
    )
    and phase_id in (select ph.id from public.project_phases ph
                      where ph.project_id = phase_comments.project_id)
    and author_type = 'contractor'
  );

-- fases: office também vê as fases de todos os projetos do dono (a policy da Onda B
-- era só por atribuição)
drop policy if exists "Team office views phases" on public.project_phases;
create policy "Team office views phases" on public.project_phases
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_phases.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ));

-- ---------- STORAGE: office sobe fotos de job na pasta do DONO ----------
-- (phase-photos já cobre qualquer membro via "Team member uploads phase photos to owner folder")
drop policy if exists "Team office uploads project photos to owner folder" on storage.objects;
create policy "Team office uploads project photos to owner folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] in (
      select o::text from public.member_owner_ids(array['office']) as t(o)
    )
  );

-- ---------- DEFAULTS DO DONO p/ office (orçamento herda imposto/margem/cidade) ----------
create or replace function public.get_owner_defaults()
returns table (
  id uuid,
  default_city varchar,
  default_state varchar,
  default_tax_percent numeric,
  default_margin_percent numeric,
  default_deposit_percent numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.default_city, u.default_state,
         u.default_tax_percent, u.default_margin_percent, u.default_deposit_percent
    from public.users u
   where u.id in (select public.member_owner_ids(array['office']));
$$;

revoke all on function public.get_owner_defaults() from public;
grant execute on function public.get_owner_defaults() to authenticated;
