// PhotoQuote v2 — data access (Supabase). Maps real tables to the v2 UI shapes.
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { Client, deriveStage, Job, LineItem, Photo } from '../data';
export { deriveStage }; // re-exported for screens (lives in ../data so it's unit-testable)

/* ---------------- Location: real ZIP (Zippopotam, keyless) + GPS (expo-location) ---------------- */
export type Region = { city: string; state: string; zip: string; multiplier: number; label: string };

// Regional cost index for a US state (from the server table; national avg = 1.0 if unknown).
async function regionFor(state: string): Promise<{ multiplier: number; label: string }> {
  if (!state) return { multiplier: 1, label: 'Standard' };
  const { data } = await supabase.from('regional_pricing').select('multiplier, label').eq('state_code', state.toUpperCase()).maybeSingle();
  return { multiplier: Number(data?.multiplier) || 1, label: data?.label || 'Average' };
}

export async function lookupZip(zip: string): Promise<Region | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    const state = place['state abbreviation'];
    const r = await regionFor(state);
    return { city: place['place name'], state, zip, multiplier: r.multiplier, label: r.label };
  } catch {
    return null;
  }
}

export async function getMyLocation(): Promise<Region | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const [g] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    if (!g) return null;
    const state = g.region || '';
    const r = await regionFor(state);
    return { city: g.city || g.subregion || '', state, zip: g.postalCode || '', multiplier: r.multiplier, label: r.label };
  } catch {
    return null;
  }
}

const PHOTO_BUCKET = 'project-photos';

// Resize + upload each photo to project-photos/${userId}/${projectId}/ and return the public URLs.
// Best-effort: a photo that fails to upload is skipped, never blocks saving the job.
async function uploadProjectPhotos(userId: string, projectId: string, photos: Photo[]): Promise<string[]> {
  const results = await Promise.all(
    photos.map(async (photo, i): Promise<string | null> => {
      try {
        const m = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        if (!m.base64) return null;
        const path = `${userId}/${projectId}/photo_${i}.jpg`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, decode(m.base64), { contentType: 'image/jpeg', upsert: true });
        if (error) return null;
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
      } catch {
        return null; // skip a photo that fails, never block the save
      }
    })
  );
  return results.filter((u): u is string => !!u);
}

/* ---------------- Clients ---------------- */
export async function fetchClients(userId: string): Promise<Client[]> {
  const [{ data, error }, { data: projs }] = await Promise.all([
    supabase.from('clients').select('id, full_name, phone, email, address, address_street, address_city, address_state, address_zip, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('projects').select('client_id').eq('user_id', userId),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  (projs || []).forEach((p: any) => { if (p.client_id) counts.set(p.client_id, (counts.get(p.client_id) || 0) + 1); });
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.full_name || 'Unnamed',
    phone: c.phone || '',
    email: c.email || '',
    addr: c.address_street || c.address || '',
    city: [c.address_city, c.address_state].filter(Boolean).join(', '),
    zip: c.address_zip || '',
    state: c.address_state || '',
    jobs: counts.get(c.id) || 0,
  }));
}

export type ClientInput = { name: string; phone?: string; email?: string; street?: string; city?: string; state?: string; zip?: string; notes?: string };

// Maps the editor fields to the clients table: structured address columns (street/city/state/zip)
// plus the legacy `address` (kept = street, since the portal & contract read clients.address).
function clientRow(c: ClientInput) {
  return {
    full_name: c.name.trim(),
    phone: c.phone || null,
    email: c.email || null,
    address_street: c.street || null,
    address_city: c.city || null,
    address_state: c.state || null,
    address_zip: c.zip || null,
    address: c.street || null,
    notes: c.notes || null,
  };
}

