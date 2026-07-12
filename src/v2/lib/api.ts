// PhotoQuote v2 — data access (Supabase). Maps real tables to the v2 UI shapes.
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { readErrorBody } from './ai';
import { Client, ClosedKind, closedFromStatus, deriveBase, deriveStage, DOC_PHOTO_CAP, Job, LineItem, MemberRole, paidTotal, parseDateOnly, PaymentMode, PaymentPlan, PaymentRecord, Photo, planFromInvoice, planRows, rescaleSchedule, round2, ScheduleRow, seedPhasePlan, statusFromPayments, syncPhasePlan, toDateOnly } from '../data';
export { deriveStage }; // re-exported for screens (lives in ../data so it's unit-testable)

/* ---------------- Location: real ZIP (Zippopotam, keyless) + GPS (expo-location) ---------------- */
// street is GPS-only (reverse geocode); the ZIP lookup can't know it. It pre-fills the
// "Job site address" field on the Attach step (G5) — the document address of the WORK, not the client.
export type Region = { city: string; state: string; zip: string; multiplier: number; label: string; street?: string };

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
    // keep the street too (used to be discarded): "123 Main St" — the job-site line of documents
    const street = [g.streetNumber, g.street].filter(Boolean).join(' ');
    return { city: g.city || g.subregion || '', state, zip: g.postalCode || '', multiplier: r.multiplier, label: r.label, street: street || undefined };
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
        // NO upsert: x-upsert demands a SELECT policy the office role doesn't have on the
        // owner's folder (the recurring B1 class — 3rd bite, caught by the Onda E reviewer).
        // The path contains a freshly created projectId, so overwrite semantics buy nothing.
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, decode(m.base64), { contentType: 'image/jpeg' });
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
    supabase.from('clients').select('id, full_name, phone, email, address, address_street, address_city, address_state, address_zip, notes, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
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
    notes: c.notes || '',
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
// Persists a freshly-generated estimate. The estimate's rates are set BEFORE the line items so
// the `update_estimate_totals` trigger (fires on line_item insert) computes subtotal/tax/total
// itself — keeping the DB the single source of truth for money.
// Embedded-markup scheme: unit_price arrives FINAL (markup already folded in by the app), so
// margin_rate/margin_percent are written as 0 (the trigger adds nothing) and the applied % is
// kept in markup_percent only as metadata to recover basePrice when editing.
export async function createJob(input: {
  userId: string;
  clientId: string | null; // null = client-less draft (client is optional)
  name: string;
  address?: string; // JOB-SITE street (G5) — the work address, no longer the client's home address
  city?: string;
  taxRate: number;
  marginRate: number;
  confidence?: number;
  notes?: string; // INTERNAL AI note (estimates.notes) — never printed on documents
  customerNote?: string; // client-facing note that prints on documents (G1, English)
  customerNoteSrc?: string; // original text when customerNote came from the AI translation
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
      margin_rate: 0,
      margin_percent: 0,
      markup_percent: input.marginRate,
      confidence: input.confidence ?? 0,
      ai_confidence_score: input.confidence ?? null,
      title,
      estimate_notes: input.notes || null,
      notes: input.notes || null,
      customer_note: input.customerNote || null,
      customer_note_src: input.customerNoteSrc || null,
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

  // photos are best-effort — the estimate is already safely saved, so a failed upload won't lose it.
  // The first 4 also seed doc_photo_urls (G2): photos print on the quote by default (owner's call).
  if (input.photos?.length) {
    const urls = await uploadProjectPhotos(input.userId, proj.id, input.photos);
    if (urls.length) await supabase.from('projects').update({ photo_urls: urls, doc_photo_urls: urls.slice(0, 4) }).eq('id', proj.id);
  }

  return { projectId: proj.id, estimateId: est.id };
}

/* ---------------- Update an existing estimate (Edit from the job screen) ---------------- */
// Rates first, then replace the line items — the totals trigger fires on the item writes and
// recomputes subtotal/tax/margin/total server-side (incl. the all-items-deleted case).
// Not transactional (PostgREST): if the insert fails after the delete the estimate is left
// empty on the server, but the app still holds the items in memory so Save can be retried.
// Afterwards the newest invoice is re-synced with the fresh totals when that's still safe
// (fixes the live-items × frozen-totals mismatch on the invoice tab).
export async function updateEstimateItems(
  estimateId: string,
  items: LineItem[],
  taxRate: number,
  marginRate: number,
  // G1: client-facing note saved along with the items; omitted = the columns are left untouched
  note?: { customerNote: string | null; customerNoteSrc: string | null }
): Promise<void> {
  // embedded markup: prices are final → margin zeroed for the trigger, % kept as metadata
  const { error: rErr } = await supabase
    .from('estimates')
    .update({
      tax_rate: taxRate,
      tax_percent: taxRate,
      margin_rate: 0,
      margin_percent: 0,
      markup_percent: marginRate,
      ...(note ? { customer_note: note.customerNote, customer_note_src: note.customerNoteSrc } : {}),
    })
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
  await syncInvoiceWithEstimate(estimateId);
}

// F12: the invoice tab shows the LIVE line items but the invoice's own frozen totals — editing
// the quote after invoicing desynced them. Re-copy the recomputed totals into the newest invoice
// while that's still safe: never a Paid invoice, never one with recorded payments (the client
// already acted on that document — the UI shows a "quote changed" banner instead). Best-effort
// by design: a failed sync degrades to that same banner, never breaks the estimate save.
async function syncInvoiceWithEstimate(estimateId: string): Promise<void> {
  try {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, status, total, deposit_percent')
      .eq('estimate_id', estimateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!inv || String(inv.status || '').toLowerCase() === 'paid') return;
    const { count } = await supabase.from('invoice_payments').select('id', { count: 'exact', head: true }).eq('invoice_id', inv.id);
    if (count) return;

    // the totals trigger already ran on the line_items writes — read the fresh numbers back
    const { data: est } = await supabase
      .from('estimates')
      .select('subtotal, tax_rate, tax_percent, tax_amount, total, grand_total')
      .eq('id', estimateId)
      .maybeSingle();
    if (!est) return;
    const newTotal = Number(est.total ?? est.grand_total ?? 0);
    const patch: Record<string, unknown> = {
      subtotal: Number(est.subtotal ?? 0),
      tax_rate: Number(est.tax_rate ?? est.tax_percent ?? 0),
      tax_amount: Number(est.tax_amount ?? 0),
      total: newTotal,
    };
    // a %-deposit follows the new total; an absolute-$ deposit (percent null) stays as agreed
    if (inv.deposit_percent != null) patch.deposit_amount = round2((newTotal * Number(inv.deposit_percent)) / 100);
    await supabase.from('invoices').update(patch).eq('id', inv.id);

    // rescale the installments proportionally so the schedule still sums to the new total
    const { data: sch } = await supabase
      .from('invoice_schedule')
      .select('id, label, amount, due_date, phase_id, sort')
      .eq('invoice_id', inv.id)
      .order('sort', { ascending: true });
    if (sch?.length) {
      const rows = rescaleSchedule(
        sch.map((r: any) => ({ id: r.id, label: r.label || '', amount: Number(r.amount) || 0, dueDate: r.due_date ?? null, phaseId: r.phase_id ?? null, sort: r.sort ?? 0 })),
        Number(inv.total) || 0,
        newTotal
      );
      await Promise.all(rows.map((r) => supabase.from('invoice_schedule').update({ amount: r.amount }).eq('id', r.id!)));
    }
  } catch {
    /* best-effort — the invoice tab's "quote changed" banner covers a stale invoice */
  }
}

/* ---------------- Invoice (generated from an approved estimate) ---------------- */
// The invoices columns that encode a PaymentPlan. deposit_percent is an INT CHECK 0-100 and is
// written ONLY when the deposit was entered as a % (an absolute-$ deposit keeps it null).
function invoicePlanColumns(plan: PaymentPlan) {
  const sorted = [...plan.installments].sort((a, b) => a.sort - b.sort);
  return {
    payment_mode: plan.mode,
    // full/deposit: the picked due date; installments: the invoice is fully due at the LAST one
    due_date: plan.mode === 'installments' ? sorted[sorted.length - 1]?.dueDate ?? null : plan.dueDate,
    deposit_percent:
      plan.mode === 'deposit' && plan.depositPercent != null
        ? Math.min(100, Math.max(0, Math.round(plan.depositPercent)))
        : null,
    deposit_amount: plan.mode === 'deposit' ? round2(plan.depositAmount) : null,
  };
}

// (Re)write the invoice's installment rows. PostgREST has no transactions (same caveat as
// updateEstimateItems): if the insert fails after the invoice was written, the mode is
// downgraded to 'full' so the invoice never claims a schedule it doesn't have.
// Returns true when the plan was DOWNGRADED to 'full' (the caller warns the contractor —
// a silently-degraded plan would surprise them on the client's invoice).
async function insertScheduleRows(userId: string, invoiceId: string, plan: PaymentPlan): Promise<boolean> {
  if (plan.mode !== 'installments' || !plan.installments.length) return false;
  const rows = [...plan.installments]
    .sort((a, b) => a.sort - b.sort)
    .map((r, i) => ({
      invoice_id: invoiceId,
      user_id: userId,
      label: r.label || `Payment ${i + 1}`, // English on purpose — feeds client-facing documents
      amount: round2(r.amount),
      due_date: r.dueDate,
      phase_id: r.phaseId ?? null,
      sort: i,
    }));
  const { error } = await supabase.from('invoice_schedule').insert(rows);
  if (error) {
    await supabase.from('invoices').update({ payment_mode: 'full' }).eq('id', invoiceId);
    return true;
  }
  return false;
}

// Copies the estimate's totals (the DB trigger keeps those correct), assigns a sequential
// per-user invoice number INV-YYYY-NNNN (no trigger exists, so we mint it here) and stores the
// payment plan the contractor picked in the sheet (mode/due/deposit + installment rows).
export async function createInvoice(userId: string, estimateId: string, projectId: string, plan: PaymentPlan): Promise<{ id: string; number: string; downgraded: boolean }> {
  const { data: est, error: eErr } = await supabase
    .from('estimates')
    .select('subtotal, tax_rate, tax_percent, tax_amount, margin_rate, margin_amount, total, grand_total')
    .eq('id', estimateId)
    .maybeSingle();
  if (eErr) throw eErr;

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
      ...invoicePlanColumns(plan),
    })
    .select('id, invoice_number')
    .single();
  if (error) throw error;
  const downgraded = await insertScheduleRows(userId, inv.id, plan);
  return { id: inv.id, number: inv.invoice_number, downgraded };
}

