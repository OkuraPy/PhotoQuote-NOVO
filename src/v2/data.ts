// PhotoQuote v2 — mock data + money helpers (mirrors the handoff app/data.jsx).
// First pass uses this so the app is runnable; later wired to Supabase + Edge Functions.
import type { Stage } from './theme';

export const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
// split dollars / cents for the hero display: "$4,238" + ".80"
export const split = (n: number): [string, string] => {
  const s = fmt(n);
  const i = s.lastIndexOf('.');
  return [s.slice(0, i), s.slice(i)];
};

export type LineItem = {
  id: number;
  cat: string;
  desc: string;
  qty: number;
  unit: string;
  price: number; // final unit price (markup already embedded when marginRate > 0)
  basePrice?: number; // pre-markup unit price; absent = price IS the base
  taxable: boolean;
};

export const round2 = (x: number) => Math.round(x * 100) / 100;

// Embedded markup: fold `pct`% into each unit price (same idea as the regional multiplier).
// Always recomputes from basePrice, so re-applying with a different pct never compounds.
export function applyMarkup(items: LineItem[], pct: number): LineItem[] {
  return items.map((it) => {
    const base = it.basePrice ?? it.price;
    return { ...it, basePrice: base, price: round2(base * (1 + pct / 100)) };
  });
}

// Inverse of applyMarkup for a single price: recover the pre-markup base from a FINAL price.
// Used when a manual edit types the final price and when re-hydrating stored items
// (unit_price is final; estimates.markup_percent says what was embedded).
export const deriveBase = (price: number, pct: number) => round2(price / (1 + pct / 100));

// A captured/picked photo waiting to be analyzed (local file uri from the camera or library).
export type Photo = { uri: string };

/* ---------------- Document photos (G2): curated subset of the job photos ---------------- */
export const DOC_PHOTO_CAP = 6;
// Toggle one photo in the document selection. The result keeps the PHOTO-STRIP order (selection
// is re-ordered by `all`), silently drops selections whose photo no longer exists, and refuses
// to grow past the cap or select an unknown url — returning null so the caller treats the tap
// as a no-op instead of writing a bad selection.
export function toggleDocPhoto(selected: string[], all: string[], url: string, cap = DOC_PHOTO_CAP): string[] | null {
  const sel = new Set(selected.filter((u) => all.includes(u)));
  if (sel.has(url)) {
    sel.delete(url);
  } else {
    if (!all.includes(url) || sel.size >= cap) return null;
    sel.add(url);
  }
  return all.filter((u) => sel.has(u));
}

// One-line job-site address for documents (G5) — same field order the contract template's
// {{service_address}} uses ([address, city, zip]), so every document says the same thing.
export function jobSiteLine(site?: { address?: string | null; city?: string | null; zip?: string | null } | null): string {
  if (!site) return '';
  return [site.address, site.city, site.zip]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

// §9 official formula — mirrors the planned calc-totals Edge Function
export function calcTotals(items: LineItem[], taxRate: number, marginRate = 0) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const taxableSubtotal = items.filter((i) => i.taxable).reduce((s, i) => s + i.qty * i.price, 0);
  const tax = taxableSubtotal * (taxRate / 100);
  const margin = (subtotal + tax) * (marginRate / 100);
  const total = subtotal + tax + margin;
  return { subtotal, taxableSubtotal, tax, margin, total };
}

export const STAGES: Stage[] = ['Draft', 'Quoted', 'Sent', 'Approved', 'Invoiced', 'Paid'];

// Derive the v2 pipeline stage from the raw estimate/invoice statuses (case-insensitive).
// Any unpaid/sent/overdue invoice = "Invoiced"; only a paid invoice = "Paid".
export function deriveStage(estStatus?: string, invStatus?: string): Stage {
  const inv = (invStatus || '').toLowerCase();
  if (inv === 'paid') return 'Paid';
  if (invStatus) return 'Invoiced';
  switch ((estStatus || '').toLowerCase()) {
    case 'approved':
    case 'in progress':
    case 'completed': // work done but never invoiced → still pipeline, NOT money received
      return 'Approved';
    case 'sent':
      return 'Sent';
    default:
      return estStatus ? 'Quoted' : 'Draft';
  }
}