export async function createClient(userId: string, c: ClientInput) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: userId, ...clientRow(c) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, c: ClientInput) {
  const { error } = await supabase.from('clients').update(clientRow(c)).eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// How many projects (jobs) are linked to this client — used to warn before deleting.
// With the FK now ON DELETE SET NULL, deleting only unlinks them; the jobs are kept.
export async function countClientProjects(clientId: string): Promise<number> {
  const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('client_id', clientId);
  return count || 0;
}

/* ---------------- Create a job (project + estimate + line items) ---------------- */
// Persists a freshly-generated estimate. The estimate's tax_rate/margin_rate are set BEFORE the
// line items so the `update_estimate_totals` trigger (fires on line_item insert) computes the
// subtotal/tax/margin/total itself — keeping the DB the single source of truth for money.
export async function createJob(input: {
  userId: string;
  clientId: string | null; // null = client-less draft (client is optional)
  name: string;
  address?: string;
  city?: string;
  taxRate: number;
  marginRate: number;
  confidence?: number;
  notes?: string;
  services?: string[];
  items: LineItem[];
  photos?: Photo[];
  zip?: string;
  state?: string;
}): Promise<{ projectId: string; estimateId: string }> {
  const serviceType = (input.services && input.services[0]) || null;
  const title = input.name.trim() || 'New estimate';

  const { data: proj, error: pErr } = await supabase
    .from('projects')
    .insert({
      user_id: input.userId,
      client_id: input.clientId,
      name: title,
      address: input.address || null,
      city: input.city || null,
      zip: input.zip || null,
      property_state: input.state || null,
      status: 'Draft',
      service_type: serviceType,
    })
    .select('id')
    .single();
  if (pErr) throw pErr;

  const { data: est, error: eErr } = await supabase
    .from('estimates')
    .insert({
      project_id: proj.id,
      user_id: input.userId,
      status: 'Draft',
      service_type: serviceType,
      tax_rate: input.taxRate,
      tax_percent: input.taxRate,
      margin_rate: input.marginRate,
      margin_percent: input.marginRate,
      confidence: input.confidence ?? 0,
      ai_confidence_score: input.confidence ?? null,
      title,
      estimate_notes: input.notes || null,
      notes: input.notes || null,
    })
    .select('id')
    .single();
  if (eErr) throw eErr;

  if (input.items.length) {
    const rows = input.items.map((it, i) => ({
      estimate_id: est.id,
      category: it.cat || 'Item',
      description: it.desc || '',
      unit: it.unit || 'ea',
      quantity: it.qty || 0,
      unit_price: it.price || 0,
      taxable: !!it.taxable,
      is_labor: (it.cat || '').toLowerCase() === 'labor',
      ai_generated: true,
      display_order: i,
      item_order: i,
    }));
    const { error: liErr } = await supabase.from('line_items').insert(rows);
    if (liErr) throw liErr;
  }

  // photos are best-effort — the estimate is already safely saved, so a failed upload won't lose it
  if (input.photos?.length) {
    const urls = await uploadProjectPhotos(input.userId, proj.id, input.photos);
    if (urls.length) await supabase.from('projects').update({ photo_urls: urls }).eq('id', proj.id);
  }

  return { projectId: proj.id, estimateId: est.id };
}

/* ---------------- Update an existing estimate (Edit from the job screen) ---------------- */
// Rates first, then replace the line items — the totals trigger fires on the item writes and
// recomputes subtotal/tax/margin/total server-side (incl. the all-items-deleted case).
// Not transactional (PostgREST): if the insert fails after the delete the estimate is left
// empty on the server, but the app still holds the items in memory so Save can be retried.
export async function updateEstimateItems(estimateId: string, items: LineItem[], taxRate: number, marginRate: number): Promise<void> {
  const { error: rErr } = await supabase
    .from('estimates')
    .update({ tax_rate: taxRate, tax_percent: taxRate, margin_rate: marginRate, margin_percent: marginRate })
    .eq('id', estimateId);
  if (rErr) throw rErr;
  const { error: dErr } = await supabase.from('line_items').delete().eq('estimate_id', estimateId);
  if (dErr) throw dErr;
  if (items.length) {
    const rows = items.map((it, i) => ({
      estimate_id: estimateId,
      category: it.cat || 'Item',
      description: it.desc || '',
      unit: it.unit || 'ea',
      quantity: it.qty || 0,
      unit_price: it.price || 0,
      taxable: !!it.taxable,
      is_labor: (it.cat || '').toLowerCase() === 'labor',
      ai_generated: false,
      display_order: i,
      item_order: i,
    }));
    const { error: iErr } = await supabase.from('line_items').insert(rows);
    if (iErr) throw iErr;
  }
}

/* ---------------- Invoice (generated from an approved estimate) ---------------- */
// Copies the estimate's totals (the DB trigger keeps those correct) and assigns a sequential
// per-user invoice number INV-YYYY-NNNN. No invoice-number trigger exists, so we mint it here.
export async function createInvoice(userId: string, estimateId: string, projectId: string): Promise<{ id: string; number: string }> {
  const [{ data: est, error: eErr }, { data: prof }] = await Promise.all([
    supabase.from('estimates').select('subtotal, tax_rate, tax_percent, tax_amount, margin_rate, margin_amount, total, grand_total').eq('id', estimateId).maybeSingle(),
    supabase.from('users').select('default_deposit_percent').eq('id', userId).maybeSingle(),
  ]);
  if (eErr) throw eErr;
  const depositPct = prof?.default_deposit_percent ?? 25; // snapshot the contractor's default deposit at invoice time

  // atomic per-user/per-year number from the DB (forces auth.uid() server-side; no race/collision)
  const { data: numData, error: nErr } = await supabase.rpc('next_invoice_number');
  if (nErr) throw nErr;
  const number = String(numData);

  const { data: inv, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      estimate_id: estimateId,
      project_id: projectId,
      invoice_number: number,
      status: 'Unpaid',
      subtotal: Number(est?.subtotal ?? 0),
      tax_rate: Number(est?.tax_rate ?? est?.tax_percent ?? 0),
      tax_amount: Number(est?.tax_amount ?? 0),
      margin_rate: Number(est?.margin_rate ?? 0),
      margin_amount: Number(est?.margin_amount ?? 0),
      total: Number(est?.total ?? est?.grand_total ?? 0),
      deposit_percent: depositPct,
    })
    .select('id, invoice_number')
    .single();
  if (error) throw error;
  return { id: inv.id, number: inv.invoice_number };
}

