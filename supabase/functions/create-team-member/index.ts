// PhotoQuote — create-team-member Edge Function (Onda B, equipe MVP).
// Owner-driven onboarding (design approved by the owner, REPLACES the invite-code
// flow from docs/ESTUDO_2026-07-11.md §2): the OWNER types name+email+password in
// the app, this function creates the auth user (email pre-confirmed — no e-mail
// server involved) AND the ACTIVE team_members row in one shot. The employee just
// logs in with those credentials. No redeem RPC, no invite codes.
//
// POST { name, email, password, role: 'field'|'office', canSeeFinancials?: boolean }
//   -> 200 { ok: true, memberId, memberUserId }   (memberId = team_members.id,
//      the id project_members.member_id points at — the app needs it for assigning)
//   -> 400 invalid_name|invalid_email|weak_password|invalid_role|member_limit_reached
//   -> 401 unauthorized · 403 members_cannot_create_members
//   -> 409 email_in_use|member_exists · 500 otherwise
//
// AuthZ model: any authenticated account that is NOT itself an active member of a
// team is an "owner" and may create members (1 team level, MVP). Deploy with
// verify_jwt ENABLED (the default — do NOT pass --no-verify-jwt): the gateway
// rejects garbage tokens; we still resolve the caller via auth.getUser() below as
// belt-and-braces, so a mis-deploy fails closed instead of trusting a raw header.
//
// Side effect to be aware of: the handle_new_user trigger creates a public.users
// row for the new auth user (the member's PERSONAL profile — harmless; the app
// always renders the OWNER's profile via ownerId). Rollback path: if the
// team_members insert fails we admin.deleteUser() the just-created auth user,
// which cascades that public.users row away (users_id_fkey ON DELETE CASCADE).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['field', 'office'] as const;
const MAX_ACTIVE_MEMBERS = 10; // MVP seat gate per owner (plans/billing = later wave)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = typeof body?.role === 'string' ? body.role : '';
    const canSeeFinancials = body?.canSeeFinancials === true; // strict: anything else = false

    if (!name || name.length > 80) return json({ error: 'invalid_name' }, 400);
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: 'weak_password' }, 400);
    if (!(ROLES as readonly string[]).includes(role)) return json({ error: 'invalid_role' }, 400);

    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!sUrl || !sKey) return json({ error: 'server_misconfigured' }, 500);
    const sb = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // ---- caller = the owner ------------------------------------------------
    // Resolve the caller from the JWT through GoTrue (not by decoding locally):
    // even if someone deploys this with --no-verify-jwt by mistake, an invalid
    // token still dies here.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: callerData, error: callerErr } = await sb.auth.getUser(jwt);
    const ownerId = callerData?.user?.id;
    if (callerErr || !ownerId) return json({ error: 'unauthorized' }, 401);

    // Only a non-member creates members (the MVP has exactly one team level:
    // owner -> members; a member of someone must not spawn a sub-team).
    const { data: callerMembership, error: cmErr } = await sb
      .from('team_members')
      .select('id')
      .eq('member_user_id', ownerId)
      .eq('status', 'active')
      .limit(1);
    if (cmErr) return json({ error: 'membership_check_failed' }, 500);
    if ((callerMembership?.length ?? 0) > 0) return json({ error: 'members_cannot_create_members' }, 403);

    // ---- MVP seat gate -----------------------------------------------------
    const { count, error: cntErr } = await sb
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('status', 'active');
    if (cntErr) return json({ error: 'member_count_failed' }, 500);
    if ((count ?? 0) >= MAX_ACTIVE_MEMBERS) return json({ error: 'member_limit_reached' }, 400);

    // ---- create the auth user (service role) --------------------------------
    // email_confirm: the account must work on first login — the owner hands the
    // credentials over in person/WhatsApp, there is no confirmation e-mail flow.
    // user_metadata: full_name is the MEMBER's name; company_name mirrors it only
    // because handle_new_user copies that key into the member's (unused) personal
    // public.users profile — it is NOT the owner's company.
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, company_name: name },
    });
    if (createErr || !created?.user?.id) {
      const code = (createErr as { code?: string } | null)?.code || '';
      const msg = createErr?.message || '';
      if (code === 'email_exists' || /already.+regist/i.test(msg)) {
        return json({ error: 'email_in_use' }, 409);
      }
      console.error('[create-team-member] createUser failed:', code, msg);
      return json({ error: 'user_create_failed' }, 500);
    }
    const memberUserId = created.user.id;

    // ---- membership row, ACTIVE right away ----------------------------------
    const { data: row, error: insErr } = await sb
      .from('team_members')
      .insert({
        owner_id: ownerId,
        member_user_id: memberUserId,
        member_email: email,
        full_name: name,
        role,
        can_see_financials: canSeeFinancials,
        status: 'active',
      })
      .select('id')
      .single();

    if (insErr || !row?.id) {
      // Rollback the orphan auth user so the e-mail can be retried cleanly
      // (cascades the trigger-created public.users profile away too).
      try {
        await sb.auth.admin.deleteUser(memberUserId);
      } catch (delErr) {
        console.error('[create-team-member] ROLLBACK deleteUser failed — orphan auth user', memberUserId, delErr);
      }
      // 23505 = unique_violation: (owner_id, member_email) reused, or the user
      // somehow already holds an active membership (team_members_active_member_uniq)
      if ((insErr as { code?: string } | null)?.code === '23505') {
        return json({ error: 'member_exists' }, 409);
      }
      console.error('[create-team-member] membership insert failed:', insErr?.message);
      return json({ error: 'membership_insert_failed' }, 500);
    }

    return json({ ok: true, memberId: row.id, memberUserId });
  } catch (e) {
    console.error('[create-team-member] unhandled:', e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
