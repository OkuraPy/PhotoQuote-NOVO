import { calcTotals, deriveStage } from '../../data';
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
