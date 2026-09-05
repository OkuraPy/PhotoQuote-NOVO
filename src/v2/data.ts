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

// Money typed (or PASTED) by a human, in any of the separator conventions this app ships in.
// "1.000,50" (pt/es) and "1,000.50" (en) both mean 1000.50 — the LAST separator is the decimal one
// and everything before it is thousands. A bare parseFloat gets "1.000,50" catastrophically wrong
// (it returns 1), and this value drives a discount: reading 1 instead of 1000 turns a $1,098 quote
// into a $1.00 one. Returns null when there is no number in there at all.
export function parseMoney(text: string): number | null {
  const raw = String(text ?? '').replace(/[^0-9.,-]/g, '');
  if (!raw || !/[0-9]/.test(raw)) return null;
  const sep = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  // a single separator with 3 digits after it is a thousands mark ("1.000"), not a decimal
  const decimals = sep >= 0 ? raw.length - sep - 1 : 0;
  const isDecimalSep = sep >= 0 && decimals > 0 && decimals !== 3;
  const clean = isDecimalSep
    ? `${raw.slice(0, sep).replace(/[.,]/g, '')}.${raw.slice(sep + 1).replace(/[.,]/g, '')}`
    : raw.replace(/[.,]/g, '');
  const n = parseFloat(clean);
  return isFinite(n) ? n : null;
}

// A PERCENTAGE typed by a human. Deliberately NOT parseMoney: the "three digits after the
// separator means thousands" rule is right for money and wrong here — parseMoney('12.567') is
// 12567 and parseMoney('0.005') is 5. A percentage is a plain decimal, comma or dot, one decimal
// place kept (12.5% is a real deal; 12.55% is a typo waiting to redraw itself on screen).
export function parsePercent(text: string): number | null {
  const raw = String(text ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!raw || !/[0-9]/.test(raw)) return null;
  const n = parseFloat(raw);
  return isFinite(n) ? Math.round(n * 10) / 10 : null;
}

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

/* ---------------- G-1: the client-facing discount ---------------- */
// Two ways in, ONE number stored: `percent` is the intention (a "-30% for this contractor" has to
// follow the subtotal when an item changes) and `amount` is the resolved dollars — which is what
// the documents, the invoice and the DB read. percent = 0 means "typed in dollars".
export type Discount = { percent: number; amount: number };
export const NO_DISCOUNT: Discount = { percent: 0, amount: 0 };

// Resolve a Discount against a subtotal. MUST mirror update_estimate_totals() in the DB, clamp
// included: a discount can zero a quote, never turn it into a credit.
//
// The percentage is worked out in integer CENTS on purpose. Postgres computes it in exact decimal
// and rounds a half-cent tie UP; `subtotal * pct / 100` in floats lands just under the tie and
// rounds DOWN — 8746.71 at 50% gave 4373.35 on screen and 4373.36 in the database, so the four
// printed lines of the quote did not add up. In cents: 874671 × 50 / 100 = 437335.5 → 437336. ✓
export function resolveDiscount(subtotal: number, d?: Discount | null): number {
  if (!d) return 0;
  const subCents = Math.round(round2(subtotal) * 100);
  const raw = d.percent > 0 ? Math.round((subCents * d.percent) / 100) / 100 : round2(d.amount || 0);
  return Math.min(Math.max(0, raw), round2(subtotal));
}