// Persist a status change to the DB (replaces the old in-memory-only stage override).
export async function updateEstimateStatus(estimateId: string, status: string) {
  const { error } = await supabase.from('estimates').update({ status }).eq('id', estimateId);
  if (error) throw error;
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);
  if (error) throw error;
}

/* ---------------- Contract / Agreement (generated from the invoice) ---------------- */
export const PORTAL_URL = 'https://photoquote-client-portal.vercel.app';
export const agreementLink = (token: string) => `${PORTAL_URL}/agreement/sign/${token}`;

// Escape dynamic values before they go into the contract HTML (rendered with dangerouslySetInnerHTML
// on the portal). The template itself is trusted; only the data needs escaping.
const escC = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money2 = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function lineItemsTableHtml(items: any[]): string {
  const rows = (items || [])
    .map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE">${escC(it.description)}</td><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE;text-align:right;white-space:nowrap">${qty} ${escC(it.unit)} × $${money2(price)}</td><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE;text-align:right;white-space:nowrap">$${money2(qty * price)}</td></tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #11705A">Item</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #11705A">Qty</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #11705A">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function fillTemplate(template: string, d: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in d ? d[k] : ''));
}

// Render the template's terms_blocks (jsonb: [{title, content}]). The content is trusted template HTML.
function renderTermsBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b: any) => `<h3>${escC(b?.title || '')}</h3>${typeof b?.content === 'string' ? b.content : ''}`)
    .join('\n');
}

