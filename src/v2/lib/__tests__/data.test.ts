import { applyMarkup, buildStarterEstimate, calcTotals, closedFromStatus, deriveBase, deriveStage, homeMetrics } from '../../data';
import type { ClosedKind, LineItem } from '../../data';
import type { Stage } from '../../theme';

const item = (over: Partial<LineItem> = {}): LineItem => ({
  id: 1, cat: 'Labor', desc: '', qty: 1, unit: 'hr', price: 100, taxable: false, ...over,
});

describe('applyMarkup', () => {
  it('pct 0 is identity on prices (but records the base)', () => {
    const [out] = applyMarkup([item({ price: 65 })], 0);
    expect(out.price).toBe(65);
    expect(out.basePrice).toBe(65);
  });

  it('folds the pct into the unit price, rounded to cents', () => {
    const [a, b] = applyMarkup([item({ price: 65 }), item({ price: 4.5 })], 15);
    expect(a.price).toBe(74.75); // 65 * 1.15
    expect(a.basePrice).toBe(65);
    expect(b.price).toBe(5.18); // 4.5 * 1.15 = 5.175 → 5.18
    expect(b.basePrice).toBe(4.5);
  });

  it('re-applying with a different pct does NOT compound (recomputes from basePrice)', () => {
    const once = applyMarkup([item({ price: 100 })], 15);
    const [again] = applyMarkup(once, 20);
    expect(again.basePrice).toBe(100);
    expect(again.price).toBe(120); // from the base, not from 115
  });

  it('an item without basePrice gains one; existing basePrice is kept', () => {
    const [withBase] = applyMarkup([item({ price: 115, basePrice: 100 })], 10);
    expect(withBase.basePrice).toBe(100);
    expect(withBase.price).toBe(110);
    const src = item({ price: 80 });
    const [fresh] = applyMarkup([src], 25);
    expect(fresh.basePrice).toBe(80);
    expect(fresh.price).toBe(100);
    expect(src.price).toBe(80); // pure: input untouched
    expect(src.basePrice).toBeUndefined();
  });
});

describe('deriveBase (re-hydration: stored final price + markup_percent → base)', () => {
  it('recovers the pre-markup base from a final price', () => {
    expect(deriveBase(74.75, 15)).toBe(65);
    expect(deriveBase(120, 20)).toBe(100);
    expect(deriveBase(65, 0)).toBe(65); // pct 0 is identity
  });

  it('round-trips exactly: markup → save → re-hydrate → markup never drifts a cent', () => {
    const bases = [0.01, 4.5, 33.33, 65, 69.57, 99.99, 123.45, 1000];
    const pcts = [0, 5, 7.5, 10, 15, 20, 33, 50, 100];
    for (const base of bases) {
      for (const pct of pcts) {
        const [made] = applyMarkup([item({ price: base })], pct);
        // persistence keeps made.price (final) + pct; Edit derives the base back…
        expect(deriveBase(made.price, pct)).toBe(base);
        // …and a later stepper pass recomputes the SAME final from that derived base
        const [again] = applyMarkup([item({ price: made.price, basePrice: deriveBase(made.price, pct) })], pct);
        expect(again.price).toBe(made.price);
      }
    }
  });

  it('manual edit types the FINAL price; changing the markup recomputes from the derived base', () => {
    // user types $80 at 15% markup → base 69.57; stepper to 20% → 83.48 (from the base, not from 80)
    const base = deriveBase(80, 15);
    expect(base).toBe(69.57);
    const [out] = applyMarkup([item({ price: 80, basePrice: base })], 20);
    expect(out.price).toBe(83.48);
  });
});