// §9 official formula — mirrors the planned calc-totals Edge Function.
// `discount` is the RESOLVED dollar amount (see resolveDiscount) and comes off BEFORE tax, shrinking
// the taxable base in proportion to how much of the subtotal was taxable (owner's call D2).
export function calcTotals(items: LineItem[], taxRate: number, marginRate = 0, discount = 0) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const taxableSubtotal = items.filter((i) => i.taxable).reduce((s, i) => s + i.qty * i.price, 0);
  // No discount = the original path, untouched and unrounded. It is what every existing estimate
  // was computed with, and what makes the "embedded markup == legacy margin" equivalence exact.
  if (!(discount > 0) || !(subtotal > 0)) {
    const tax = taxableSubtotal * (taxRate / 100);
    const margin = (subtotal + tax) * (marginRate / 100);
    return { subtotal, taxableSubtotal, discount: 0, tax, margin, total: subtotal + tax + margin };
  }
  // Discounted path rounds at every step, exactly where the DB's numeric(12,2) rounds — the
  // preview on screen has to be the cent the trigger will store, or "round it to $1,000" lands
  // on $1,000.01 the moment it is saved.
  // round the two bases FIRST: the trigger stores them as numeric(12,2) and computes the taxable
  // share from the rounded numbers, so a float sum of fractional quantities would drift a cent
  const sub2 = round2(subtotal);
  const taxable2 = round2(taxableSubtotal);
  const disc = Math.min(round2(discount), sub2);
  const taxableAfter = round2(taxable2 * (1 - disc / sub2));
  const tax = round2(taxableAfter * (taxRate / 100));
  const margin = round2((sub2 - disc + tax) * (marginRate / 100));
  return { subtotal, taxableSubtotal, discount: disc, tax, margin, total: round2(sub2 - disc + tax + margin) };
}

// "deu 1.099, quer deixar 1.000 redondo" — the owner types the FINAL total and the app derives the
// discount that produces it. Closed form (no search loop): with the discount coming off pre-tax and
// the taxable base shrinking proportionally,
//     total = S − D + (T·r)·(1 − D/S)     →     D = (S + k − target) / (1 + k/S),  k = T·r
// where S = subtotal, T = taxable subtotal, r = tax rate. A single correction pass absorbs the cent
// that rounding can leave behind. Assumes marginRate 0 (the embedded-markup scheme every editor
// writes today); a legacy margin estimate is folded to embedded markup before it can be edited.
export function discountFromTarget(subtotal: number, taxableSubtotal: number, taxRate: number, target: number): number {
  if (!(subtotal > 0)) return 0;
  const k = taxableSubtotal * (taxRate / 100);
  const clamp = (d: number) => Math.min(Math.max(0, round2(d)), round2(subtotal));
  let d = clamp((subtotal + k - target) / (1 + k / subtotal));
  // rounded like calcTotals rounds it — otherwise "which one lands closer to the typed number" is
  // decided on a total the screen will never show
  const totalWith = (x: number) => round2(round2(subtotal) - x + round2(round2(round2(taxableSubtotal) * (1 - x / round2(subtotal))) * (taxRate / 100)));
  const off = round2(totalWith(d) - target);
  if (off !== 0) {
    const fixed = clamp(d + off);
    // only keep the correction if it actually lands closer to what the owner typed
    if (Math.abs(totalWith(fixed) - target) < Math.abs(totalWith(d) - target)) d = fixed;
  }
  return d;
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
// `note` (G-6) is the client-facing reference the owner types when recording the payment —
// "Check #1234 · Chase". It prints on the receipt, so it is never a private remark.
// `receiptNumber`/`balanceAfter` dizem se este pagamento JÁ virou papel na mão do cliente, e com
// que saldo — o que decide se o número pode ser recalculado ou tem que ser respeitado.
export type PaymentRecord = { id: string; amount: number; paidAt: string; method: string | null; scheduleId: string | null; note: string | null; receiptNumber?: string | null; balanceAfter?: number | null };
// A reduction of what is owed with no money attached (returned material, agreed cut after billing).
export type CreditRecord = { id: string; amount: number; reason: string | null; createdAt: string };
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

// A credit has to land somewhere in the agreed instalments, or the plan keeps adding up to more
// than what is owed (two balances on one page). It comes off the LAST rows first: the early ones
// are usually already paid or already promised, and "what is still to come got smaller" is the
// sentence the contractor can say to the client without doing any arithmetic.
export function applyCreditToRows<T extends { amount: number }>(rows: T[], credit: number): T[] {
  let left = round2(Math.max(0, credit));
  if (!left) return rows;
  const out = rows.map((r) => ({ ...r }));
  for (let i = out.length - 1; i >= 0 && left > 0.005; i--) {
    const take = Math.min(round2(out[i].amount), left);
    out[i].amount = round2(out[i].amount - take);
    left = round2(left - take);
  }
  // a row that got fully absorbed is not a payment the client still owes
  return out.filter((r) => r.amount > 0.005) as T[];
}

export const paidTotal = (payments: { amount: number }[]) =>
  round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));

