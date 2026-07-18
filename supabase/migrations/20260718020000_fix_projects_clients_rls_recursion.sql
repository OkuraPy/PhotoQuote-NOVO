-- HOTFIX CRÍTICO (18/07): "infinite recursion detected in policy for relation projects".
-- A Onda E (170000) deu às policies office de projects um WITH CHECK com EXISTS(clients),
-- e a policy de clients da Onda B ("Team member views clients of assigned jobs") já tinha
-- EXISTS(projects). Isso fecha o ciclo projects → clients → projects, que o Postgres detecta
-- no PLANEJAMENTO — logo QUALQUER insert/update de projects falha, inclusive o do OWNER
-- (todas as policies permissivas entram no plano). Salvar orçamento e arquivar quebravam.
-- O Gladson não pegou porque não criou/arquivou trabalho desde 12/07 (só editou existentes).
--
-- Fix mínimo: mover a amarra "o client_id pertence ao mesmo dono" para uma função SECURITY
-- DEFINER, que consulta clients SEM reentrar nas policies de clients — quebra o ciclo e mantém
-- a garantia anti-cross-tenant idêntica. Só as 2 policies office de projects mudam.

create or replace function public.client_belongs_to_owner(p_client_id uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_client_id is null
      or exists (select 1 from public.clients c where c.id = p_client_id and c.user_id = p_owner);
$$;
revoke all on function public.client_belongs_to_owner(uuid, uuid) from public;
grant execute on function public.client_belongs_to_owner(uuid, uuid) to authenticated;

drop policy if exists "Team office inserts projects" on public.projects;
create policy "Team office inserts projects" on public.projects
  for insert to authenticated
  with check (
    user_id in (select member_owner_ids(array['office']))
    and public.client_belongs_to_owner(client_id, user_id)
  );

drop policy if exists "Team office updates projects" on public.projects;
create policy "Team office updates projects" on public.projects
  for update to authenticated
  using (user_id in (select member_owner_ids(array['office'])))
  with check (
    user_id in (select member_owner_ids(array['office']))
    and public.client_belongs_to_owner(client_id, user_id)
  );
