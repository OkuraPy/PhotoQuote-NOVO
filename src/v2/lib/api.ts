// PhotoQuote v2 — data access (Supabase). Maps real tables to the v2 UI shapes.
import { supabase } from './supabase';
import { Client, Job, LineItem } from '../data';
import { Stage } from '../theme';

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

  return { projectId: proj.id, estimateId: est.id };
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
    supabase.from('projects').select('id, name, client_id, address, city, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
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
      photos: 0,
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
  invoice: { id: string; number: string; status: string; subtotal: number; taxRate: number; tax: number; total: number } | null;
  client: { name: string; addr: string; city: string; email: string; phone: string } | null;
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
    .select('id, invoice_number, status, subtotal, tax_rate, tax_amount, total')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invRes.error) throw invRes.error;
  const inv = invRes.data;

  // real client for the invoice "Bill to"
  let client: JobDetail['client'] = null;
  const projRes = await supabase.from('projects').select('client_id').eq('id', projectId).maybeSingle();
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
      ? { id: inv.id, number: inv.invoice_number, status: inv.status, subtotal: Number(inv.subtotal ?? 0), taxRate: Number(inv.tax_rate ?? 0), tax: Number(inv.tax_amount ?? 0), total: Number(inv.total ?? 0) }
      : null,
    client,
  };
}