// Re-edit the payment plan of an existing invoice: plan columns + delete/reinsert the schedule.
// Recorded payments are NEVER touched — the ledger is history, the plan is the agreement.
export async function updateInvoicePlan(userId: string, invoiceId: string, plan: PaymentPlan): Promise<{ downgraded: boolean }> {
  const { error } = await supabase.from('invoices').update(invoicePlanColumns(plan)).eq('id', invoiceId);
  if (error) throw error;
  const { error: dErr } = await supabase.from('invoice_schedule').delete().eq('invoice_id', invoiceId);
  if (dErr) throw dErr;
  return { downgraded: await insertScheduleRows(userId, invoiceId, plan) };
}

// Append a payment to the ledger, then refresh the invoice status from Σ(ledger) vs total.
// A legacy invoice already marked Paid WITHOUT ledger rows is never downgraded by a late entry.
// Returns the new ledger row's id — the "send a receipt?" follow-up (G3) needs it.
export async function recordInvoicePayment(
  userId: string,
  invoiceId: string,
  p: { amount: number; paidAt?: string; method?: string | null; scheduleId?: string | null }
): Promise<{ id: string }> {
  const amount = round2(p.amount);
  if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
  const [{ data: inv, error: iErr }, { count }] = await Promise.all([
    supabase.from('invoices').select('status, total').eq('id', invoiceId).maybeSingle(),
    supabase.from('invoice_payments').select('id', { count: 'exact', head: true }).eq('invoice_id', invoiceId),
  ]);
  if (iErr) throw iErr;
  if (!inv) throw new Error('Invoice not found.');
  const legacyPaid = String(inv.status || '').toLowerCase() === 'paid' && !count;

  const { data: ins, error } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      amount,
      paid_at: p.paidAt || toDateOnly(new Date()),
      method: p.method || null,
      schedule_id: p.scheduleId || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (legacyPaid) return { id: ins.id }; // fully paid before the ledger existed — keep the status

  const { data: pays, error: pErr } = await supabase.from('invoice_payments').select('amount').eq('invoice_id', invoiceId);
  if (pErr) throw pErr;
  const status = statusFromPayments(Number(inv.total) || 0, paidTotal(pays || []));
  const { error: uErr } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);
  if (uErr) throw uErr;
  return { id: ins.id };
}