/* ---------------- Closed jobs (lost / archived) — an axis ORTHOGONAL to Stage ---------------- */
// "Closed" lives in projects.status ('Lost' | 'Archived'; reopening writes 'Active'), NEVER in the
// estimate/invoice-derived Stage above. v1 wrote free-form statuses there ('Draft', 'In Progress',
// …) — anything unrecognized reads as open (null), so legacy rows keep behaving as before.
export type ClosedKind = 'lost' | 'archived';
export function closedFromStatus(s?: string | null): ClosedKind | null {
  const v = (s || '').toLowerCase();
  if (v === 'lost') return 'lost';
  if (v === 'archived') return 'archived';
  return null;
}

// Home dashboard numbers. Closed jobs leave the pipeline: they count in NOTHING except
// `collected`, which keeps Paid money from archived jobs (real revenue) but drops lost ones.
// With no closed jobs this reproduces the original HomeScreen inline math bit for bit.
export function homeMetrics(jobs: { stage: Stage; value: number; closed?: ClosedKind | null }[]) {
  const open = jobs.filter((j) => !j.closed);
  return {
    pipeline: open.filter((j) => ['Draft', 'Quoted', 'Sent', 'Approved'].includes(j.stage)).reduce((s, j) => s + j.value, 0),
    invoiced: open.filter((j) => j.stage === 'Invoiced').reduce((s, j) => s + j.value, 0),
    collected: jobs.filter((j) => j.closed !== 'lost' && j.stage === 'Paid').reduce((s, j) => s + j.value, 0),
    active: open.filter((j) => j.stage !== 'Paid').length,
    openQuotes: open.filter((j) => ['Quoted', 'Sent'].includes(j.stage)).length,
  };
}

/* ---------------- Flexible payment (F12): plan, schedule & ledger helpers (pure) ---------------- */
export type PaymentMode = 'full' | 'deposit' | 'installments';
// One agreed payment of the plan (invoice_schedule row). dueDate is date-only 'YYYY-MM-DD';
// null = due upon completion. label is stored in ENGLISH (documents; the UI translates its own).
export type ScheduleRow = { id?: string; label: string; amount: number; dueDate: string | null; phaseId?: string | null; sort: number };
// One received payment (invoice_payments ledger row).
export type PaymentRecord = { id: string; amount: number; paidAt: string; method: string | null; scheduleId: string | null };
// What the contractor picked in the payment-plan sheet (and what a stored invoice re-hydrates into).
export type PaymentPlan = {
  mode: PaymentMode;
  dueDate: string | null; // full: the single due date · deposit: when the deposit is due
  depositPercent: number | null; // deposit entered as a % (null when entered as an absolute $)
  depositAmount: number; // deposit resolved to $ (0 = no deposit)
  installments: ScheduleRow[];
};

// Date-only helpers. NEVER new Date('YYYY-MM-DD'): that parses as UTC midnight and renders the
// PREVIOUS day in negative-offset timezones (all of the US) — build from parts instead.
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
export function toDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// today (or `from`) + N days as 'YYYY-MM-DD' — the Date constructor normalizes month/year overflow
export function addDaysISO(days: number, from?: string): string {
  const b = from ? parseDateOnly(from) : new Date();
  return toDateOnly(new Date(b.getFullYear(), b.getMonth(), b.getDate() + days));
}

// Whole days from `today` to a stored date-only due date (re-editing an existing plan).
// NEGATIVE = already overdue — the UI says "N days overdue" instead of clamping the truth away
// (clamping to 0 silently re-dated past dues to today on re-save). null = the 15-day default.
export function daysFromToday(iso: string | null, today = new Date()): number {
  if (!iso) return 15;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((parseDateOnly(iso).getTime() - base) / 86400000);
}

// Split `total` into n cent-exact parts; the leftover cents land on the LAST part so the parts
// sum EXACTLY to the total. Installments are portions of the TOTAL — tax is already inside,
// so they are never re-taxed. Works in integer cents to dodge float dust.
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round((Number(total) || 0) * 100);
  const count = Number.isFinite(n) ? Math.floor(n) : 0;
  if (count <= 1) return [cents / 100];
  const base = Math.floor(cents / count);
  const out: number[] = Array(count).fill(base);
  out[count - 1] = cents - base * (count - 1);
  return out.map((c) => c / 100);
}

