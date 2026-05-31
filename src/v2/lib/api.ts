// PhotoQuote v2 — data access (Supabase). Maps real tables to the v2 UI shapes.
import { supabase } from './supabase';
import { Client, Job } from '../data';
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