// Mint-once receipt number (G3). Written exactly once per payment; re-issuing reuses it.
// Race-safe: the guarded update only lands on a NULL cell, so the loser of a concurrent mint
// re-reads the winner's number (its own RPC draw burns a harmless counter slot); the partial
// unique index on (user_id, receipt_number) is the hard backstop.
export async function ensureReceiptNumber(paymentId: string): Promise<string> {
  const { data: row, error } = await supabase.from('invoice_payments').select('receipt_number').eq('id', paymentId).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Payment not found.');
  if (row.receipt_number) return String(row.receipt_number);

  const { data: numData, error: nErr } = await supabase.rpc('next_receipt_number');
  if (nErr) throw nErr;
  const number = String(numData);

  const { data: upd, error: uErr } = await supabase
    .from('invoice_payments')
    .update({ receipt_number: number })
    .eq('id', paymentId)
    .is('receipt_number', null)
    .select('id');
  if (uErr) throw uErr;
  if (upd?.length) return number;

  const { data: again, error: aErr } = await supabase.from('invoice_payments').select('receipt_number').eq('id', paymentId).maybeSingle();
  if (aErr) throw aErr;
  if (again?.receipt_number) return String(again.receipt_number);
  return number; // row vanished mid-race — the freshly minted number is still valid
}

// Persist a status change to the DB (replaces the old in-memory-only stage override).
export async function updateEstimateStatus(estimateId: string, status: string) {
  // 'Sent' only stamps a quote the client hasn't approved yet — re-sending a copy must never
  // regress Approved/In Progress/Completed back to Sent (mirror of the invoice guard below)
  let q = supabase.from('estimates').update({ status }).eq('id', estimateId);
  if (status === 'Sent') q = q.not('status', 'in', '("Approved","In Progress","Completed")');
  const { error } = await q;
  if (error) throw error;
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  // 'Sent' only stamps a still-Unpaid invoice — resending must never clobber a ledger-derived
  // 'Partially Paid'/'Paid' (the filtered update simply matches 0 rows then).
  let q = supabase.from('invoices').update({ status }).eq('id', invoiceId);
  if (status === 'Sent') q = q.eq('status', 'Unpaid');
  const { error } = await q;
  if (error) throw error;
}

