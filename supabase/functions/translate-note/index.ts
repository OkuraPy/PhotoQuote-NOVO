// PhotoQuote — translate-note Edge Function (G1b).
// { text } -> { translated, detected }: turns a contractor's pt/es note into professional
// US-English for client-facing documents (quote/invoice/contract "Notes" section). Key read
// from app_config (RLS-locked, service-role only) so it never ships in the app.
// Every call is logged to public.ai_jobs (model 'translate-note:gpt-4o-mini') for diagnostics —
// ai_jobs has no "function" column, so the function name is encoded in the model tag (same idea
// as transcribe-audio's distinct model string).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// keep requests bounded — a document note is short; anything longer is truncated, not rejected
const MAX_CHARS = 2000;
const AI_CALLS_PER_HOUR = 60; // shared per-user budget across the AI functions (v2, revisão geral)

// user id from the (already Supabase-verified) JWT, for the ai_jobs log
function userIdFromJwt(req: Request): string | null {
  try {
    const tok = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const payload = JSON.parse(atob((tok.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT =
  'You translate short notes written by construction contractors into professional US-English for client-facing documents (quotes, invoices, service agreements). ' +
  'Translate faithfully: never add, remove or soften information; keep numbers, prices, measurements, dates and proper names exactly as written; keep the same paragraph/line breaks. ' +
  'If the text is already English, return it unchanged. ' +
  'Respond with JSON only, exactly: {"translated": string, "detected": string} where detected is the ISO 639-1 code of the SOURCE language (e.g. "pt", "es", "en").';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const started = Date.now();
  const uid = userIdFromJwt(req);
  // deno-lint-ignore no-explicit-any
  let sb: any = null;
  // best-effort diagnostics log — never let a logging failure affect the response
  const logJob = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!sb) return;
    try {
      await sb.from('ai_jobs').insert({ user_id: uid, status, model: 'translate-note:gpt-4o-mini', duration_ms: Date.now() - started, ...extra });
    } catch {
      /* ignore */
    }
  };

  try {
    const { text = '' } = await req.json().catch(() => ({}));
    if (!text || typeof text !== 'string' || !text.trim()) return json({ error: 'No text provided' }, 400);

    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    sb = createClient(sUrl!, sKey!);

    // abuse guard: N calls/user/hour across ALL AI functions (ai_jobs is the shared counter).
    // Fail-open — a counting hiccup must never block real work; the log records the denial.
    if (uid) {
      try {
        const { count } = await sb
          .from('ai_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .neq('status', 'rate_limited') // denied attempts must not renew the lockout
          .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
        if ((count ?? 0) >= AI_CALLS_PER_HOUR) {
          await logJob('rate_limited', { error: 'hourly cap' });
          return json({ error: 'Too many AI requests — try again in a while.' }, 429);
        }
      } catch {
        /* fail-open */
      }
    }

    const { data: cfg } = await sb.from('app_config').select('value').eq('key', 'OPENAI_API_KEY').maybeSingle();
    const apiKey = cfg?.value;
    if (!apiKey) {
      await logJob('error', { error: 'OpenAI key not configured' });
      return json({ error: 'Service not configured' }, 500);
    }

    const input = text.trim().slice(0, MAX_CHARS);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    // deno-lint-ignore no-explicit-any
    let d: any;
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: input },
          ],
        }),
        signal: ctrl.signal,
      });
      d = await r.json();
    } catch (e) {
      await logJob('error', { error: `OpenAI request failed: ${(e as Error).message}` });
      return json({ error: 'AI request failed' }, 504);
    } finally {
      clearTimeout(timer);
    }

    if (d?.error) {
      await logJob('error', { error: d.error.message || 'OpenAI error' });
      return json({ error: 'AI provider error' }, 502);
    }

    let translated = '';
    let detected = '';
    try {
      const parsed = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
      translated = String(parsed?.translated || '').trim();
      detected = String(parsed?.detected || '').trim().toLowerCase();
    } catch {
      /* falls through to the empty check below */
    }
    if (!translated) {
      await logJob('error', { error: 'Empty translation' });
      return json({ error: 'Empty translation' }, 502);
    }

    await logJob('done', { output_tokens: d?.usage?.completion_tokens ?? null });
    return json({ translated, detected });
  } catch (e) {
    await logJob('error', { error: String((e as Error)?.message || e) });
    return json({ error: 'Internal error' }, 500);
  }
});