// The receipt offered right after recording has to print the SAME balance the re-issue prints —
// same receipt number, same PDF. The ledger comes back ordered by paid_at, so a back-dated payment
// lands BEFORE ones already recorded: "total − everything paid so far" is not that number.
// Sort is stable, so same-day payments keep insertion order = the DB's created_at tiebreak.
export function balanceAfterNewPayment(
  total: number,
  payments: { id: string; amount: number; paidAt: string }[],
  added: { id: string; amount: number; paidAt: string }
): number {
  const ledger = [...payments, added].sort((a, b) => (a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0));
  return balanceAfterPayment(total, ledger, added.id);
}

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

/* ---------------- G-9: a job can hold more than one invoice ---------------- */
// "quando alterar o orçamento… a gente tem que gerar um novo invoice, tem que ter outros invoices
// gerados ali" (dono, 24/08). The first invoice keeps everything the client already paid; the extra
// work becomes a SECOND invoice. Every number the job header, the list and the metrics show is then
// the roll-up of all of them — a $10,400 job must never read as $2,400 because that is the newest
// invoice. `amountPaid` already accounts for the legacy 'Paid'-without-ledger case upstream.
export type InvoiceLike = { total: number; amountPaid: number; creditTotal?: number };
export function invoiceRollup(list: InvoiceLike[]) {
  // credits come off the billed total: a returned smoke detector was never owed, so it must not
  // sit in the balance, in "invoiced", or in the job's worth
  const total = round2(list.reduce((s, i) => s + invoiceDue(i.total, i.creditTotal || 0), 0));
  const paid = round2(list.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0));
  return {
    count: list.length,
    total,
    // What was BILLED, before any abatement. The quote must be compared against this, never against
    // `total`: forgiving a $290.27 balance drops the net below the quote, and the app then announced
    // "the job grew $290.27 — bill more", asking him to re-bill what he had just written off. The
    // abatement changes what is OWED; it does not un-bill the document the client received.
    billed: round2(list.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    paid,
    balance: invoiceBalance(total, paid),
    // no invoice at all is NOT "Unpaid" money — the caller distinguishes with count
    status: statusFromPayments(total, paid),
  };
}

/* ---------------- Credits: the mirror of the complementary invoice ---------------- */
// "teve que devolver um e teve que dar um descontinho aí no valor… recebido com desconto pra zerar
// o invoice, não ficar com saldo" (dono, 05/09). The scope SHRANK after the invoice went out and
// the client already paid part of it — the invoice stops following the quote at that point, so the
// difference used to sit as a balance nobody would ever pay.
//
// A credit is NOT a payment: no money moved. It reduces what is owed, keeps the original amount on
// the record, and prints its reason on the document so the client sees WHY the invoice changed.
export const creditTotal = (credits: { amount: number }[]) =>
  round2(credits.reduce((s, c) => s + (Number(c.amount) || 0), 0));

// Credits recorded UP TO a given day. A receipt re-issued later must print the balance as of ITS
// payment, so a credit entered afterwards cannot rewrite it — same rule the payment ledger follows.
export function creditTotalUpTo(credits: { amount: number; createdAt: string }[], dayISO: string): number {
  return round2(
    credits.reduce((s, c) => (toDateOnly(new Date(c.createdAt)) <= dayISO ? s + (Number(c.amount) || 0) : s), 0)
  );
}