// Persist the document-photo selection (G2). Server-side re-validation: only urls that are
// really project photos survive, in photo-strip order, capped — a stale/raced client selection
// can never write junk. Returns what was actually stored.
export async function updateDocPhotos(projectId: string, urls: string[]): Promise<string[]> {
  const { data: proj, error: pErr } = await supabase.from('projects').select('photo_urls').eq('id', projectId).maybeSingle();
  if (pErr) throw pErr;
  const all: string[] = Array.isArray(proj?.photo_urls) ? (proj!.photo_urls as string[]) : [];
  const clean = all.filter((u) => urls.includes(u)).slice(0, DOC_PHOTO_CAP);
  const { error } = await supabase.from('projects').update({ doc_photo_urls: clean }).eq('id', projectId);
  if (error) throw error;
  return clean;
}

// Update the job-site address columns (G5). Only the keys present in `site` are written, so a
// partial edit never nulls the other columns. No UI calls this yet — kept for the edit screen.
export async function updateJobSite(projectId: string, site: { address?: string | null; city?: string | null; zip?: string | null; state?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if ('address' in site) patch.address = site.address || null;
  if ('city' in site) patch.city = site.city || null;
  if ('zip' in site) patch.zip = site.zip || null;
  if ('state' in site) patch.property_state = site.state || null;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) throw error;
}

// Close/reopen a job: 'Lost'/'Archived' take it out of the pipeline, 'Active' brings it back.
// Lives in projects.status — an axis ORTHOGONAL to the estimate/invoice-derived Stage, so the
// underlying quote/invoice statuses are untouched and reopening restores the exact stage.
export async function updateProjectStatus(projectId: string, status: 'Lost' | 'Archived' | 'Active'): Promise<void> {
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) throw error;
}

/* ---------------- Team (Onda B): owner + field members ---------------- */
// Opção B: the OWNER stays the data key. Members get a team_members row; project_members says
// which jobs each member sees. The READ queries in this file never change — the RLS branches
// added bank-side make fetchJobs(ownerId)/fetchPhases(...) return only what the caller may see.
export type TeamMember = {
  id: string;
  userId: string | null; // member_user_id (the member's auth uid)
  email: string;
  name: string;
  role: MemberRole;
  canSeeFinancials: boolean;
  createdAt: string;
};

export async function fetchTeam(ownerId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, member_user_id, member_email, full_name, role, can_see_financials, status, created_at')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.id,
    userId: m.member_user_id || null,
    email: m.member_email || '',
    name: m.full_name || m.member_email || 'Member',
    role: m.role === 'office' ? 'office' : 'field',
    canSeeFinancials: !!m.can_see_financials,
    createdAt: m.created_at,
  }));
}

// The owner creates the employee's account DIRECTLY (email + password — no invite flow, owner's
// call). The Edge Function holds the service role: it creates the auth user + team_members row.
// Known error codes come back as err.code so the screen can show its own localized message.
export async function createTeamMember(input: { name: string; email: string; password: string; role: MemberRole; canSeeFinancials?: boolean }): Promise<{ memberId: string }> {
  const { data, error } = await supabase.functions.invoke('create-team-member', {
    body: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      canSeeFinancials: !!input.canSeeFinancials,
    },
  });
  const fail = (raw: string | null | undefined): never => {
    // promote every known edge-function error to a code the UI maps to friendly copy
    const known = ['email_in_use', 'member_exists', 'member_limit_reached', 'weak_password', 'plan_upgrade_required'];
    const code = known.includes(String(raw)) ? String(raw) : null;
    const err: any = new Error(String(raw || 'Could not create the team member.'));
    err.code = code;
    throw err;
  };
  if (error) fail(await readErrorBody(error) || error.message);
  if (data?.error) fail(String(data.error));
  if (!data?.ok || !data?.memberId) fail(null);
  return { memberId: String(data.memberId) };
}

export async function updateTeamMember(id: string, patch: { role?: MemberRole; canSeeFinancials?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.canSeeFinancials !== undefined) row.can_see_financials = patch.canSeeFinancials;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from('team_members').update(row).eq('id', id);
  if (error) throw error;
}

// Soft removal on purpose: status='removed' keeps the row (photos/comments history stays
// attributable) while the RLS stops honoring the membership. NEVER a hard delete.
export async function removeTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').update({ status: 'removed' }).eq('id', id);
  if (error) throw error;
}

/* ----- project assignments: which members see this job ----- */
export async function fetchProjectAssignments(projectId: string): Promise<{ memberId: string }[]> {
  const { data, error } = await supabase.from('project_members').select('member_id').eq('project_id', projectId);
  if (error) throw error;
  return (data || []).map((r: any) => ({ memberId: r.member_id }));
}