// Generates the service agreement from the invoice + a contract template, stores it with a
// random token, and returns the token (used to build the client's signing link).
export async function createAgreement(userId: string, projectId: string, invoiceId: string): Promise<{ id: string; token: string }> {
  const [{ data: proj }, { data: inv }, { data: company }] = await Promise.all([
    supabase.from('projects').select('client_id, name, address, city, property_state, service_type, zip').eq('id', projectId).maybeSingle(),
    supabase.from('invoices').select('invoice_number, estimate_id, subtotal, tax_rate, tax_amount, total, deposit_percent').eq('id', invoiceId).maybeSingle(),
    supabase.from('users').select('company_name, company_address, company_phone, company_email, company_license, default_state, default_deposit_percent').eq('id', userId).maybeSingle(),
  ]);
  if (!proj) throw new Error('Project not found.');
  if (!proj.client_id) throw new Error('Add a client to this job before creating a contract.');
  if (!inv) throw new Error('Generate the invoice first.');

  const [{ data: client }, { data: items }] = await Promise.all([
    supabase.from('clients').select('full_name, address, address_city, address_state, phone, email').eq('id', proj.client_id).maybeSingle(),
    supabase.from('line_items').select('description, quantity, unit, unit_price').eq('estimate_id', inv.estimate_id).order('item_order', { ascending: true }),
  ]);

  const state = proj.property_state || company?.default_state || 'US';
  // one generic US template (is_default) covers all 50 states — the owner operates nationwide
  const tpl = (await supabase.from('contract_templates').select('content, terms_blocks').eq('is_default', true).limit(1).maybeSingle()).data;
  if (!tpl?.content) throw new Error('No contract template available.');

  // deposit % is set by the contractor; the invoice snapshots it so invoice & contract always match
  const depositPct = Number(inv.deposit_percent ?? company?.default_deposit_percent ?? 25);
  const total = Number(inv.total) || 0;
  const html = fillTemplate(tpl.content, {
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    company_name: escC(company?.company_name || 'Your Company'),
    company_address: escC(company?.company_address || ''),
    company_phone: escC(company?.company_phone || ''),
    company_email: escC(company?.company_email || ''),
    license_number: escC(company?.company_license || 'N/A'),
    client_name: escC(client?.full_name || ''),
    client_address: escC([client?.address, client?.address_city, client?.address_state].filter(Boolean).join(', ')),
    client_phone: escC(client?.phone || ''),
    client_email: escC(client?.email || ''),
    project_name: escC(proj.name || ''),
    service_address: escC([proj.address, proj.city, proj.zip].filter(Boolean).join(', ')),
    service_type: escC(proj.service_type || 'General construction'),
    invoice_number: escC(inv.invoice_number || ''),
    line_items_table: lineItemsTableHtml(items || []),
    total_amount: money2(total),
    subtotal: money2(Number(inv.subtotal) || 0),
    tax_rate: String(Number(inv.tax_rate) || 0),
    tax_amount: money2(Number(inv.tax_amount) || 0),
    deposit_percent: String(depositPct),
    deposit_amount: money2(total * (depositPct / 100)),
    balance_amount: money2(total - total * (depositPct / 100)),
    terms_blocks: renderTermsBlocks(tpl.terms_blocks),
  });

  const token = `agr_${Crypto.randomUUID().replace(/-/g, '')}`;
  const { data: agr, error } = await supabase
    .from('agreements')
    .insert({ user_id: userId, invoice_id: invoiceId, project_id: projectId, client_id: proj.client_id, state, contract_html: html, token, status: 'sent', sent_at: new Date().toISOString(), sent_method: 'link' })
    .select('id, token')
    .single();
  if (error) throw error;
  return { id: agr.id, token: agr.token };
}

/* ---------------- Jobs (project + its estimate/invoice → v2 Job) ---------------- */
export type RealJob = Job & { projectId: string; clientId: string | null };

// deriveStage moved to ../data (pure, unit-tested) and re-exported above.

