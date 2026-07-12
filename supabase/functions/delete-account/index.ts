// PhotoQuote — delete-account Edge Function (Onda D; exigência da App Store Review 5.1.1(v):
// apps com criação de conta PRECISAM oferecer exclusão de conta dentro do app).
//
// POST (sem body) com o JWT do usuário -> apaga a PRÓPRIA conta, permanentemente:
//   - memberships onde é membro (team_members.member_user_id = uid)
//   - o time dele, se for owner (team_members.owner_id = uid) — as CONTAS dos membros
//     permanecem (são pessoas reais; ficam sem acesso a nada, viram conta vazia)
//   - ai_jobs do usuário (sem FK em prod; delete explícito por higiene e à prova de futuro)
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

    // signature PNGs live OUTSIDE {uid}/ (contract-signatures/signatures/…) and their only
    // index is agreements.signature_image_url — collect the paths BEFORE the cascade eats
    // the rows, or the client PII becomes unfindable orphans in a public bucket (review M1).
    let sigPaths: string[] = [];
    try {
      const { data: agrs } = await sb
        .from('agreements')
        .select('signature_image_url')
        .eq('user_id', uid)
        .not('signature_image_url', 'is', null);
      sigPaths = (agrs || [])
        .map((a: { signature_image_url: string }) => String(a.signature_image_url).split('/contract-signatures/')[1] || '')
        .filter((p: string) => p.length > 0);
    } catch (e) {
      console.error('[delete-account] signature path collection failed:', e);
    }

    // memberships (both directions) + ai_jobs (delete explícito por segurança/higiene)
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

    // storage: wipe {uid}/ RECURSIVELY (best-effort — an orphan file must never block the
    // deletion). list() is NOT recursive: folders come back as virtual entries (id === null)
    // and removing a "folder" path is a silent no-op — the app's real paths are nested
    // (uid/project/photo.jpg, uid/project/phase/uuid.jpg), so the old flat wipe deleted
    // nothing and looped blind for ~16s (review A1/M3, proven live).
    const listAllFiles = async (bucket: string, prefix: string, out: string[], depth: number): Promise<void> => {
      if (depth > 6) return; // app nesting is at most uid/project/phase/file
      for (let page = 0; page < 50; page++) {
        const { data: objs, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset: page * 100 });
        if (error || !objs || objs.length === 0) break;
        for (const o of objs as { name: string; id: string | null }[]) {
          const path = `${prefix}/${o.name}`;
          if (o.id === null) await listAllFiles(bucket, path, out, depth + 1);
          else out.push(path);
        }
        if (objs.length < 100) break;
      }
    };
    for (const bucket of APP_BUCKETS) {
      try {
        const files: string[] = [];
        await listAllFiles(bucket, uid, files, 0);
        for (let i = 0; i < files.length; i += 100) {
          const { error: rmErr } = await sb.storage.from(bucket).remove(files.slice(i, i + 100));
          if (rmErr) console.error(`[delete-account] remove batch failed (${bucket}):`, rmErr.message);
        }
      } catch (e) {
        console.error(`[delete-account] storage wipe ${bucket} failed:`, e);
      }
    }
    // client signatures collected above (public bucket, PII of the END CLIENT — must go)
    if (sigPaths.length) {
      try {
        await sb.storage.from('contract-signatures').remove(sigPaths);
      } catch (e) {
        console.error('[delete-account] signature wipe failed:', e);
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