export async function assignMember(projectId: string, memberId: string, assignedBy: string): Promise<void> {
  const { error } = await supabase.from('project_members').insert({ project_id: projectId, member_id: memberId, assigned_by: assignedBy });
  // a duplicate assignment (unique project+member) means the toggle already holds — not an error
  if (error && (error as any).code !== '23505') throw error;
}

export async function unassignMember(projectId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('member_id', memberId);
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

// "3. PAYMENT TERMS" table for the contract — same trusted-template/escaped-data rules as
// lineItemsTableHtml. Always English (client-facing); a null due date = "Upon completion".
function paymentScheduleTableHtml(rows: { label: string; amount: number; dueDate: string | null }[]): string {
  const due = (d: string | null) => (d ? parseDateOnly(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Upon completion');
  const body = (rows || [])
    .map(
      (r) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE">${escC(r.label)}</td><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE;text-align:right;white-space:nowrap">${escC(due(r.dueDate))}</td><td style="padding:6px 8px;border-bottom:1px solid #E6E9EE;text-align:right;white-space:nowrap">$${money2(r.amount)}</td></tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #11705A">Payment</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #11705A">Due</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #11705A">Amount</th></tr></thead><tbody>${body}</tbody></table>`;
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
    supabase.from('invoices').select('invoice_number, estimate_id, subtotal, tax_rate, tax_amount, total, deposit_percent, payment_mode, due_date, deposit_amount').eq('id', invoiceId).maybeSingle(),
    supabase.from('users').select('company_name, company_address, company_phone, company_email, company_license, default_state').eq('id', userId).maybeSingle(),
  ]);
  if (!proj) throw new Error('Project not found.');
  if (!proj.client_id) throw new Error('Add a client to this job before creating a contract.');
  if (!inv) throw new Error('Generate the invoice first.');

  const [{ data: client }, { data: items }, { data: schedule }, { data: estNote }] = await Promise.all([
    supabase.from('clients').select('full_name, address, address_city, address_state, phone, email').eq('id', proj.client_id).maybeSingle(),
    supabase.from('line_items').select('description, quantity, unit, unit_price').eq('estimate_id', inv.estimate_id).order('item_order', { ascending: true }),
    supabase.from('invoice_schedule').select('id, label, amount, due_date, sort').eq('invoice_id', invoiceId).order('sort', { ascending: true }),
    // client-facing note (G1) — customer_note ONLY: estimates.notes is internal, never printed
    supabase.from('estimates').select('customer_note').eq('id', inv.estimate_id).maybeSingle(),
  ]);

  const state = proj.property_state || company?.default_state || 'US';
  // one generic US template (is_default) covers all 50 states — the owner operates nationwide
  const tpl = (await supabase.from('contract_templates').select('content, terms_blocks').eq('is_default', true).limit(1).maybeSingle()).data;
  if (!tpl?.content) throw new Error('No contract template available.');

  const total = Number(inv.total) || 0;
  // the invoice's stored plan → English document rows (v2 template's {{payment_schedule_table}});
  // invoice & contract always match because both read the same snapshot
  const rows = planRows(
    planFromInvoice({
      paymentMode: asPaymentMode(inv.payment_mode),
      dueDate: inv.due_date ?? null,
      depositPercent: inv.deposit_percent ?? null,
      depositAmount: inv.deposit_amount != null ? Number(inv.deposit_amount) : null,
      total,
      schedule: (schedule || []).map((r: any, i: number) => ({ id: r.id, label: r.label || `Payment ${i + 1}`, amount: Number(r.amount) || 0, dueDate: r.due_date ?? null, sort: r.sort ?? i })),
    }),
    total
  );
  // legacy-template compat ({{deposit_percent}}/{{deposit_amount}}/{{balance_amount}}): the first
  // row plays the "deposit" part when the plan has an up-front payment; a full plan yields 0/total.
  const firstAmt = rows.length > 1 ? rows[0].amount : 0;
  const depositPct = inv.deposit_percent != null ? Number(inv.deposit_percent) : total > 0 ? Math.round((firstAmt / total) * 100) : 0;
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
    payment_schedule_table: paymentScheduleTableHtml(rows),
    deposit_percent: String(depositPct),
    deposit_amount: money2(firstAmt),
    balance_amount: money2(round2(total - firstAmt)),
    // G1: the client-facing note as its own NOTES section (or nothing at all) — templates gained
    // the placeholder via migration; fillTemplate blanks it on templates that never did
    customer_notes_block: (estNote?.customer_note || '').trim()
      ? `<h3>NOTES</h3><p style="white-space:pre-wrap">${escC(String(estNote!.customer_note).trim())}</p>`
      : '',
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
    supabase.from('projects').select('id, name, client_id, address, city, created_at, photo_urls, status').eq('user_id', userId).order('created_at', { ascending: false }),
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
      thumb: Array.isArray(p.photo_urls) && p.photo_urls[0] ? String(p.photo_urls[0]) : null,
      date: monthDay(p.created_at),
      closed: closedFromStatus(p.status),
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
  if (data) return data;
  // Team member: RLS hides the owner's users row (it carries rates/margins/plan). The
  // get_owner_branding() definer returns ONLY the branding fields — enough for everything
  // a member's UI renders; the sensitive defaults stay owner-only… except for OFFICE
  // (Onda E): get_owner_defaults() adds tax/margin/deposit/city so office quotes inherit
  // the owner's numbers (returns 0 rows for field — the merge is a no-op there).
  const [{ data: branding }, { data: defaults }] = await Promise.all([
    supabase.rpc('get_owner_branding'),
    supabase.rpc('get_owner_defaults'),
  ]);
  const b = Array.isArray(branding) ? branding[0] : branding;
  const d = Array.isArray(defaults) ? defaults[0] : defaults;
  if (!b || b.id !== userId) return null;
  return d && d.id === userId ? { ...b, ...d } : b;
}

export async function updateCompanyProfile(userId: string, p: { company_name?: string; company_license?: string; company_phone?: string; company_email?: string; company_address?: string; default_deposit_percent?: number | null; default_tax_percent?: number | null; default_margin_percent?: number | null; logo_url?: string | null }) {
  const { error } = await supabase.from('users').update(p).eq('id', userId);
  if (error) throw error;
}

/* ---------------- Billing / account (Onda D) ---------------- */
export type OwnBilling = { status: string | null; expiresAt: string | null; planName: string | null };

// The signed-in user's OWN subscription fields (own-row RLS). Only the OWNER's UI uses this
// (members never see billing); failures degrade to nulls = 'ok' state, never a lockout.
export async function fetchOwnBilling(userId: string): Promise<OwnBilling> {
  const { data } = await supabase
    .from('users')
    .select('subscription_status, subscription_expires_at, subscription_plan_id')
    .eq('id', userId)
    .maybeSingle();
  let planName: string | null = null;
  if (data?.subscription_plan_id) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('name')
      .eq('id', data.subscription_plan_id)
      .maybeSingle();
    planName = plan?.name ?? null;
  }
  return {
    status: data?.subscription_status ?? null,
    expiresAt: data?.subscription_expires_at ?? null,
    planName,
  };
}

// Active plans for the paywall (public catalog; RLS USING(true) on subscription_plans).
export type PlanRow = { id: string; name: string; priceMonthly: number; priceYearly: number; features: Record<string, unknown> };
export async function fetchPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, price_monthly, price_yearly, features')
    .eq('is_active', true)
    .order('price_monthly');
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    priceMonthly: Number(p.price_monthly) || 0,
    priceYearly: Number(p.price_yearly) || 0,
    features: p.features || {},
  }));
}

