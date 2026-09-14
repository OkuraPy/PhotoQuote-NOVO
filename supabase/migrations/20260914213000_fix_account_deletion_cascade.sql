-- Exclusão de conta (App Store 5.1.1(v)) falhava em produção — provado no log de 14/09 21:22 UTC:
--
--   ERROR: update or delete on table "users" violates foreign key constraint
--          "estimates_user_id_fkey" on table "estimates" (SQLSTATE 23503)
--
-- A Edge Function `delete-account` apaga memberships, ai_jobs e o storage e depois chama
-- `auth.admin.deleteUser`, confiando que o resto do grafo CASCADE. O comentário dela dizia
-- "grafo conferido em prod: tudo CASCADE" — mas 5 chaves estrangeiras apontam para auth.users
-- com NO ACTION e travam o delete:
--
--   estimates.user_id · invoices.user_id · agreements.user_id · contract_templates.user_id
--   project_members.assigned_by
--
-- Efeito real: o dono apertou "Delete account" durante a gravação do vídeo que a App Review
-- pediu, o app deu erro — e, como o storage é limpo ANTES do deleteUser, a conta ficou pela
-- metade: fotos apagadas, conta viva.
--
-- Junto vão as duas FKs de agreements para client/project, também NO ACTION: apagar a conta
-- cascateia para clients e projects, e um contrato pendurado neles travaria pelo mesmo motivo.
-- (`deleteProject` no app já apagava agreements na mão por causa disso; continua correto e
-- agora redundante.)
--
-- Nada aqui apaga dado por conta própria: FK ON DELETE CASCADE só age quando o PAI é apagado,
-- e o único caminho que apaga o pai é a exclusão de conta pedida pelo próprio usuário.

alter table public.estimates
  drop constraint estimates_user_id_fkey,
  add constraint estimates_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.invoices
  drop constraint invoices_user_id_fkey,
  add constraint invoices_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.agreements
  drop constraint agreements_user_id_fkey,
  add constraint agreements_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.agreements
  drop constraint agreements_project_id_fkey,
  add constraint agreements_project_id_fkey foreign key (project_id) references public.projects(id) on delete cascade;

alter table public.agreements
  drop constraint agreements_client_id_fkey,
  add constraint agreements_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;

alter table public.contract_templates
  drop constraint contract_templates_user_id_fkey,
  add constraint contract_templates_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- assigned_by é NOT NULL (não dá para SET NULL) e a linha de atribuição morre junto com o
-- projeto de qualquer jeito: CASCADE é o comportamento honesto.
alter table public.project_members
  drop constraint project_members_assigned_by_fkey,
  add constraint project_members_assigned_by_fkey foreign key (assigned_by) references auth.users(id) on delete cascade;
