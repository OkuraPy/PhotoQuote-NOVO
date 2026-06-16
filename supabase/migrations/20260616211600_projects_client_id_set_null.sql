-- Deleting a client must NOT delete the client's projects. Switch the FK from CASCADE to SET NULL
-- so removing a client just unlinks the jobs (projects.client_id is already nullable).
ALTER TABLE public.projects DROP CONSTRAINT projects_client_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