const monthDay = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export async function fetchJobs(userId: string): Promise<RealJob[]> {
  const [proj, cli, est, inv] = await Promise.all([
    supabase.from('projects').select('id, name, client_id, address, city, created_at, photo_urls').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('clients').select('id, full_name').eq('user_id', userId),
    supabase.from('estimates').select('project_id, status, total, grand_total, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('project_id, status, total, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  if (proj.error) throw proj.error;

  const clients = new Map<string, string>((cli.data || []).map((c: any) => [c.id, c.full_name]));
  const estByProj = new Map<string, any>();
  (est.data || []).forEach((e: any) => {
    if (!estByProj.has(e.project_id)) estByProj.set(e.project_id, e); // first = newest (ordered desc)
  });
  const invByProj = new Map<string, any>();
  (inv.data || []).forEach((i: any) => { if (!invByProj.has(i.project_id)) invByProj.set(i.project_id, i); }); // newest invoice wins (matches fetchJobDetail)

  return (proj.data || []).map((p: any) => {
    const e = estByProj.get(p.id);
    const iv = invByProj.get(p.id);
    const value = Number(iv?.total ?? e?.total ?? e?.grand_total ?? 0) || 0;
    return {
      id: p.id,
      projectId: p.id,
      clientId: p.client_id || null,
      client: clients.get(p.client_id) || null,
      addr: p.address || p.city || '—',
      title: p.name || 'Untitled',
      stage: deriveStage(e?.status, iv?.status),
      value,
      photos: Array.isArray(p.photo_urls) ? p.photo_urls.length : 0,
      date: monthDay(p.created_at),
    };
  });
}

/* ---------------- Company profile (users table) ---------------- */
export async function fetchCompanyProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('company_name, company_address, company_phone, company_email, company_license, company_website, default_city, default_state, default_deposit_percent, default_tax_percent, default_margin_percent, logo_url')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function updateCompanyProfile(userId: string, p: { company_name?: string; company_license?: string; company_phone?: string; company_email?: string; company_address?: string; default_deposit_percent?: number | null; default_tax_percent?: number | null; default_margin_percent?: number | null; logo_url?: string | null }) {
  const { error } = await supabase.from('users').update(p).eq('id', userId);
  if (error) throw error;
}

const LOGO_BUCKET = 'company-logos';
// Resize + upload the company logo (public bucket) and return its URL (cache-busted so the new one shows).
export async function uploadCompanyLogo(userId: string, uri: string): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 512 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!m.base64) throw new Error('Could not process the image.');
  const path = `${userId}/logo.jpg`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, decode(m.base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/* ---------------- Job detail (real estimate + line items + invoice) ---------------- */
export type JobDetail = {
  estimate: { id: string; total: number; subtotal: number; taxRate: number; tax: number; marginRate: number; status: string; notes: string | null } | null;
  items: LineItem[];
  invoice: { id: string; number: string; status: string; subtotal: number; taxRate: number; tax: number; total: number; created: string; depositPercent: number | null } | null;
  client: { name: string; addr: string; city: string; email: string; phone: string } | null;
  photoUrls: string[];
  agreement: { id: string; token: string; status: string; signedName: string | null; signedDate: string | null } | null;
};

export async function fetchJobDetail(projectId: string): Promise<JobDetail> {
  const estRes = await supabase
    .from('estimates')
    .select('id, total, grand_total, subtotal, tax_rate, tax_amount, margin_rate, status, notes, estimate_notes')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (estRes.error) throw estRes.error;
  const est = estRes.data;

  let items: LineItem[] = [];
  if (est?.id) {
    const liRes = await supabase
      .from('line_items')
      .select('category, description, quantity, unit_price, unit, taxable, item_order')
      .eq('estimate_id', est.id)
      .order('item_order', { ascending: true });
    if (liRes.error) throw liRes.error;
    items = (liRes.data || []).map((it: any, i: number) => ({
      id: i,
      cat: it.category || 'Item',
      desc: it.description || '',
      qty: Number(it.quantity) || 0,
      unit: it.unit || 'job',
      price: Number(it.unit_price) || 0,
      taxable: it.taxable !== false,
    }));
  }

  const invRes = await supabase
    .from('invoices')
    .select('id, invoice_number, status, subtotal, tax_rate, tax_amount, total, created_at, deposit_percent')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invRes.error) throw invRes.error;
  const inv = invRes.data;

  const agrRes = await supabase
    .from('agreements')
    .select('id, token, status, signed_name, signed_date')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const agr = agrRes.data;

  // real client for the invoice "Bill to"
  let client: JobDetail['client'] = null;
  const projRes = await supabase.from('projects').select('client_id, photo_urls').eq('id', projectId).maybeSingle();
  if (projRes.data?.client_id) {
    const { data: c } = await supabase
      .from('clients')
      .select('full_name, address, address_city, address_state, email, phone')
      .eq('id', projRes.data.client_id)
      .maybeSingle();
    if (c) client = { name: c.full_name || '', addr: c.address || '', city: [c.address_city, c.address_state].filter(Boolean).join(', '), email: c.email || '', phone: c.phone || '' };
  }

  return {
    estimate: est
      ? { id: est.id, total: Number(est.total ?? est.grand_total ?? 0), subtotal: Number(est.subtotal ?? 0), taxRate: Number(est.tax_rate ?? 0), tax: Number(est.tax_amount ?? 0), marginRate: Number(est.margin_rate ?? 0), status: est.status, notes: est.notes ?? est.estimate_notes ?? null }
      : null,
    items,
    invoice: inv
      ? { id: inv.id, number: inv.invoice_number, status: inv.status, subtotal: Number(inv.subtotal ?? 0), taxRate: Number(inv.tax_rate ?? 0), tax: Number(inv.tax_amount ?? 0), total: Number(inv.total ?? 0), created: inv.created_at, depositPercent: inv.deposit_percent ?? null }
      : null,
    client,
    photoUrls: Array.isArray(projRes.data?.photo_urls) ? (projRes.data!.photo_urls as string[]) : [],
    agreement: agr ? { id: agr.id, token: agr.token, status: agr.status, signedName: agr.signed_name, signedDate: agr.signed_date } : null,
  };
}

/* ---------------- Progress: phases, photos, client share link ---------------- */
const PHASE_BUCKET = 'phase-photos';
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';
export type PhasePhoto = { id: string; url: string; caption: string | null };
export type PhaseComment = { id: string; authorType: 'contractor' | 'client'; authorName: string; content: string; createdAt: string };
export type ProgressPhase = {
  id: string;
  name: string;
  status: PhaseStatus;
  order: number;
  notes: string | null;
  visibleToClient: boolean;
  photos: PhasePhoto[];
  comments: PhaseComment[];
};

export async function fetchPhases(projectId: string): Promise<ProgressPhase[]> {
  const { data: phases, error } = await supabase
    .from('project_phases')
    .select('id, name, status, phase_order, notes, is_visible_to_client')
    .eq('project_id', projectId)
    .order('phase_order', { ascending: true });
  if (error) throw error;
  const ids = (phases || []).map((p: any) => p.id);
  const byPhase = new Map<string, PhasePhoto[]>();
  const commentsByPhase = new Map<string, PhaseComment[]>();
  if (ids.length) {
    const [{ data: photos }, { data: comments }] = await Promise.all([
      supabase.from('phase_photos').select('id, phase_id, file_url, caption, display_order').in('phase_id', ids).order('display_order', { ascending: true }),
      supabase.from('phase_comments').select('id, phase_id, author_type, author_name, content, created_at').in('phase_id', ids).order('created_at', { ascending: true }),
    ]);
    (photos || []).forEach((ph: any) => {
      const arr = byPhase.get(ph.phase_id) || [];
      arr.push({ id: ph.id, url: ph.file_url, caption: ph.caption ?? null });
      byPhase.set(ph.phase_id, arr);
    });
    (comments || []).forEach((cm: any) => {
      const arr = commentsByPhase.get(cm.phase_id) || [];
      arr.push({
        id: cm.id,
        authorType: cm.author_type === 'client' ? 'client' : 'contractor',
        authorName: cm.author_name || (cm.author_type === 'client' ? 'Client' : 'You'),
        content: cm.content || '',
        createdAt: cm.created_at,
      });
      commentsByPhase.set(cm.phase_id, arr);
    });
  }
  return (phases || []).map((p: any) => ({
    id: p.id,
    name: p.name || 'Phase',
    status: (p.status || 'not_started') as PhaseStatus,
    order: p.phase_order ?? 0,
    notes: p.notes ?? null,
    visibleToClient: p.is_visible_to_client !== false,
    photos: byPhase.get(p.id) || [],
    comments: commentsByPhase.get(p.id) || [],
  }));
}

// project_phases.estimate_id is NOT NULL — the caller passes the job's estimate id.
export async function createPhase(userId: string, projectId: string, estimateId: string, name: string, order: number): Promise<void> {
  const { error } = await supabase.from('project_phases').insert({
    project_id: projectId,
    estimate_id: estimateId,
    user_id: userId,
    name: name.trim() || 'Phase',
    phase_order: order,
    status: 'not_started',
    is_visible_to_client: true,
  });
  if (error) throw error;
}

export async function updatePhase(id: string, patch: { name?: string; status?: PhaseStatus; notes?: string | null; is_visible_to_client?: boolean }): Promise<void> {
  const { error } = await supabase.from('project_phases').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePhase(id: string): Promise<void> {
  // phase_photos & phase_comments FK to project_phases are ON DELETE CASCADE — deleting the phase
  // removes them automatically (storage objects are left as harmless orphans, same as elsewhere).
  const { error } = await supabase.from('project_phases').delete().eq('id', id);
  if (error) throw error;
}

// Resize + upload photos to the public `phase-photos` bucket and link them to the phase.
// Best-effort: a photo that fails is skipped. Returns how many were added.
export async function addPhasePhotos(userId: string, projectId: string, phaseId: string, photos: Photo[]): Promise<number> {
  const { count } = await supabase.from('phase_photos').select('id', { count: 'exact', head: true }).eq('phase_id', phaseId);
  let order = count || 0;
  let added = 0;
  for (const photo of photos) {
    try {
      const m = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!m.base64) continue;
      const path = `${userId}/${projectId}/${phaseId}/${Crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(PHASE_BUCKET).upload(path, decode(m.base64), { contentType: 'image/jpeg', upsert: true });
      if (upErr) continue;
      const { data } = supabase.storage.from(PHASE_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) continue;
      const { error: insErr } = await supabase.from('phase_photos').insert({ phase_id: phaseId, project_id: projectId, user_id: userId, file_url: data.publicUrl, display_order: order++ });
      if (!insErr) added++;
    } catch {
      /* skip a photo that fails, never block the others */
    }
  }
  return added;
}

export const progressLink = (token: string) => `${PORTAL_URL}/p/${token}`;

// Returns the project's active client-progress token, creating one (and stamping activated_at,
// which the portal uses as the start date) on first use.
export async function ensureShareToken(userId: string, projectId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('project_share_tokens')
    .select('token')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token;
  const token = Crypto.randomUUID().replace(/-/g, ''); // 32 hex chars
  const { error } = await supabase.from('project_share_tokens').insert({ project_id: projectId, user_id: userId, token, is_active: true });
  if (error) throw error;
  await supabase.from('projects').update({ activated_at: new Date().toISOString() }).eq('id', projectId).is('activated_at', null);
  return token;
}

// Contractor reply on a phase (phase_comments has no user_id — RLS is by project ownership).
// The client's own comments are written by the portal (author_type='client').
export async function addPhaseComment(projectId: string, phaseId: string, authorName: string, content: string): Promise<void> {
  const { error } = await supabase.from('phase_comments').insert({
    project_id: projectId,
    phase_id: phaseId,
    author_type: 'contractor',
    author_name: authorName || 'Contractor',
    content: content.trim(),
  });
  if (error) throw error;
}