// Permanent account deletion (App Store 5.1.1(v)). The edge function wipes memberships,
// storage folders and the auth user — the DB cascade takes the whole business graph.
// Caller must signOut() right after a successful return.
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'delete_failed');
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
  // markupPercent = new scheme (% already embedded in unit prices); legacyMarginRate = old scheme
  // (margin summed on top by the trigger) — kept so Edit can fold it into the prices.
  // notes = INTERNAL AI note (contractor language, never printed); customerNote = client-facing
  // note that prints on documents (G1); customerNoteSrc = the pre-translation original.
  estimate: { id: string; total: number; subtotal: number; taxRate: number; tax: number; markupPercent: number; legacyMarginRate: number; status: string; notes: string | null; customerNote: string | null; customerNoteSrc: string | null } | null;
  items: LineItem[];
  // F12: paymentMode/dueDate/deposit* + schedule re-hydrate the plan; payments is the ledger and
  // amountPaid its Σ (a legacy 'Paid' invoice without ledger rows counts as fully paid).
  invoice: {
    id: string;
    number: string;
    status: string;
    subtotal: number;
    taxRate: number;
    tax: number;
    total: number;
    created: string;
    paymentMode: PaymentMode;
    dueDate: string | null;
    depositPercent: number | null;
    depositAmount: number | null;
    schedule: ScheduleRow[];
    payments: PaymentRecord[];
    amountPaid: number;
  } | null;
  client: { name: string; addr: string; city: string; email: string; phone: string } | null;
  // job-site address (projects.address/city/zip/property_state) — the WORK address (G5).
  // Legacy rows may still hold the client's address there (old createJob wrote client.addr).
  jobSite: { address: string; city: string; zip: string; state: string };
  photoUrls: string[];
  docPhotoUrls: string[]; // curated subset of photoUrls that prints on the quote (G2, max 6)
  agreement: { id: string; token: string; status: string; signedName: string | null; signedDate: string | null } | null;
  closed: ClosedKind | null; // lost/archived (projects.status) — orthogonal to the derived stage
};

// invoices.payment_mode → PaymentMode with a safe fallback for anything unexpected
const asPaymentMode = (m: unknown): PaymentMode => (m === 'deposit' || m === 'installments' ? m : 'full');

