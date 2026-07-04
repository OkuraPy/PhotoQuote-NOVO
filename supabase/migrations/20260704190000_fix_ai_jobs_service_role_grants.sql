-- Fix: the AI diagnostics log (ai_jobs) NEVER recorded anything.
--
-- The ai-estimate / transcribe-audio Edge Functions insert into public.ai_jobs via the
-- service role, but the table was created without WRITE grants for service_role
-- (it only had REFERENCES/TRIGGER/TRUNCATE). Every insert failed with "permission denied"
-- and was swallowed by the functions' best-effort catch — so ai_jobs stayed empty since
-- 2026-06-17 and the owner's original pain ("the AI breaks and there's no trace") persisted.
-- Same failure class as the app_config GRANT bug fixed in Phase 1.
grant select, insert on table public.ai_jobs to service_role;

-- Hygiene: web-facing roles must not hold table-level TRUNCATE (TRUNCATE is not gated by RLS),
-- and anon has no business touching the diagnostics table at all (RLS already denies reads).
revoke all on table public.ai_jobs from anon;
revoke truncate on table public.ai_jobs from authenticated;

-- Defense-in-depth: app_config holds the OpenAI key. Only the service role (Edge Functions)
-- reads it; RLS already blocks client roles, but the table-level grants shouldn't exist either.
revoke all on table public.app_config from anon, authenticated;