// The plan rendered as document rows (label · due · amount). Labels are ENGLISH on purpose —
// these feed the PDF and the contract (owner's rule: client-facing output is always English);
// the app screens translate their own display copies. A deposit of 0 collapses to one row, and
// an installments plan with no rows falls back to one row (schedule insert failed → de-facto full).
export function planRows(plan: PaymentPlan, total: number): { label: string; amount: number; dueDate: string | null }[] {
  const t = round2(total);
  if (plan.mode === 'deposit') {
    const dep = round2(Math.min(Math.max(plan.depositAmount || 0, 0), t));
    if (dep <= 0) return [{ label: 'Full payment', amount: t, dueDate: null }];
    return [
      { label: 'Deposit', amount: dep, dueDate: plan.dueDate },
      { label: 'Balance', amount: round2(t - dep), dueDate: null },
    ];
  }
  if (plan.mode === 'installments' && plan.installments.length) {
    return [...plan.installments]
      .sort((a, b) => a.sort - b.sort)
      .map((r) => ({ label: r.label, amount: round2(r.amount), dueDate: r.dueDate }));
  }
  return [{ label: 'Full payment', amount: t, dueDate: plan.dueDate }];
}

export const paidTotal = (payments: { amount: number }[]) =>
  round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));

// Remaining balance right AFTER a given ledger payment (G3 receipts): total − Σ(payments up to
// and including it, in ledger order). Re-issuing an OLD receipt shows the balance as of that
// payment, not today's. An unknown id sums the whole ledger (= current balance) — safe fallback.
export function balanceAfterPayment(total: number, payments: { id: string; amount: number }[], paymentId: string): number {
  let sum = 0;
  for (const p of payments) {
    sum += Number(p.amount) || 0;
    if (p.id === paymentId) break;
  }
  return round2(Math.max(0, total - sum));
}
export const invoiceBalance = (total: number, paid: number) => round2(Math.max(0, total - paid));

// Ledger → invoice status. Half-cent epsilon so float dust never blocks "Paid"; nothing recorded
// is always "Unpaid" (a $0 total doesn't self-mark as paid).
export type InvoicePayStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export function statusFromPayments(total: number, paid: number): InvoicePayStatus {
  if (paid <= 0) return 'Unpaid';
  if (paid >= total - 0.005) return 'Paid';
  return 'Partially Paid';
}

// How much of the total the schedule rows do NOT yet cover (0 = fully allocated; negative = over).
export const unallocated = (total: number, rows: { amount: number }[]) =>
  round2(total - rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));

// Resize the installments editor's draft rows to `n` WITHOUT re-splitting rows the user already
// edited (the pristine path keeps the even re-split). Growing appends rows that soak up whatever
// the total still lacks (never negative), due 30 days after the previous row; shrinking drops
// from the end. Pure: the input rows are never mutated.
export function resizeDraftRows(
  rows: { label: string; amount: number; days: number }[],
  n: number,
  total: number
): { label: string; amount: number; days: number }[] {
  const count = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1));
  const out = rows.map((r) => ({ ...r }));
  while (out.length > count) out.pop();
  while (out.length < count) {
    const last = out[out.length - 1];
    out.push({
      label: `Payment ${out.length + 1}`,
      amount: Math.max(0, unallocated(total, out)),
      days: last ? last.days + 30 : 15,
    });
  }
  return out;
}

// Rescale a schedule proportionally to a new total (quote edited after invoicing, no payments
// yet). Cent-exact: every row is re-rounded and the LAST row absorbs the rounding difference.
// Guards: no rows → []; degenerate old total (or a negative row after rounding) → even split.
export function rescaleSchedule(rows: ScheduleRow[], oldTotal: number, newTotal: number): ScheduleRow[] {
  if (!rows.length) return [];
  const nt = round2(newTotal);
  const even = () => {
    const parts = splitInstallments(nt, rows.length);
    return rows.map((r, i) => ({ ...r, amount: parts[i] }));
  };
  if (!(oldTotal > 0)) return even();
  const out = rows.map((r) => ({ ...r, amount: round2((r.amount * nt) / oldTotal) }));
  const head = out.slice(0, -1).reduce((s, r) => s + r.amount, 0);
  out[out.length - 1].amount = round2(nt - head);
  if (out.some((r) => r.amount < 0)) return even(); // keep the DB's amount >= 0 check safe
  return out;
}