export async function fetchJobDetail(projectId: string): Promise<JobDetail> {
  const estRes = await supabase
    .from('estimates')
    .select('id, total, grand_total, subtotal, tax_rate, tax_amount, margin_rate, markup_percent, status, notes, estimate_notes, customer_note, customer_note_src')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (estRes.error) throw estRes.error;
  const est = estRes.data;

  let items: LineItem[] = [];
  const markupPct = Number(est?.markup_percent ?? 0);
  if (est?.id) {
    const liRes = await supabase
      .from('line_items')
      .select('category, description, quantity, unit_price, unit, taxable, item_order')
      .eq('estimate_id', est.id)
      .order('item_order', { ascending: true });
    if (liRes.error) throw liRes.error;
    items = (liRes.data || []).map((it: any, i: number) => {
      const price = Number(it.unit_price) || 0;
      return {
        id: i,
        cat: it.category || 'Item',
        desc: it.description || '',
        qty: Number(it.quantity) || 0,
        unit: it.unit || 'job',
        price,
        // new scheme: unit_price carries the markup — recover the pre-markup base for editing
        ...(markupPct > 0 ? { basePrice: deriveBase(price, markupPct) } : {}),
        taxable: it.taxable !== false,
      };
    });
  }

  const invRes = await supabase
    .from('invoices')
    .select('id, invoice_number, status, subtotal, tax_rate, tax_amount, total, created_at, deposit_percent, payment_mode, due_date, deposit_amount')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invRes.error) throw invRes.error;
  const inv = invRes.data;

  // the invoice's agreed plan (installments) + received-payments ledger, in parallel
  let schedule: ScheduleRow[] = [];
  let payments: PaymentRecord[] = [];
  if (inv?.id) {
    const [schRes, payRes] = await Promise.all([
      supabase.from('invoice_schedule').select('id, label, amount, due_date, phase_id, sort').eq('invoice_id', inv.id).order('sort', { ascending: true }),
      // created_at tiebreaker: paid_at is date-only, and same-day payments must keep a stable
      // order so a re-issued receipt always shows the same running balance
      supabase.from('invoice_payments').select('id, amount, paid_at, method, schedule_id').eq('invoice_id', inv.id).order('paid_at', { ascending: true }).order('created_at', { ascending: true }),
    ]);
    if (schRes.error) throw schRes.error;
    if (payRes.error) throw payRes.error;
    schedule = (schRes.data || []).map((r: any) => ({ id: r.id, label: r.label || '', amount: Number(r.amount) || 0, dueDate: r.due_date ?? null, phaseId: r.phase_id ?? null, sort: r.sort ?? 0 }));
    payments = (payRes.data || []).map((r: any) => ({ id: r.id, amount: Number(r.amount) || 0, paidAt: r.paid_at, method: r.method ?? null, scheduleId: r.schedule_id ?? null }));
  }

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
  const projRes = await supabase.from('projects').select('client_id, photo_urls, doc_photo_urls, status, address, city, zip, property_state').eq('id', projectId).maybeSingle();
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
      ? { id: est.id, total: Number(est.total ?? est.grand_total ?? 0), subtotal: Number(est.subtotal ?? 0), taxRate: Number(est.tax_rate ?? 0), tax: Number(est.tax_amount ?? 0), markupPercent: markupPct, legacyMarginRate: Number(est.margin_rate ?? 0), status: est.status, notes: est.notes ?? est.estimate_notes ?? null, customerNote: est.customer_note ?? null, customerNoteSrc: est.customer_note_src ?? null }
      : null,
    items,
    invoice: inv
      ? {
          id: inv.id,
          number: inv.invoice_number,
          status: inv.status,
          subtotal: Number(inv.subtotal ?? 0),
          taxRate: Number(inv.tax_rate ?? 0),
          tax: Number(inv.tax_amount ?? 0),
          total: Number(inv.total ?? 0),
          created: inv.created_at,
          paymentMode: asPaymentMode(inv.payment_mode),
          dueDate: inv.due_date ?? null,
          depositPercent: inv.deposit_percent ?? null,
          depositAmount: inv.deposit_amount != null ? Number(inv.deposit_amount) : null,
          schedule,
          payments,
          // legacy rule: an invoice marked Paid before the ledger existed counts as fully paid
          amountPaid: payments.length ? paidTotal(payments) : String(inv.status).toLowerCase() === 'paid' ? Number(inv.total ?? 0) : 0,
        }
      : null,
    client,
    jobSite: {
      address: projRes.data?.address || '',
      city: projRes.data?.city || '',
      zip: projRes.data?.zip || '',
      state: projRes.data?.property_state || '',
    },
    photoUrls: Array.isArray(projRes.data?.photo_urls) ? (projRes.data!.photo_urls as string[]) : [],
    docPhotoUrls: Array.isArray(projRes.data?.doc_photo_urls) ? (projRes.data!.doc_photo_urls as string[]) : [],
    agreement: agr ? { id: agr.id, token: agr.token, status: agr.status, signedName: agr.signed_name, signedDate: agr.signed_date } : null,
    closed: closedFromStatus(projRes.data?.status),
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
  autoSeeded: boolean; // created from a quote line item (G4) — sync may remove it while untouched
  photos: PhasePhoto[];
  comments: PhaseComment[];
};

