-- Revisor da Onda E (MÉDIO): as policies de UPDATE do office em estimates/invoices não
-- tinham WITH CHECK — o Postgres reusa o USING (que só amarra user_id), então um office
-- podia MOVER project_id/estimate_id para referência de outro tenant. Sem leak (a linha
-- continua no tenant do dono; ninguém de fora a lê), mas viola a invariante documentada
-- "filho amarrado ao MESMO user_id do pai". WITH CHECK simétrico ao INSERT.

drop policy if exists "Team office updates estimates" on public.estimates;
create policy "Team office updates estimates" on public.estimates
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = estimates.project_id and p.user_id = estimates.user_id
    ))
  );

drop policy if exists "Team office updates invoices" on public.invoices;
create policy "Team office updates invoices" on public.invoices
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.user_id = invoices.user_id
    )
    and (estimate_id is null or exists (
      select 1 from public.estimates e
      where e.id = invoices.estimate_id and e.user_id = invoices.user_id
    ))
  );
