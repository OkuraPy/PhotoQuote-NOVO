// PhotoQuote — transcribe-audio Edge Function.
// Audio (base64) -> text, via OpenAI transcription. Key read from app_config (RLS-locked,
// service-role only) so it never ships in the app. Returns { text } or { error }.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const { audio = '', mime = 'audio/m4a', filename = 'audio.m4a', language } = await req.json().catch(() => ({}));
    if (!audio || typeof audio !== 'string') return json({ error: 'No audio provided' }, 400);

    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    const sb = createClient(sUrl!, sKey!);
    const { data: cfg, error: cfgErr } = await sb.from('app_config').select('value').eq('key', 'OPENAI_API_KEY').maybeSingle();
    const apiKey = cfg?.value;
    if (!apiKey) return json({ error: 'OpenAI key not configured', debug: { cfgErr: cfgErr?.message || null } }, 500);

    let bytes: Uint8Array;
    try {
      bytes = b64ToBytes(audio);
    } catch {
      return json({ error: 'Invalid audio encoding' }, 400);
    }
    if (bytes.length < 256) return json({ error: 'Audio too short' }, 400);

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
      return json({ error: `OpenAI request failed: ${(e as Error).message}` }, 504);
    } finally {
      clearTimeout(timer);
    }

    if (d?.error) return json({ error: d.error.message || 'OpenAI error' }, 502);
    const text = String(d?.text || '').trim();
    if (!text) return json({ error: 'Empty transcription' }, 502);
    return json({ text });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