// What a job is WORTH for the company's numbers: every invoice net of its credits, falling back to
// the quote while nothing has been billed. Pure and tested because it feeds the Home totals —
// returned material must never show up as money the company made.
export function jobValueFromInvoices(
  invoices: { total: number; credit?: number }[],
  quoteTotal: number
): number {
  if (!invoices.length) return round2(Number(quoteTotal) || 0);
  return round2(invoices.reduce((s, i) => s + invoiceDue(i.total, i.credit || 0), 0));
}

// What the client actually owes on an invoice once credits are applied.
export const invoiceDue = (total: number, credits: number) =>
  round2(Math.max(0, (Number(total) || 0) - (Number(credits) || 0)));

// How much credit still FITS. Capped at the open balance on purpose: crediting past what is owed
// would mean money back to the client, and this app has no refund flow (nor a way to undo a
// payment). The screen offers the capped number and says so.
export const creditRoom = (total: number, credits: number, paid: number) =>
  round2(Math.max(0, (Number(total) || 0) - (Number(credits) || 0) - (Number(paid) || 0)));

// What the quote still has NOT put on any invoice — the amount a complementary invoice starts at.
// Negative (the quote shrank below what was already billed) reads as zero: there is nothing new to
// charge, and the app must never offer a negative invoice.
export const uninvoiced = (quoteTotal: number, invoicedTotal: number) =>
  round2(Math.max(0, (Number(quoteTotal) || 0) - (Number(invoicedTotal) || 0)));

// Which invoice absorbs an abatement. Both halves of the pair have to look at the same thing: the
// "bill more" card is computed over the WHOLE job, so "take off" cannot be tied to whatever invoice
// happens to be selected — on a job with two invoices whose first is settled, that offered $0.
export function pickCreditTarget<T extends { total: number; creditTotal: number; amountPaid: number }>(invoices: T[]): T | undefined {
  return invoices.find((i) => creditRoom(i.total, i.creditTotal, i.amountPaid) > 0.005);
}

// The mirror of `uninvoiced`: how far the quote fell BELOW what is still billed. NOTE the pair uses
// DIFFERENT bases on purpose, and it took a production counter-example to see why:
//   · `uninvoiced` compares against the GROSS billed — an abatement is not scope waiting to be
//     billed, so forgiving a balance must not read as "the job grew, bill it again";
//   · `overbilled` compares against the NET — once the abatement is recorded the gap is closed, and
//     comparing against the gross would keep asking to take the same money off forever.
// With these two bases the pair goes quiet after either action, in both directions.
export const overbilled = (quoteTotal: number, invoicedTotal: number) =>
  round2(Math.max(0, (Number(invoicedTotal) || 0) - (Number(quoteTotal) || 0)));

// Break a change-order amount (what the client owes MORE, tax included) into the same shape a
// normal invoice has: a pre-tax subtotal, the taxable slice of it, and the tax at the quote's real
// rate. Derived so the document is arithmetically true line by line —
//     subtotal + subtotal·share·rate = amount   →   subtotal = amount / (1 + share·rate)
// where `share` is how much of the quote was taxable. Printing "Tax (7% on $473.37) = $33.14" is
// then a fact, not a proportion dressed up as a rate. The tax absorbs the rounding cent so the
// parts always add back to the amount exactly.
export function splitChangeOrder(amount: number, quoteSubtotal: number, quoteTaxableSubtotal: number, taxRate: number) {
  const amt = round2(Math.max(0, Number(amount) || 0));
  const share = quoteSubtotal > 0 ? Math.min(Math.max(0, (Number(quoteTaxableSubtotal) || 0) / quoteSubtotal), 1) : 0;
  const rate = Math.max(0, Number(taxRate) || 0) / 100;
  const subtotal = round2(amt / (1 + share * rate));
  const tax = round2(amt - subtotal);
  // NOTE: the taxable slice is not returned on purpose. Nothing stores it, so the screen and the
  // PDF recover it from the frozen tax (`tax / rate`) — returning a second, slightly different
  // number here would only invite someone to test the one that never ships.
  return { subtotal, tax, total: amt };
}

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