// Re-hydrate a PaymentPlan from a stored invoice (fields as fetchJobDetail maps them). A legacy
// %-only deposit (deposit_amount never materialized) is resolved against the frozen total.
export function planFromInvoice(inv: {
  paymentMode: PaymentMode;
  dueDate: string | null;
  depositPercent: number | null;
  depositAmount: number | null;
  total: number;
  schedule: ScheduleRow[];
}): PaymentPlan {
  return {
    mode: inv.paymentMode,
    dueDate: inv.dueDate,
    depositPercent: inv.depositPercent,
    depositAmount: round2(inv.depositAmount ?? (inv.depositPercent != null ? (inv.total * inv.depositPercent) / 100 : 0)),
    installments: inv.schedule,
  };
}

/* ---------------- Phases seeded from the quote (G4) — pure planning helpers ---------------- */
// A phase's name mirrors its line item's description, single-spaced and truncated to stay
// readable on the phase card. Empty descriptions fall back to a plain "Phase".
export const PHASE_NAME_MAX = 80;
export function phaseNameFromItem(desc: string, max = PHASE_NAME_MAX): string {
  const clean = String(desc || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Phase';
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}

// One phase per line item, in item order. Duplicate names get " (2)", " (3)"… so the
// name-keyed sync below can match phases ↔ items one-to-one.
export function seedPhasePlan(items: { desc: string }[]): { name: string; order: number }[] {
  const counts = new Map<string, number>();
  const taken = new Set<string>();
  return (items || []).map((it, i) => {
    const base = phaseNameFromItem(it.desc);
    let n = (counts.get(base) || 0) + 1;
    let name = n === 1 ? base : `${base} (${n})`;
    // an item may literally be NAMED "Paint (2)" — keep bumping until the final name is free,
    // so the name-keyed sync always has a one-to-one mapping
    while (taken.has(name)) {
      n += 1;
      name = `${base} (${n})`;
    }
    counts.set(base, n);
    taken.add(name);
    return { name, order: i };
  });
}

export type SyncPhase = { id: string; name: string; autoSeeded: boolean; status: string; hasContent: boolean };
// Set-logic sync of the seeded phases with the CURRENT quote items, keyed by NAME:
//  - remove: auto-seeded ∧ still not_started ∧ no photos/comments ∧ no item with that name anymore
//  - create: item names that have NO phase (of any kind) with that name yet
// Everything else — manual phases, started work, phases with photos or comments — is NEVER
// touched, even when its item disappeared (field history beats tidiness).
export function syncPhasePlan(
  phases: SyncPhase[],
  items: { desc: string }[],
  nextOrder = 0
): { removeIds: string[]; create: { name: string; order: number }[] } {
  const target = seedPhasePlan(items).map((p) => p.name);
  const targetSet = new Set(target);
  const phaseNames = new Set(phases.map((p) => p.name));
  const removeIds = phases
    .filter((p) => p.autoSeeded && p.status === 'not_started' && !p.hasContent && !targetSet.has(p.name))
    .map((p) => p.id);
  const create = target.filter((n) => !phaseNames.has(n)).map((n, i) => ({ name: n, order: nextOrder + i }));
  return { removeIds, create };
}

// "Sync with quote" only shows when it would actually DO something, and only on jobs that used
// the seeding at all — a purely manual phase list never gets the button.
export function needsPhaseSync(phases: SyncPhase[], items: { desc: string }[]): boolean {
  if (!phases.some((p) => p.autoSeeded)) return false;
  const plan = syncPhasePlan(phases, items);
  return plan.removeIds.length > 0 || plan.create.length > 0;
}

export const COMPANY = {
  name: 'Apex Renovations',
  license: 'Lic. #GC-204881',
  addr: '1820 Cedar Ridge Rd, Suite 4',
  city: 'Austin, TX 78701',
  phone: '(512) 555-0190',
  email: 'hello@apexreno.com',
};

export const ESTIMATE_ITEMS: LineItem[] = [
  { id: 1, cat: 'Labor', desc: 'Surface prep & priming', qty: 24, unit: 'hr', price: 65, taxable: false },
  { id: 2, cat: 'Materials', desc: 'Premium exterior paint', qty: 18, unit: 'gal', price: 80, taxable: true },
  { id: 3, cat: 'Labor', desc: 'Trim, fascia & doors', qty: 16, unit: 'hr', price: 70, taxable: false },
];

export type Job = {
  id: string;
  client: string | null;
  addr: string;
  title: string;
  stage: Stage;
  value: number;
  photos: number;
  date: string;
  thumb?: string | null; // first project photo, for the card thumbnail
  closed?: ClosedKind | null; // lost/archived (projects.status) — orthogonal to `stage`
};

export const JOBS: Job[] = [
  { id: 'j1', client: 'Maria Alvarez', addr: '14 Linden Ave', title: 'Exterior repaint', stage: 'Quoted', value: 4238.8, photos: 6, date: 'May 28' },
  { id: 'j2', client: 'Davis Property Mgmt', addr: '88 Harbor Rd, Bldg 2', title: 'Roof & gutter replace', stage: 'Invoiced', value: 12300.0, photos: 11, date: 'May 24' },
  { id: 'j3', client: 'Sunset HOA', addr: 'Building C lobby', title: 'Lobby renovation', stage: 'Approved', value: 6420.0, photos: 8, date: 'May 22' },
  { id: 'j4', client: null, addr: '5 photos · no address yet', title: 'Bathroom remodel', stage: 'Draft', value: 2150.0, photos: 5, date: 'Today' },
  { id: 'j5', client: 'Trent Walker', addr: '220 Oak St', title: 'Deck rebuild', stage: 'Paid', value: 8900.0, photos: 9, date: 'May 12' },
  { id: 'j6', client: 'Lin Residence', addr: '7 Maple Ct', title: 'Kitchen cabinet paint', stage: 'Sent', value: 3100.0, photos: 4, date: 'May 30' },
];

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  addr: string;
  city: string;
  zip?: string;
  state?: string;
  jobs: number;
};

