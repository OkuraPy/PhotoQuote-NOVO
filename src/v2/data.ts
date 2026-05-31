// PhotoQuote v2 — mock data + money helpers (mirrors the handoff app/data.jsx).
// First pass uses this so the app is runnable; later wired to Supabase + Edge Functions.
import { Stage } from './theme';

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
  price: number;
  taxable: boolean;
};

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