/* ---------------- Team (Onda B): roles & credential helpers (pure) ---------------- */
// App-level role of the signed-in account. 'owner' = no team_members row (the account owns its
// data); 'office'/'field' come from team_members.role. The Team screen creates BOTH 'field' and
// 'office' members (Onda E); office runs the business, field only sees assigned jobs.
export type TeamRole = 'owner' | 'office' | 'field';
export type MemberRole = Exclude<TeamRole, 'owner'>; // what team_members.role actually stores

// Money-visibility matrix: owner and office always see values; field only with the per-member
// can_see_financials flag (the RLS enforces the same rule server-side — this mirrors it for UI).
export function canSeeMoney(role: TeamRole, memberFlag?: boolean | null): boolean {
  return role === 'field' ? !!memberFlag : true;
}

// Unambiguous alphabet (no 0/O/1/l/I): the owner often reads this password out loud to the crew.
export const PASSWORD_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
// Map random bytes onto the alphabet (callers pass >= len bytes from expo-crypto; the modulo on
// the index is only a never-crash guard for short inputs). The tiny modulo bias (256 % 52 ≠ 0)
// is irrelevant here — this is a starter password the owner can freely retype.
export function passwordFromBytes(bytes: ArrayLike<number>, len = 10): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    const b = bytes.length ? Number(bytes[i % bytes.length]) || 0 : 0;
    out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
  }
  return out;
}

// The "send this to your employee" message. This is the OWNER talking to their own crew — not a
// client-facing document — so it IS localized (owner's rule only bans non-English client output).
export function credentialsMessage(locale: 'en' | 'es' | 'pt', p: { company?: string | null; email: string; password: string }): string {
  const co = String(p.company || '').trim();
  const L = {
    en: { added: co ? `${co} added you to PhotoQuote.` : 'You were added to PhotoQuote.', how: 'Download the app and sign in with:', email: 'Email', pass: 'Password', change: 'You can change the password later in Profile → Change password.' },
    es: { added: co ? `${co} te agregó a PhotoQuote.` : 'Te agregaron a PhotoQuote.', how: 'Descarga la app e inicia sesión con:', email: 'Correo', pass: 'Contraseña', change: 'Puedes cambiar la contraseña luego en Perfil → Cambiar contraseña.' },
    pt: { added: co ? `${co} adicionou você ao PhotoQuote.` : 'Você foi adicionado ao PhotoQuote.', how: 'Baixe o aplicativo e entre com:', email: 'E-mail', pass: 'Senha', change: 'Você pode trocar a senha depois em Perfil → Alterar senha.' },
  }[locale];
  return `${L.added}\n${L.how}\n\n${L.email}: ${p.email}\n${L.pass}: ${p.password}\n\n${L.change}`;
}

/* ---------------- Plans / billing (Onda D) ---------------- */
// Approved model (ESTUDO §4, owner OK): Solo $39/mo ($29 annual) · Team $99/mo ($79 annual,
// 3 seats, +$19/extra seat) · 14-day trial, no card. Nothing is billed until the store build:
// these helpers only shape UI state (banner/paywall). 'active' (legacy/paid) never blocks.
export type BillingState = 'ok' | 'trial' | 'expired';

// users.subscription_status/expires_at → what the OWNER's UI should do.
// Unknown/legacy statuses degrade to 'ok' (never lock a paying/grandfathered account by accident).
export function billingState(status?: string | null, expiresAt?: string | null, now: Date = new Date()): BillingState {
  if (status !== 'trial') return 'ok';
  if (!expiresAt) return 'trial';
  return new Date(expiresAt).getTime() >= now.getTime() ? 'trial' : 'expired';
}