export const CLIENTS: Client[] = [
  { id: 'c1', name: 'Maria Alvarez', phone: '(305) 555-0142', email: 'maria.alvarez@email.com', addr: '14 Linden Ave', city: 'Austin, TX 78704', jobs: 2 },
  { id: 'c2', name: 'Davis Property Mgmt', phone: '(512) 555-0888', email: 'ops@davispm.com', addr: '88 Harbor Rd', city: 'Austin, TX 78701', jobs: 5 },
  { id: 'c3', name: 'Sunset HOA', phone: '(512) 555-0455', email: 'board@sunsethoa.org', addr: '400 Vista Blvd', city: 'Round Rock, TX 78664', jobs: 3 },
  { id: 'c4', name: 'Trent Walker', phone: '(512) 555-0177', email: 'trent.w@email.com', addr: '220 Oak St', city: 'Austin, TX 78702', jobs: 1 },
  { id: 'c5', name: 'Lin Residence', phone: '(737) 555-0223', email: 'lin.home@email.com', addr: '7 Maple Ct', city: 'Cedar Park, TX 78613', jobs: 1 },
];

export const SERVICE_TYPES = ['Painting', 'Roofing', 'Flooring', 'Drywall', 'Plumbing', 'Electrical', 'Carpentry', 'Concrete', 'Landscaping', 'Demolition'];

export const initials = (n: string) =>
  n.split(' ').map((w) => w[0]).slice(0, 2).join('');

