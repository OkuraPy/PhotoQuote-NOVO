import { buildStarterEstimate, calcTotals, deriveStage } from '../../data';
import type { LineItem } from '../../data';

const item = (over: Partial<LineItem> = {}): LineItem => ({
  id: 1, cat: 'Labor', desc: '', qty: 1, unit: 'hr', price: 100, taxable: false, ...over,
});

describe('calcTotals', () => {
  it('sums the subtotal across items', () => {
    expect(calcTotals([item({ qty: 2, price: 50 }), item({ qty: 1, price: 30 })], 0).subtotal).toBe(130);
  });

  it('taxes only taxable items', () => {
    const t = calcTotals([item({ price: 100, taxable: true }), item({ price: 100, taxable: false })], 10);
    expect(t.taxableSubtotal).toBe(100);
    expect(t.tax).toBeCloseTo(10);
    expect(t.total).toBeCloseTo(210);
  });

  it('applies margin on (subtotal + tax)', () => {
    const t = calcTotals([item({ price: 100, taxable: true })], 10, 20);
    // subtotal 100, tax 10, margin = 110 * 0.20 = 22, total = 132
    expect(t.margin).toBeCloseTo(22);
    expect(t.total).toBeCloseTo(132);
  });

  it('handles an empty list', () => {
    expect(calcTotals([], 8.25).total).toBe(0);
  });
});

describe('deriveStage', () => {
  it('no estimate, no invoice → Draft', () => {
    expect(deriveStage(undefined, undefined)).toBe('Draft');
  });

  it('an estimate (any status) → at least Quoted', () => {
    expect(deriveStage('Draft')).toBe('Quoted');
    expect(deriveStage('draft')).toBe('Quoted'); // case-insensitive
  });

  it('Sent → Sent', () => {
    expect(deriveStage('Sent')).toBe('Sent');
  });

  it('Approved / In Progress / Completed → Approved (Completed is NOT money received)', () => {
    expect(deriveStage('Approved')).toBe('Approved');
    expect(deriveStage('In Progress')).toBe('Approved');
    expect(deriveStage('Completed')).toBe('Approved'); // the "Recebido" inflation bug (A3)
  });

  it('any non-paid invoice → Invoiced', () => {
    expect(deriveStage('Approved', 'Sent')).toBe('Invoiced');
    expect(deriveStage('Draft', 'Overdue')).toBe('Invoiced');
    expect(deriveStage(undefined, 'Unpaid')).toBe('Invoiced');
  });

  it('a paid invoice → Paid (case-insensitive)', () => {
    expect(deriveStage('Approved', 'Paid')).toBe('Paid');
    expect(deriveStage('Approved', 'paid')).toBe('Paid');
  });
});

describe('buildStarterEstimate', () => {
  it('uses the catalog for a known service', () => {
    const items = buildStarterEstimate(['Painting'], 1);
    expect(items.length).toBe(3);
    expect(items.every((i) => i.price > 0)).toBe(true);
    expect(items.some((i) => i.taxable)).toBe(true);
  });

  it('combines multiple services with unique ids', () => {
    const items = buildStarterEstimate(['Painting', 'Roofing'], 1);
    expect(items.length).toBe(6);
    expect(new Set(items.map((i) => i.id)).size).toBe(6);
  });

  it('falls back to a generic pair for empty/unknown services', () => {
    expect(buildStarterEstimate([], 1).length).toBe(2);
    expect(buildStarterEstimate(['Nonexistent'], 1).length).toBe(2);
  });

  it('applies the regional multiplier to prices', () => {
    const base = buildStarterEstimate(['Painting'], 1);
    const scaled = buildStarterEstimate(['Painting'], 1.2);
    expect(scaled[0].price).toBeCloseTo(Math.round(base[0].price * 1.2 * 100) / 100);
  });

  it('guards against a non-positive multiplier', () => {
    const base = buildStarterEstimate(['Painting'], 1);
    expect(buildStarterEstimate(['Painting'], 0)[0].price).toBe(base[0].price);
  });
});