// Days left on the trial, for the banner (ceil: "expira hoje" = 1, nunca 0 enquanto válido).
export function trialDaysLeft(expiresAt?: string | null, now: Date = new Date()): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
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
  // G-5: money already landed but the invoice is not closed. deriveStage cannot carry this (a
  // half-paid invoice is still "Invoiced"), and from the list that read as "nothing was paid".
  partial?: boolean;
  // every invoice/estimate number this job owns ("INV-2026-0040", "EST-099") — the list searches
  // them; docLabel is the newest one, shown on the card so a hit is identifiable at a glance
  docNumbers?: string[];
  docLabel?: string | null;
};

// The contractor is paid by check quoting the INVOICE NUMBER, so the jobs list has to answer by
// number as well as by name/address.
//
// Four number shapes live in this database (checked against production, 05/09/2026):
//   INV-2026-0040   current invoices        EST-099        current estimates
//   EST-2026-023    legacy estimates (19)   INV-MPRE7CE0   legacy invoices (6, base36, no sequence)
//
// A document is parsed into its delimiter-separated segments. The SEQUENCE is the last segment and
// only when that whole segment is digits — "INV-MNUAANR1" must NOT answer to "1".
type ParsedDoc = { alnum: string; alpha: string; seq: number | null };
const parseDoc = (raw: string): ParsedDoc => {
  const segs = String(raw).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const last = segs[segs.length - 1] || '';
  return {
    alnum: segs.join(''),
    alpha: /^[a-z]+$/.test(segs[0] || '') ? segs[0] : '',
    seq: /^\d+$/.test(last) ? Number(last) : null,
  };
};
// "inv 2026 0040", "INV-2026-0040", "#40", "est99" all tokenize the same way
const queryTokens = (q: string) => q.toLowerCase().match(/[a-z]+|\d+/g) || [];
// "Luís" ↔ "luis": the contractor types without accents, the client list is full of them
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const DOC_NO = 0;
const DOC_SEQ = 1; // matched the document's sequence
const DOC_EXACT = 2; // the whole number was typed out

function docMatches(raw: string, tokens: string[]): 0 | 1 | 2 {
  const d = parseDoc(raw);
  const qc = tokens.join('');
  if (qc && qc === d.alnum) return DOC_EXACT;
  const nums = tokens.filter((tk) => /^\d+$/.test(tk));
  const words = tokens.filter((tk) => /^[a-z]+$/.test(tk));
  if (d.seq !== null) {
    // a numbered document answers to at most ONE word (its prefix). Without this, typing the whole
    // legacy id "INV-MOLX1QGP" matched INV-2026-0001, because the "1" inside it read as sequence 1.
    if (words.length > 1) return DOC_NO;
    // "est…" must not answer for an invoice, and vice versa. The 3-letter floor matters: on a bare
    // "i", every invoiced job matched as a document and outranked the client the owner was typing.
    if (words.length && !(words[0].length >= 3 && d.alpha && d.alpha.startsWith(words[0]))) return DOC_NO;
    // the sequence is compared by VALUE, never by substring. Substring would make "EST-100" match
    // EST-1001/1002/1003 (all real), and "#40" match INV-2026-0140.
    if (!nums.length) return DOC_SEQ; // typing just "inv" lists the invoices
    return Number(nums[nums.length - 1]) === d.seq ? DOC_SEQ : DOC_NO;
  }
  // legacy id with no numeric tail ("INV-MPRE7CE0"): containment is the only thing that can work.
  // The 3-char floor keeps a lone "1" from dragging every legacy invoice to the top.
  return qc.length >= 3 && d.alnum.includes(qc) ? DOC_SEQ : DOC_NO;
}

