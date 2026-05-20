-- Phase 4: security hardening (addresses Supabase advisor warnings).

-- 1. Public buckets should not allow LISTING every file. Public object URLs
--    (/storage/v1/object/public/...) keep working without these SELECT policies;
--    only the ability to enumerate other users' files is removed. Upload/update/
--    delete policies are left intact.
drop policy if exists "Anyone can view logos" on storage.objects;
drop policy if exists "Anyone can view phase photos" on storage.objects;
drop policy if exists "Anyone can view project photos" on storage.objects;
drop policy if exists "Anyone can view signatures" on storage.objects;

-- 2. Pin search_path on the functions flagged by the linter (prevents search_path
--    injection — important for SECURITY DEFINER functions). EXECUTE grants are left
--    untouched: user_has_*/get_member_role are used inside RLS policies, so revoking
--    their EXECUTE from authenticated would break row-level security.
alter function public.generate_estimate_number() set search_path = public, pg_temp;
alter function public.generate_estimate_number(uuid) set search_path = public, pg_temp;
alter function public.trigger_generate_estimate_number() set search_path = public, pg_temp;
alter function public.update_updated_at() set search_path = public, pg_temp;
alter function public.user_has_project_access(uuid) set search_path = public, pg_temp;
alter function public.user_has_team_access(uuid) set search_path = public, pg_temp;
alter function public.get_member_role(uuid) set search_path = public, pg_temp;
alter function public.get_agreement_by_token(text) set search_path = public, pg_temp;
alter function public.sign_agreement(text, text, text, text) set search_path = public, pg_temp;

-- 3. handle_new_user is an auth (on auth.users) trigger, not an RPC. Remove its
--    REST-exposed EXECUTE so it can't be called over /rest/v1/rpc. The signup
--    trigger still fires (trigger execution does not depend on the caller's grant).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
