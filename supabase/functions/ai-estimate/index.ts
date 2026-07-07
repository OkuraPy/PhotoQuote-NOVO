// PhotoQuote — ai-estimate Edge Function.
// Photo(s) -> construction estimate JSON, via OpenAI (gpt-5.2, fast). Key read from app_config
// (RLS-locked, service-role only). Returns { lineItems, confidence, notes } or { rejected, reason }.
// Every call is logged to public.ai_jobs (status/model/duration/tokens/error) for diagnostics.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are a professional construction estimator with 20+ years of experience.
Analyze the photo(s). FIRST validate they show a construction / renovation / repair / maintenance scene.
If they do NOT (e.g. landscape, food, people, electronics, random scene), reply ONLY with:
{"rejected":true,"reason":"<short reason>"}
Otherwise, base the estimate on what you actually SEE. Reply ONLY with valid JSON:
{"lineItems":[{"category":"Labor"|"Materials"|"Service"|"Equipment","description":"<specific item>","quantity":<number>,"unit":"<hr|sq|gal|ls|ea|bag|...>","unitPrice":<number USD>,"taxable":<boolean>}],"confidence":<0-100>,"notes":"<what you saw / assumptions>"}
Rules: 4-10 line items covering prep, main work, finishing and cleanup. Materials are usually taxable, labor usually not. Add items for visible damage (water, mold, cracks). Use realistic US prices.
The estimate goes to a US client: ALWAYS write every lineItem field (description, unit) in US English — even when the contractor's notes are in Portuguese, Spanish or any other language. Write "notes" in the SAME language as the contractor's notes (English if none). Output JSON only.`;

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
  let photoCount = 0;
  // best-effort diagnostics log — never let a logging failure affect the response
  const logJob = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!sb) return;
    try {
      await sb.from('ai_jobs').insert({ user_id: uid, status, model: 'gpt-5.2', photo_count: photoCount, duration_ms: Date.now() - started, ...extra });
    } catch {
      /* ignore */
    }
  };

  try {
    const { imageUrls = [], services = [], description = '' } = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 5) : [];
    photoCount = urls.length;
    if (urls.length === 0) return json({ error: 'No images provided' }, 400);

    const sUrl = Deno.env.get('SUPABASE_URL');
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    sb = createClient(sUrl!, sKey!);
    const { data: cfg, error: cfgErr } = await sb.from('app_config').select('value').eq('key', 'OPENAI_API_KEY').maybeSingle();
    const apiKey = cfg?.value;
    if (!apiKey) {
      await logJob('error', { error: 'OpenAI key not configured' });
      return json({ error: 'OpenAI key not configured', debug: { hasUrl: !!sUrl, hasServiceKey: !!sKey, cfgErr: cfgErr?.message || null } }, 500);
    }

    const userText =
      `Services: ${(services as string[]).join(', ') || 'general construction'}. ` +
      `${description ? `Client notes: ${description}. ` : ''}` +
      `Generate a construction estimate as JSON for the work visible in the photo(s).`;

    const body = {
      model: 'gpt-5.2',
      instructions: SYSTEM,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userText },
            ...urls.map((u) => ({ type: 'input_image', image_url: u })),
          ],
        },
      ],
      text: { format: { type: 'json_object' } },
      reasoning: { effort: 'low' },
      max_output_tokens: 3000,
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    let d: any;
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

    const ot = Number(d?.usage?.output_tokens);
    const outTokens = Number.isFinite(ot) ? ot : null;

    const txt: string = (d.output || [])
      .filter((o: any) => o.type === 'message')
      .flatMap((o: any) => o.content || [])
      .filter((c: any) => c.type === 'output_text')
      .map((c: any) => c.text)
      .join('');
    if (!txt) {
      await logJob('error', { error: 'Empty AI response', output_tokens: outTokens });
      return json({ error: 'Empty AI response' }, 502);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
    if (!parsed) {
      await logJob('error', { error: 'malformed JSON', output_tokens: outTokens });
      return json({ error: 'AI returned malformed JSON', raw: txt.slice(0, 300) }, 502);
    }

    if (parsed.rejected) {
      await logJob('rejected', { output_tokens: outTokens, error: parsed.reason || null });
      return json({ rejected: true, reason: parsed.reason || 'Not a construction photo' }, 200);
    }

    // normalize
    const items = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    const lineItems = items
      .map((it: any) => ({
        category: String(it.category || 'Item'),
        description: String(it.description || ''),
        quantity: Math.max(0, Number(it.quantity) || 1),
        unit: String(it.unit || 'job'),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        taxable: it.taxable !== false,
      }))
      .filter((it: any) => it.unitPrice > 0 || it.quantity > 0);

    await logJob('done', { output_tokens: outTokens });
    return json({
      lineItems,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 75)),
      notes: String(parsed.notes || ''),
    });
  } catch (e) {
    await logJob('error', { error: String((e as Error)?.message || e) });
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