export async function fetchPhases(projectId: string): Promise<ProgressPhase[]> {
  const { data: phases, error } = await supabase
    .from('project_phases')
    .select('id, name, status, phase_order, notes, is_visible_to_client, auto_seeded')
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
    autoSeeded: !!p.auto_seeded,
    photos: byPhase.get(p.id) || [],
    comments: commentsByPhase.get(p.id) || [],
  }));
}

export async function countProjectPhases(projectId: string): Promise<number> {
  const { count } = await supabase.from('project_phases').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  return count || 0;
}

// Seed the progress tab from the quote (G4): one phase per line item, in item order, named after
// the item's description (deduped by seedPhasePlan). Only meant for an EMPTY progress tab — the
// count guard makes a double tap (or the post-invoice prompt racing the button) a no-op instead
// of a duplicate set. Returns how many phases were created.
export async function seedPhasesFromEstimate(userId: string, projectId: string, estimateId: string): Promise<number> {
  const existing = await countProjectPhases(projectId);
  if (existing > 0) return 0;
  const { data: items, error } = await supabase.from('line_items').select('description').eq('estimate_id', estimateId).order('item_order', { ascending: true });
  if (error) throw error;
  const plan = seedPhasePlan((items || []).map((it: any) => ({ desc: it.description || '' })));
  if (!plan.length) return 0;
  const rows = plan.map((p) => ({
    project_id: projectId,
    estimate_id: estimateId,
    user_id: userId,
    name: p.name,
    phase_order: p.order,
    status: 'not_started',
    is_visible_to_client: true,
    auto_seeded: true,
  }));
  const { error: insErr } = await supabase.from('project_phases').insert(rows);
  if (insErr) throw insErr;
  return rows.length;
}

// Re-align the seeded phases with the CURRENT quote items after an edit (G4). All the decision
// logic lives in syncPhasePlan (pure, unit-tested): it only ever deletes an auto-seeded phase
// that is still not_started with no photos/comments, and creates phases for items that have no
// homonymous phase. New phases append after the current max order.
export async function syncPhasesWithEstimate(userId: string, projectId: string, estimateId: string): Promise<{ removed: number; created: number }> {
  const [phRes, liRes] = await Promise.all([
    supabase.from('project_phases').select('id, name, status, phase_order, auto_seeded').eq('project_id', projectId),
    supabase.from('line_items').select('description').eq('estimate_id', estimateId).order('item_order', { ascending: true }),
  ]);
  if (phRes.error) throw phRes.error;
  if (liRes.error) throw liRes.error;
  const phases = phRes.data || [];

  // a phase "has content" when any photo or comment hangs off it — those are never removed
  const ids = phases.map((p: any) => p.id);
  const withContent = new Set<string>();
  if (ids.length) {
    const [photos, comments] = await Promise.all([
      supabase.from('phase_photos').select('phase_id').in('phase_id', ids),
      supabase.from('phase_comments').select('phase_id').in('phase_id', ids),
    ]);
    (photos.data || []).forEach((r: any) => withContent.add(r.phase_id));
    (comments.data || []).forEach((r: any) => withContent.add(r.phase_id));
  }

  const nextOrder = phases.length ? Math.max(...phases.map((p: any) => Number(p.phase_order) || 0)) + 1 : 0;
  const plan = syncPhasePlan(
    phases.map((p: any) => ({ id: p.id, name: p.name || '', autoSeeded: !!p.auto_seeded, status: p.status || 'not_started', hasContent: withContent.has(p.id) })),
    (liRes.data || []).map((it: any) => ({ desc: it.description || '' })),
    nextOrder
  );

  if (plan.removeIds.length) {
    // photos/comments cascade on delete, but removable phases have none by definition
    const { error } = await supabase.from('project_phases').delete().in('id', plan.removeIds);
    if (error) throw error;
  }
  if (plan.create.length) {
    const rows = plan.create.map((p) => ({
      project_id: projectId,
      estimate_id: estimateId,
      user_id: userId,
      name: p.name,
      phase_order: p.order,
      status: 'not_started',
      is_visible_to_client: true,
      auto_seeded: true,
    }));
    const { error } = await supabase.from('project_phases').insert(rows);
    if (error) throw error;
  }
  return { removed: plan.removeIds.length, created: plan.create.length };
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
      // NO upsert: the name is a fresh UUID (upsert is pointless) and upsert needs a SELECT
      // policy on the object — a team member uploads into the OWNER's folder and has none
      // (same 403-in-400 class as the 07/08 B1 bug). Plain INSERT is all this path needs.
      const { error: upErr } = await supabase.storage.from(PHASE_BUCKET).upload(path, decode(m.base64), { contentType: 'image/jpeg' });
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