/* ---------------- Starter estimate (deterministic fallback when the AI is unavailable) ---------------- */
type StarterItem = Omit<LineItem, 'id'>;
const STARTER_CATALOG: Record<string, StarterItem[]> = {
  Painting: [
    { cat: 'Labor', desc: 'Surface prep & priming', qty: 16, unit: 'hr', price: 55, taxable: false },
    { cat: 'Materials', desc: 'Paint & supplies', qty: 12, unit: 'gal', price: 45, taxable: true },
    { cat: 'Labor', desc: 'Painting (two coats)', qty: 20, unit: 'hr', price: 55, taxable: false },
  ],
  Roofing: [
    { cat: 'Labor', desc: 'Tear-off & disposal', qty: 12, unit: 'hr', price: 65, taxable: false },
    { cat: 'Materials', desc: 'Shingles & underlayment', qty: 20, unit: 'sq', price: 110, taxable: true },
    { cat: 'Labor', desc: 'Roof installation', qty: 24, unit: 'hr', price: 65, taxable: false },
  ],
  Flooring: [
    { cat: 'Labor', desc: 'Removal & subfloor prep', qty: 10, unit: 'hr', price: 55, taxable: false },
    { cat: 'Materials', desc: 'Flooring material', qty: 400, unit: 'sqft', price: 4.5, taxable: true },
    { cat: 'Labor', desc: 'Flooring installation', qty: 18, unit: 'hr', price: 55, taxable: false },
  ],
  Drywall: [
    { cat: 'Materials', desc: 'Drywall sheets & compound', qty: 20, unit: 'sheet', price: 18, taxable: true },
    { cat: 'Labor', desc: 'Hang, tape & mud', qty: 20, unit: 'hr', price: 50, taxable: false },
    { cat: 'Labor', desc: 'Sand & finish', qty: 8, unit: 'hr', price: 50, taxable: false },
  ],
  Plumbing: [
    { cat: 'Labor', desc: 'Plumbing labor', qty: 12, unit: 'hr', price: 85, taxable: false },
    { cat: 'Materials', desc: 'Fixtures & fittings', qty: 1, unit: 'job', price: 600, taxable: true },
  ],
  Electrical: [
    { cat: 'Labor', desc: 'Electrical labor', qty: 12, unit: 'hr', price: 85, taxable: false },
    { cat: 'Materials', desc: 'Wiring, devices & panel', qty: 1, unit: 'job', price: 700, taxable: true },
  ],
  Carpentry: [
    { cat: 'Labor', desc: 'Carpentry labor', qty: 16, unit: 'hr', price: 60, taxable: false },
    { cat: 'Materials', desc: 'Lumber & hardware', qty: 1, unit: 'job', price: 800, taxable: true },
  ],
  Concrete: [
    { cat: 'Labor', desc: 'Forming & pour', qty: 16, unit: 'hr', price: 60, taxable: false },
    { cat: 'Materials', desc: 'Concrete & rebar', qty: 8, unit: 'yd', price: 160, taxable: true },
  ],
  Landscaping: [
    { cat: 'Labor', desc: 'Site prep & planting', qty: 16, unit: 'hr', price: 45, taxable: false },
    { cat: 'Materials', desc: 'Plants, soil & materials', qty: 1, unit: 'job', price: 500, taxable: true },
  ],
  Demolition: [
    { cat: 'Labor', desc: 'Demolition labor', qty: 16, unit: 'hr', price: 50, taxable: false },
    { cat: 'Equipment', desc: 'Dumpster & disposal', qty: 1, unit: 'job', price: 450, taxable: true },
  ],
};
const STARTER_GENERIC: StarterItem[] = [
  { cat: 'Labor', desc: 'Labor', qty: 16, unit: 'hr', price: 55, taxable: false },
  { cat: 'Materials', desc: 'Materials', qty: 1, unit: 'job', price: 500, taxable: true },
];

// Builds an editable base estimate from the selected services × regional multiplier — used when the
// AI fails/offline so the screen is never a dead end. Unknown services fall back to a generic pair.
export function buildStarterEstimate(services: string[], regionMult = 1): LineItem[] {
  const base: StarterItem[] = [];
  const picked = (services || []).filter((s) => STARTER_CATALOG[s]);
  if (picked.length) picked.forEach((s) => base.push(...STARTER_CATALOG[s]));
  else base.push(...STARTER_GENERIC);
  const m = regionMult > 0 ? regionMult : 1;
  return base.map((it, i) => ({ id: i + 1, cat: it.cat, desc: it.desc, qty: it.qty, unit: it.unit, price: Math.round(it.price * m * 100) / 100, taxable: it.taxable }));
}
