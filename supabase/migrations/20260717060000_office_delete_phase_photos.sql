-- Pedido do dono (17/07): gerenciar as fotos da obra — apagar uma foto de progresso.
-- O OWNER já pode (policy "Users manage own phase photos" ALL, user_id = auth.uid()).
-- O papel OFFICE (que opera o negócio do dono, Onda E) tinha SELECT/INSERT mas não DELETE —
-- esta policy dá o DELETE das fotos dos projetos do dono. FIELD segue só adicionando (não apaga).
drop policy if exists "Team office deletes phase photos" on public.phase_photos;
create policy "Team office deletes phase photos" on public.phase_photos
  for delete to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = phase_photos.project_id
      and p.user_id in (select member_owner_ids(array['office']))
  ));
