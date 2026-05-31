// PhotoQuote v2 — data access (Supabase). Grows phase by phase; Fase 0 wires Clients (read) as the real-data proof.
import { supabase } from './supabase';
import { Client } from '../data';

// clients table: id, user_id, full_name, phone, email, address, notes, created_at
export async function fetchClients(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, phone, email, address, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.full_name || 'Unnamed',
    phone: c.phone || '',
    email: c.email || '',
    addr: c.address || '',
    city: c.address || '',
    jobs: 0, // job counts wired in Fase 2 (projects)
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
