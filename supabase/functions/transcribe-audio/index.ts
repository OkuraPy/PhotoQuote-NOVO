// PhotoQuote — transcribe-audio Edge Function (v4).
// Audio (base64) -> text, via OpenAI transcription. Key read from app_config (RLS-locked,
// service-role only) so it never ships in the app. Returns { text } or { error }.
// Every call is logged to public.ai_jobs (model 'gpt-4o-mini-transcribe') for diagnostics.
// v4 (revisão geral): teto de tamanho do áudio (só havia piso), rate-limit por usuário via
// ai_jobs, respostas de erro genéricas (detalhe fica no log).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const AI_CALLS_PER_HOUR = 60; // shared per-user budget across the AI functions
const MAX_B64_CHARS = 20_000_000; // ~15MB binary — a dictation is seconds, this is minutes
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Decode a base64 string (with or without a data: prefix) to bytes.
function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

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
      await sb.from('ai_jobs').insert({ user_id: uid, status, model: 'gpt-4o-mini-transcribe', duration_ms: Date.now() - started, ...extra });
    } catch {
      /* ignore */
    }
  };

  try {
    const { audio = '', mime = 'audio/m4a', filename = 'audio.m4a', language } = await req.json().catch(() => ({}));
    if (!audio || typeof audio !== 'string') return json({ error: 'No audio provided' }, 400);
    // hard ceiling BEFORE decoding — don't even materialize a giant buffer
    if (audio.length > MAX_B64_CHARS) return json({ error: 'Audio too large' }, 400);

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

    let bytes: Uint8Array;
    try {
      bytes = b64ToBytes(audio);
    } catch {
      await logJob('error', { error: 'Invalid audio encoding' });
      return json({ error: 'Invalid audio encoding' }, 400);
    }
    if (bytes.length < 256) {
      await logJob('error', { error: 'Audio too short' });
      return json({ error: 'Audio too short' }, 400);
    }
    if (bytes.length > MAX_AUDIO_BYTES) {
      await logJob('error', { error: 'Audio too large' });
      return json({ error: 'Audio too large' }, 400);
    }

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), filename);
    form.append('model', 'gpt-4o-mini-transcribe');
    form.append('response_format', 'json');
    if (language && typeof language === 'string') form.append('language', language);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    let d: any;
    try {
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
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
    const text = String(d?.text || '').trim();
    if (!text) {
      await logJob('error', { error: 'Empty transcription' });
      return json({ error: 'Empty transcription' }, 502);
    }
    await logJob('done');
    return json({ text });
  } catch (e) {
    await logJob('error', { error: String((e as Error)?.message || e) });
    return json({ error: 'Internal error' }, 500);
  }
});
