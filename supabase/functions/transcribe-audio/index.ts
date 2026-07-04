// PhotoQuote — transcribe-audio Edge Function.
// Audio (base64) -> text, via OpenAI transcription. Key read from app_config (RLS-locked,
// service-role only) so it never ships in the app. Returns { text } or { error }.
// Every call is logged to public.ai_jobs (model 'gpt-4o-mini-transcribe') for diagnostics.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const payload = JSON.parse(atob(tok.split('.')[1] || ''));
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

    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    sb = createClient(sUrl!, sKey!);
    const { data: cfg, error: cfgErr } = await sb.from('app_config').select('value').eq('key', 'OPENAI_API_KEY').maybeSingle();
    const apiKey = cfg?.value;
    if (!apiKey) {
      await logJob('error', { error: 'OpenAI key not configured' });
      return json({ error: 'OpenAI key not configured', debug: { cfgErr: cfgErr?.message || null } }, 500);
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
      return json({ error: `OpenAI request failed: ${(e as Error).message}` }, 504);
    } finally {
      clearTimeout(timer);
    }

    if (d?.error) {
      await logJob('error', { error: d.error.message || 'OpenAI error' });
      return json({ error: d.error.message || 'OpenAI error' }, 502);
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
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
