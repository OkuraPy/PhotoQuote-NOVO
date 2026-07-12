-- ONDA B — hotfix descoberto no E2E: as 5 tabelas de equipe (criadas na migration de
-- abril com o mesmo padrão de revoke que quebrou a ai_jobs) deixaram service_role sem
-- DML — create-team-member morria em "membership_check_failed" no primeiro SELECT.
-- Também remove TRUNCATE de anon/authenticated (inalcançável via PostgREST, mas
-- TRUNCATE ignora RLS — não é grant que papel de API deva ter).

grant select, insert, update, delete on public.team_members    to service_role;
grant select, insert, update, delete on public.project_members to service_role;
grant select, insert, update, delete on public.project_phases  to service_role;
grant select, insert, update, delete on public.phase_photos    to service_role;
grant select, insert, update, delete on public.phase_comments  to service_role;

revoke truncate on public.team_members    from anon, authenticated;
revoke truncate on public.project_members from anon, authenticated;
revoke truncate on public.project_phases  from anon, authenticated;
revoke truncate on public.phase_photos    from anon, authenticated;
revoke truncate on public.phase_comments  from anon, authenticated;

-- rollback:
--   revoke select, insert, update, delete on public.team_members, public.project_members,
--     public.project_phases, public.phase_photos, public.phase_comments from service_role;
--   (TRUNCATE de anon/authenticated não volta — nunca deveria ter existido)