// Ranked on purpose. Checked against real production data: searching "34" also matches the ZIPs
// 33428/33405 inside addresses, so a plain boolean filter buried INV-2026-0034 under four street
// matches — exactly the "open one by one" the search was meant to end. A document-number hit is a
// deliberate hit, so it sorts first; text hits stay in the list, just below.
export const MATCH_NONE = 0;
export const MATCH_TEXT = 1;
export const MATCH_DOC = 2; // estimate (or any non-invoice document), matched by sequence
export const MATCH_INVOICE = 3; // invoice matched by sequence
export const MATCH_EXACT = 4; // the whole number was typed — nothing outranks that

export function rankJobMatch(j: Job, query: string): 0 | 1 | 2 | 3 | 4 {
  const q = query.trim().toLowerCase();
  if (!q) return MATCH_TEXT;
  const tokens = queryTokens(q);
  // tokens can be empty for a punctuation-only query ("#"), which must not match every document
  if (tokens.length) {
    // Invoice and estimate numbering run independently, so "40" is BOTH INV-2026-0040 and EST-040 —
    // on different jobs (checked in production: it happens 20+ times). The request that started
    // this is a check in hand, and a check always quotes the invoice, so the invoice wins the tie.
    // Typing "est 40" still lands on the estimate: the prefix filters the invoice out entirely.
    // And whoever types the number in full gets that exact document, whatever kind it is — the
    // legacy "EST-2026-023" would otherwise lose to the newer EST-023, which shares sequence 23.
    let best: 0 | 2 | 3 = MATCH_NONE;
    for (const raw of j.docNumbers || []) {
      const m = docMatches(raw, tokens);
      if (!m) continue;
      if (m === DOC_EXACT) return MATCH_EXACT;
      if (/^\s*inv/i.test(String(raw))) best = MATCH_INVOICE;
      else if (!best) best = MATCH_DOC;
    }
    if (best) return best;
  }
  // name/address/title, each on its own: joining them let "services 1017" match across two fields.
  // Accent-folded both ways — the client list has "Luís Fernando", and nobody types the accent.
  const qf = fold(q);
  return [j.client || 'no client', j.addr, j.title].some((f) => fold(f).includes(qf)) ? MATCH_TEXT : MATCH_NONE;
}

// Card label: "INV #0040" reads at a glance and leaves room for the address, where the full
// "INV-2026-0040" ate ~80pt on a small iPhone. A legacy id has no sequence, so it shows whole.
// The middle segment (the year) is KEPT when there is one: dropping it made EST-022 and
// EST-2026-022 — two different jobs, both real — show the identical "EST #022" on the list.
export function shortDocLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const segs = String(raw).split(/[^A-Za-z0-9]+/).filter(Boolean);
  const last = segs[segs.length - 1] || '';
  const head = segs[0] || '';
  if (!/^\d+$/.test(last) || !/^[A-Za-z]+$/.test(head)) return String(raw);
  const middle = segs.slice(1, -1).join('-');
  return `${head.toUpperCase()} #${middle ? `${middle}-` : ''}${last}`;
}

export function jobMatchesQuery(j: Job, query: string): boolean {
  return rankJobMatch(j, query) !== MATCH_NONE;
}

// Filter + rank in one pass, keeping the original (newest-first) order inside each group. Closed
// jobs sort last but are NOT dropped: five production invoices belong to lost projects, and a check
// for one of them (INV-2026-0018) has to find its job — "No matches" was the whole complaint.
export function searchJobs<T extends Job>(jobs: T[], query: string): T[] {
  if (!query.trim()) return jobs;
  return jobs
    .map((j, i) => ({ j, i, r: rankJobMatch(j, query) }))
    .filter((x) => x.r !== MATCH_NONE)
    .sort((a, b) => b.r - a.r || Number(!!a.j.closed) - Number(!!b.j.closed) || a.i - b.i)
    .map((x) => x.j);
}

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
  notes?: string; // hydrated into the editor — an untouched edit must not wipe it
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
