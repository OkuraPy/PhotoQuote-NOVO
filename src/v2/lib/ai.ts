// PhotoQuote v2 — AI estimate client.
// Compresses the captured photos and calls the `ai-estimate` Edge Function (which holds the
// OpenAI key server-side). Returns a normalized result the EstimateScreen can render directly.
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { LineItem, Photo } from '../data';

export type EstimateResult =
  | { ok: true; items: LineItem[]; confidence: number; notes: string }
  | { ok: false; rejected: true; reason: string }
  | { ok: false; error: string };

// OpenAI only needs a few photos and they must be small enough to ship in the request body.
const MAX_PHOTOS = 5;

// Resize + compress one photo and return it as a base64 data URL (what the function forwards to OpenAI).
async function toDataUrl(uri: string): Promise<string | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null; // skip a photo that can't be read rather than failing the whole estimate
  }
}

async function toDataUrls(photos: Photo[]): Promise<string[]> {
  const slice = photos.slice(0, MAX_PHOTOS);
  const urls = await Promise.all(slice.map((p) => toDataUrl(p.uri)));
  return urls.filter((u): u is string => !!u);
}

// Try to surface the function's JSON `error`/`reason` even when supabase-js wraps it in FunctionsHttpError.
async function readErrorBody(error: any): Promise<string | null> {
  try {
    const body = await error?.context?.json?.();
    return body?.error || body?.reason || null;
  } catch {
    return null;
  }
}

export async function requestEstimate(input: {
  photos: Photo[];
  services: string[];
  description: string;
}): Promise<EstimateResult> {
  const imageUrls = await toDataUrls(input.photos);
  if (imageUrls.length === 0) return { ok: false, error: 'No photos to analyze. Add at least one photo.' };

  const { data, error } = await supabase.functions.invoke('ai-estimate', {
    body: { imageUrls, services: input.services, description: input.description },
  });

  if (error) {
    const detail = await readErrorBody(error);
    return { ok: false, error: detail || error.message || 'Could not reach the estimate service.' };
  }
  if (data?.rejected) return { ok: false, rejected: true, reason: data.reason || 'These photos don’t look like a construction job.' };
  if (data?.error) return { ok: false, error: data.error };

  const raw = Array.isArray(data?.lineItems) ? data.lineItems : [];
  const items: LineItem[] = raw.map((it: any, i: number) => ({
    id: Date.now() + i,
    cat: String(it.category || 'Item'),
    desc: String(it.description || ''),
    qty: Number(it.quantity) || 0,
    unit: String(it.unit || 'ea'),
    price: Number(it.unitPrice) || 0,
    taxable: !!it.taxable,
  }));
  if (items.length === 0) return { ok: false, error: 'The AI didn’t return any line items. Try again with clearer photos.' };

  return {
    ok: true,
    items,
    confidence: Math.max(0, Math.min(100, Number(data.confidence) || 0)),
    notes: String(data.notes || ''),
  };
}
