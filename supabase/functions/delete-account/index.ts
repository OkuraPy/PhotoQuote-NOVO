// PhotoQuote — delete-account Edge Function (Onda D; exigência da App Store Review 5.1.1(v):
// apps com criação de conta PRECISAM oferecer exclusão de conta dentro do app).
//
// POST (sem body) com o JWT do usuário -> apaga a PRÓPRIA conta, permanentemente:
//   - memberships onde é membro (team_members.member_user_id = uid)
//   - o time dele, se for owner (team_members.owner_id = uid) — as CONTAS dos membros
//     permanecem (são pessoas reais; ficam sem acesso a nada, viram conta vazia)
//   - ai_jobs do usuário (FK sem cascade — apagar antes destrava o deleteUser)
//   - objetos de storage nas pastas {uid}/ dos buckets do app (best-effort)
//   - auth.users -> CASCADE: public.users -> clients/projects/price_tables -> estimates,
//     line_items, invoices (+schedule/payments/line_items), agreements, media, fases,
//     fotos, comentários, share tokens (grafo conferido em prod: tudo CASCADE).
//
// Fail-closed: qualquer falha antes do deleteUser retorna erro e NADA irreversível
// acontece fora de ordem (storage é a única etapa best-effort, e roda ANTES do
// deleteUser de propósito — depois dele não há mais dono para autorizar nada).
// -> 200 { ok: true } · 401 unauthorized · 500 delete_failed
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const APP_BUCKETS = ['project-photos', 'phase-photos', 'company-logos'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!sUrl || !sKey) return json({ error: 'server_misconfigured' }, 500);
    const sb = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // caller = the account being deleted (resolved via GoTrue, fail-closed)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);
    const { data: callerData, error: callerErr } = await sb.auth.getUser(jwt);
    const uid = callerData?.user?.id;
    if (callerErr || !uid) return json({ error: 'unauthorized' }, 401);

    // memberships (both directions) + ai_jobs (FK without cascade would block deleteUser)
    const { error: m1 } = await sb.from('team_members').delete().eq('member_user_id', uid);
    if (m1) {
      console.error('[delete-account] memberships delete failed:', m1.message);
      return json({ error: 'delete_failed' }, 500);
    }
    const { error: m2 } = await sb.from('team_members').delete().eq('owner_id', uid);
    if (m2) {
      console.error('[delete-account] team delete failed:', m2.message);
      return json({ error: 'delete_failed' }, 500);
    }
    const { error: aj } = await sb.from('ai_jobs').delete().eq('user_id', uid);
    if (aj) {
      console.error('[delete-account] ai_jobs delete failed:', aj.message);
      return json({ error: 'delete_failed' }, 500);
    }

    // storage: wipe {uid}/ folders (best-effort — an orphan file must never block the deletion)
    for (const bucket of APP_BUCKETS) {
      try {
        for (let page = 0; page < 40; page++) {
          const { data: objs } = await sb.storage.from(bucket).list(uid, { limit: 100 });
          if (!objs || objs.length === 0) break;
          const paths = objs.map((o: { name: string }) => `${uid}/${o.name}`);
          const { error: rmErr } = await sb.storage.from(bucket).remove(paths);
          if (rmErr) break; // best-effort: log-and-move-on
        }
      } catch (e) {
        console.error(`[delete-account] storage wipe ${bucket} failed:`, e);
      }
    }

    // the point of no return — cascades the whole business data graph away
    const { error: delErr } = await sb.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error('[delete-account] deleteUser failed:', delErr.message);
      return json({ error: 'delete_failed' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('[delete-account] unhandled:', e);
    return json({ error: 'delete_failed' }, 500);
  }
});
