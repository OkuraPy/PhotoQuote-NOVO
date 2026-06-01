-- Client is now optional on a project (foto-first flow: orçar sem cliente, virar rascunho).
-- Existing rows keep their client_id; only new client-less drafts will be null.
alter table public.projects alter column client_id drop not null;