describe('legacy margin fold (margin-on-top estimate opened in Edit)', () => {
  it('folding via applyMarkup preserves the legacy total when per-item rounding is clean', () => {
    const items = [item({ qty: 2, price: 100, taxable: true }), item({ id: 2, qty: 10, price: 50 })];
    const legacy = calcTotals(items, 8.25, 20); // old scheme: margin on top of sub+tax → 859.80
    const folded = calcTotals(applyMarkup(items, 20), 8.25, 0); // new scheme: embedded, margin 0
    expect(folded.total).toBeCloseTo(legacy.total, 8);
    expect(folded.margin).toBe(0);
  });

  it('per-item cent rounding drifts the total at most half a cent × total quantity', () => {
    const items = [item({ qty: 100, price: 33.33 })]; // 33.33 × 1.2 = 39.996 → 40.00/unit
    const legacy = calcTotals(items, 0, 20).total; // 3999.60
    const folded = calcTotals(applyMarkup(items, 20), 0, 0).total; // 4000.00
    expect(Math.abs(folded - legacy)).toBeLessThanOrEqual(0.005 * 100);
  });
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

describe('closedFromStatus (projects.status → lost/archived, orthogonal to the stage)', () => {
  it('maps Lost/Archived case-insensitively', () => {
    expect(closedFromStatus('Lost')).toBe('lost');
    expect(closedFromStatus('lost')).toBe('lost');
    expect(closedFromStatus('LOST')).toBe('lost');
    expect(closedFromStatus('Archived')).toBe('archived');
    expect(closedFromStatus('ARCHIVED')).toBe('archived');
  });

  it('any other status (v1 free-form values, Active, empty, null) reads as OPEN', () => {
    expect(closedFromStatus('In Progress')).toBeNull(); // legacy v1 status
    expect(closedFromStatus('Draft')).toBeNull();
    expect(closedFromStatus('Active')).toBeNull(); // reopened
    expect(closedFromStatus('')).toBeNull();
    expect(closedFromStatus(null)).toBeNull();
    expect(closedFromStatus(undefined)).toBeNull();
  });
});

describe('homeMetrics (dashboard numbers with lost/archived out of the pipeline)', () => {
  const j = (stage: Stage, value: number, closed?: ClosedKind | null) => ({ stage, value, closed });

  it('with NO closed jobs it reproduces the original HomeScreen inline math bit for bit', () => {
    const jobs = [j('Draft', 100), j('Quoted', 200), j('Sent', 300), j('Approved', 400), j('Invoiced', 500), j('Paid', 600)];
    // the exact expressions HomeScreen used before homeMetrics existed:
    const expected = {
      pipeline: jobs.filter((x) => ['Draft', 'Quoted', 'Sent', 'Approved'].includes(x.stage)).reduce((s, x) => s + x.value, 0),
      invoiced: jobs.filter((x) => x.stage === 'Invoiced').reduce((s, x) => s + x.value, 0),
      collected: jobs.filter((x) => x.stage === 'Paid').reduce((s, x) => s + x.value, 0),
      active: jobs.filter((x) => x.stage !== 'Paid').length,
      openQuotes: jobs.filter((x) => ['Quoted', 'Sent'].includes(x.stage)).length,
    };
    expect(homeMetrics(jobs)).toEqual(expected);
    expect(homeMetrics(jobs)).toEqual({ pipeline: 1000, invoiced: 500, collected: 600, active: 5, openQuotes: 2 });
    expect(homeMetrics([])).toEqual({ pipeline: 0, invoiced: 0, collected: 0, active: 0, openQuotes: 0 });
  });

  it('a lost job leaves the pipeline, the counters and the open quotes', () => {
    const m = homeMetrics([j('Quoted', 500, 'lost'), j('Quoted', 100)]);
    expect(m.pipeline).toBe(100);
    expect(m.openQuotes).toBe(1);
    expect(m.active).toBe(1);
  });

  it('archived+Paid still counts in collected (real money); lost+Paid does NOT', () => {
    const m = homeMetrics([j('Paid', 900, 'archived'), j('Paid', 50, 'lost'), j('Paid', 100)]);
    expect(m.collected).toBe(1000); // 900 archived + 100 open — the lost 50 is gone
    expect(m.active).toBe(0);
  });

  it('invoiced and openQuotes ignore closed jobs entirely', () => {
    const m = homeMetrics([j('Invoiced', 700, 'archived'), j('Sent', 200, 'lost'), j('Invoiced', 300)]);
    expect(m.invoiced).toBe(300);
    expect(m.openQuotes).toBe(0);
    expect(m.active).toBe(1); // only the open Invoiced job
  });

  it('closed: null / undefined both mean open (fetchJobs maps unknown statuses to null)', () => {
    expect(homeMetrics([j('Quoted', 100, null)])).toEqual(homeMetrics([j('Quoted', 100)]));
  });
});
