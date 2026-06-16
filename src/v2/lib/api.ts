// PhotoQuote v2 — data access (Supabase). Maps real tables to the v2 UI shapes.
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { Client, Job, LineItem, Photo } from '../data';
import { Stage } from '../theme';

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
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, phone, email, address, address_city, address_state, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.full_name || 'Unnamed',
    phone: c.phone || '',
    email: c.email || '',
    addr: c.address || '',
    city: [c.address_city, c.address_state].filter(Boolean).join(', '),
    jobs: 0,
  }));
}

export async function createClient(userId: string, c: { name: string; phone?: string; email?: string; address?: string; notes?: string }) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: userId, full_name: c.name.trim(), phone: c.phone || null, email: c.email || null, address: c.address || null, notes: c.notes || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, c: { name: string; phone?: string; email?: string; address?: string; notes?: string }) {
  const { error } = await supabase
    .from('clients')
    .update({ full_name: c.name.trim(), phone: c.phone || null, email: c.email || null, address: c.address || null, notes: c.notes || null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
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
      status: 'draft',
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
      status: 'draft',
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

/* ---------------- Invoice (generated from an approved estimate) ---------------- */
// Copies the estimate's totals (the DB trigger keeps those correct) and assigns a sequential
// per-user invoice number INV-YYYY-NNNN. No invoice-number trigger exists, so we mint it here.
export async function createInvoice(userId: string, estimateId: string, projectId: string): Promise<{ id: string; number: string }> {
  const { data: est, error: eErr } = await supabase
    .from('estimates')
    .select('subtotal, tax_rate, tax_percent, tax_amount, margin_rate, margin_amount, total, grand_total')
    .eq('id', estimateId)
    .maybeSingle();
  if (eErr) throw eErr;

  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const number = `INV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

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
    })
    .select('id, invoice_number')
    .single();
  if (error) throw error;
  return { id: inv.id, number: inv.invoice_number };
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

// Generates the service agreement from the invoice + a contract template, stores it with a
// random token, and returns the token (used to build the client's signing link).
export async function createAgreement(userId: string, projectId: string, invoiceId: string): Promise<{ id: string; token: string }> {
  const [{ data: proj }, { data: inv }, { data: company }] = await Promise.all([
    supabase.from('projects').select('client_id, name, address, city, property_state, service_type, zip').eq('id', projectId).maybeSingle(),
    supabase.from('invoices').select('invoice_number, estimate_id, subtotal, tax_rate, tax_amount, total').eq('id', invoiceId).maybeSingle(),
    supabase.from('users').select('company_name, company_address, company_phone, company_email, company_license, default_state').eq('id', userId).maybeSingle(),
  ]);
  if (!proj) throw new Error('Project not found.');
  if (!proj.client_id) throw new Error('Add a client to this job before creating a contract.');
  if (!inv) throw new Error('Generate the invoice first.');

  const [{ data: client }, { data: items }] = await Promise.all([
    supabase.from('clients').select('full_name, address, address_city, address_state, phone, email').eq('id', proj.client_id).maybeSingle(),
    supabase.from('line_items').select('description, quantity, unit, unit_price').eq('estimate_id', inv.estimate_id).order('item_order', { ascending: true }),
  ]);

  const state = proj.property_state || company?.default_state || 'FL';
  let tpl = (await supabase.from('contract_templates').select('content').eq('state', state).limit(1).maybeSingle()).data;
  if (!tpl?.content) tpl = (await supabase.from('contract_templates').select('content').eq('is_default', true).limit(1).maybeSingle()).data;
  if (!tpl?.content) throw new Error('No contract template available.');

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
    deposit_amount: money2(total / 2),
    balance_amount: money2(total / 2),
    terms_blocks: '',
  });

  const token = `agr_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const { data: agr, error } = await supabase
    .from('agreements')
    .insert({ user_id: userId, invoice_id: invoiceId, project_id: projectId, client_id: proj.client_id, state, contract_html: html, token, status: 'sent' })
    .select('id, token')
    .single();
  if (error) throw error;
  return { id: agr.id, token: agr.token };
}

/* ---------------- Jobs (project + its estimate/invoice → v2 Job) ---------------- */
export type RealJob = Job & { projectId: string };

function deriveStage(estStatus?: string, invStatus?: string): Stage {
  if (invStatus === 'Paid') return 'Paid';
  if (invStatus) return 'Invoiced';
  switch (estStatus) {
    case 'Approved':
    case 'In Progress':
      return 'Approved';
    case 'Completed':
      return 'Paid';
    case 'Sent':
      return 'Sent';
    case 'Draft':
      return 'Quoted';
    default:
      return estStatus ? 'Quoted' : 'Draft';
  }
}

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
    supabase.from('invoices').select('project_id, status, total').eq('user_id', userId),
  ]);
  if (proj.error) throw proj.error;

  const clients = new Map<string, string>((cli.data || []).map((c: any) => [c.id, c.full_name]));
  const estByProj = new Map<string, any>();
  (est.data || []).forEach((e: any) => {
    if (!estByProj.has(e.project_id)) estByProj.set(e.project_id, e); // first = newest (ordered desc)
  });
  const invByProj = new Map<string, any>();
  (inv.data || []).forEach((i: any) => invByProj.set(i.project_id, i));

  return (proj.data || []).map((p: any) => {
    const e = estByProj.get(p.id);
    const iv = invByProj.get(p.id);
    const value = Number(iv?.total ?? e?.total ?? e?.grand_total ?? 0) || 0;
    return {
      id: p.id,
      projectId: p.id,
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
    .select('company_name, company_address, company_phone, company_email, company_license, company_website, default_city, default_state')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function updateCompanyProfile(userId: string, p: { company_name?: string; company_license?: string; company_phone?: string; company_email?: string; company_address?: string }) {
  const { error } = await supabase.from('users').update(p).eq('id', userId);
  if (error) throw error;
}

/* ---------------- Job detail (real estimate + line items + invoice) ---------------- */
export type JobDetail = {
  estimate: { id: string; total: number; subtotal: number; taxRate: number; tax: number; marginRate: number; status: string; notes: string | null } | null;
  items: LineItem[];
  invoice: { id: string; number: string; status: string; subtotal: number; taxRate: number; tax: number; total: number; created: string } | null;
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
    .select('id, invoice_number, status, subtotal, tax_rate, tax_amount, total, created_at')
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
      ? { id: inv.id, number: inv.invoice_number, status: inv.status, subtotal: Number(inv.subtotal ?? 0), taxRate: Number(inv.tax_rate ?? 0), tax: Number(inv.tax_amount ?? 0), total: Number(inv.total ?? 0), created: inv.created_at }
      : null,
    client,
    photoUrls: Array.isArray(projRes.data?.photo_urls) ? (projRes.data!.photo_urls as string[]) : [],
    agreement: agr ? { id: agr.id, token: agr.token, status: agr.status, signedName: agr.signed_name, signedDate: agr.signed_date } : null,
  };
}
