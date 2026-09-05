import { applyMarkup, balanceAfterPayment, buildStarterEstimate, calcTotals, closedFromStatus, deriveBase, deriveStage, discountFromTarget, homeMetrics, invoiceRollup, jobMatchesQuery, jobSiteLine, needsPhaseSync, NO_DISCOUNT, parseMoney, parsePercent, phaseNameFromItem, resolveDiscount, round2, seedPhasePlan, splitChangeOrder, syncPhasePlan, toggleDocPhoto, uninvoiced } from '../../data';
import type { ClosedKind, Job, LineItem, SyncPhase } from '../../data';
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

describe('jobSiteLine (G5: one-line work address for documents)', () => {
  it('joins address, city, zip in the contract {{service_address}} order', () => {
    expect(jobSiteLine({ address: '123 Main St', city: 'Miami, FL', zip: '33101' })).toBe('123 Main St, Miami, FL, 33101');
  });

  it('skips empty / null / whitespace-only parts', () => {
    expect(jobSiteLine({ address: '123 Main St', city: '', zip: null })).toBe('123 Main St');
    expect(jobSiteLine({ address: '  ', city: 'Austin, TX', zip: undefined })).toBe('Austin, TX');
  });

  it('empty for a missing site or a site with nothing filled', () => {
    expect(jobSiteLine(null)).toBe('');
    expect(jobSiteLine(undefined)).toBe('');
    expect(jobSiteLine({ address: '', city: '', zip: '' })).toBe('');
  });
});

describe('balanceAfterPayment (G3: the "Remaining balance" a receipt prints)', () => {
  const ledger = [
    { id: 'p1', amount: 500 },
    { id: 'p2', amount: 100 },
    { id: 'p3', amount: 340.9 },
  ];

  it('sums the ledger only up to and including the receipt\'s payment', () => {
    expect(balanceAfterPayment(940.9, ledger, 'p1')).toBe(440.9);
    expect(balanceAfterPayment(940.9, ledger, 'p2')).toBe(340.9);
    expect(balanceAfterPayment(940.9, ledger, 'p3')).toBe(0); // paid in full
  });

  it('an unknown id falls back to the CURRENT balance (whole ledger)', () => {
    expect(balanceAfterPayment(1000, ledger, 'nope')).toBe(59.1);
  });

  it('never goes negative (overpayment / legacy-paid edge)', () => {
    expect(balanceAfterPayment(400, ledger, 'p2')).toBe(0);
  });

  it('cent-exact under float dust', () => {
    expect(balanceAfterPayment(0.3, [{ id: 'a', amount: 0.1 }, { id: 'b', amount: 0.2 }], 'a')).toBe(0.2);
  });
});

describe('toggleDocPhoto (G2: curated photos that print on the quote)', () => {
  const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('selects and deselects, keeping the photo-strip order', () => {
    expect(toggleDocPhoto([], all, 'c')).toEqual(['c']);
    expect(toggleDocPhoto(['c'], all, 'a')).toEqual(['a', 'c']); // strip order, not tap order
    expect(toggleDocPhoto(['a', 'c'], all, 'c')).toEqual(['a']);
  });

  it('refuses to grow past the cap (null = no-op tap), but always allows deselecting', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(toggleDocPhoto(six, all, 'g')).toBeNull();
    expect(toggleDocPhoto(six, all, 'f')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('rejects a url that is not a project photo and drops stale selections', () => {
    expect(toggleDocPhoto([], all, 'nope')).toBeNull();
    // 'gone' no longer exists in the project — silently dropped from the result
    expect(toggleDocPhoto(['gone', 'b'], all, 'a')).toEqual(['a', 'b']);
  });

  it('honors a custom cap', () => {
    expect(toggleDocPhoto(['a'], all, 'b', 1)).toBeNull();
    expect(toggleDocPhoto([], all, 'b', 1)).toEqual(['b']);
  });
});

describe('phases from the quote (G4: seed / sync pure planning)', () => {
  const ph = (over: Partial<SyncPhase> & { id: string; name: string }): SyncPhase => ({
    autoSeeded: true, status: 'not_started', hasContent: false, ...over,
  });

  describe('phaseNameFromItem', () => {
    it('trims, collapses whitespace and falls back to "Phase"', () => {
      expect(phaseNameFromItem('  Tear-off   &  disposal ')).toBe('Tear-off & disposal');
      expect(phaseNameFromItem('')).toBe('Phase');
      expect(phaseNameFromItem('   ')).toBe('Phase');
    });

    it('truncates at ~80 chars with an ellipsis', () => {
      const long = 'x'.repeat(120);
      const out = phaseNameFromItem(long);
      expect(out.length).toBe(80);
      expect(out.endsWith('…')).toBe(true);
      expect(phaseNameFromItem('x'.repeat(80)).endsWith('…')).toBe(false); // exactly 80 fits
    });
  });

  describe('seedPhasePlan', () => {
    it('one phase per item, in item order', () => {
      expect(seedPhasePlan([{ desc: 'Demo' }, { desc: 'Paint' }])).toEqual([
        { name: 'Demo', order: 0 },
        { name: 'Paint', order: 1 },
      ]);
    });

    it('dedupes duplicate names with " (2)", " (3)"…', () => {
      expect(seedPhasePlan([{ desc: 'Paint' }, { desc: 'Paint' }, { desc: 'Paint' }]).map((p) => p.name)).toEqual(['Paint', 'Paint (2)', 'Paint (3)']);
    });

    it('never collides with an item literally NAMED like a dedupe suffix', () => {
      // reviewer finding: ['Paint','Paint','Paint (2)'] used to yield two "Paint (2)" phases
      const names = seedPhasePlan([{ desc: 'Paint' }, { desc: 'Paint' }, { desc: 'Paint (2)' }]).map((p) => p.name);
      expect(new Set(names).size).toBe(names.length); // all unique — name-keyed sync stays 1:1
    });

    it('empty input → empty plan', () => {
      expect(seedPhasePlan([])).toEqual([]);
    });
  });

  describe('syncPhasePlan', () => {
    const items = [{ desc: 'Demo' }, { desc: 'Paint' }];

    it('removes an untouched auto-seeded phase whose item is gone; creates the missing one', () => {
      const plan = syncPhasePlan([ph({ id: '1', name: 'Demo' }), ph({ id: '2', name: 'Old work' })], items, 5);
      expect(plan.removeIds).toEqual(['2']);
      expect(plan.create).toEqual([{ name: 'Paint', order: 5 }]);
    });

    it('NEVER removes: manual phases, started phases, or phases with photos/comments', () => {
      const phases = [
        ph({ id: 'm', name: 'Manual thing', autoSeeded: false }),
        ph({ id: 's', name: 'Started', status: 'in_progress' }),
        ph({ id: 'c', name: 'Has photos', hasContent: true }),
      ];
      const plan = syncPhasePlan(phases, items, 0);
      expect(plan.removeIds).toEqual([]); // none of them, despite none matching an item
      expect(plan.create.map((c) => c.name)).toEqual(['Demo', 'Paint']);
    });

    it('an existing phase with the item name blocks the create — even a manual one', () => {
      const plan = syncPhasePlan([ph({ id: 'x', name: 'Paint', autoSeeded: false })], items, 0);
      expect(plan.create.map((c) => c.name)).toEqual(['Demo']);
    });

    it('in-sync = empty plan', () => {
      const plan = syncPhasePlan([ph({ id: '1', name: 'Demo' }), ph({ id: '2', name: 'Paint' })], items);
      expect(plan).toEqual({ removeIds: [], create: [] });
    });
  });

  describe('needsPhaseSync', () => {
    const items = [{ desc: 'Demo' }];

    it('false for a purely manual phase list, even when out of sync', () => {
      expect(needsPhaseSync([ph({ id: 'm', name: 'Other', autoSeeded: false })], items)).toBe(false);
    });

    it('true when the seeding drifted from the items (either direction)', () => {
      expect(needsPhaseSync([ph({ id: '1', name: 'Gone item' })], items)).toBe(true); // remove + create
      expect(needsPhaseSync([ph({ id: '1', name: 'Demo' })], [{ desc: 'Demo' }, { desc: 'New' }])).toBe(true); // create only
    });

    it('false when everything matches — and a protected drift with no real action stays quiet', () => {
      expect(needsPhaseSync([ph({ id: '1', name: 'Demo' })], items)).toBe(false);
      // started phase, item still present → nothing removable, nothing to create → no button
      expect(needsPhaseSync([ph({ id: '1', name: 'Demo', status: 'in_progress' })], items)).toBe(false);
    });
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

/* ---------------- G-1: discount (money — the DB trigger is the other half of this) ---------------- */
describe('resolveDiscount', () => {
  it('percent wins over a stale dollar amount and follows the subtotal', () => {
    expect(resolveDiscount(1000, { percent: 30, amount: 999 })).toBe(300);
    expect(resolveDiscount(2000, { percent: 30, amount: 999 })).toBe(600); // item changed → moves
  });
  it('percent 0 means the owner typed dollars', () => {
    expect(resolveDiscount(1000, { percent: 0, amount: 99 })).toBe(99);
  });
  it('never exceeds the subtotal and is never negative', () => {
    expect(resolveDiscount(500, { percent: 0, amount: 900 })).toBe(500);
    expect(resolveDiscount(500, { percent: 100, amount: 0 })).toBe(500);
    expect(resolveDiscount(500, { percent: 0, amount: -10 })).toBe(0);
    expect(resolveDiscount(0, { percent: 30, amount: 0 })).toBe(0);
  });
  it('no discount at all is zero', () => {
    expect(resolveDiscount(1000, null)).toBe(0);
    expect(resolveDiscount(1000, NO_DISCOUNT)).toBe(0);
  });
});

describe('calcTotals with a discount', () => {
  // the numbers below are the ones PROVED against the production trigger (rollback test 24/08):
  // subtotal 6919.78 · taxable base 2261.20 · tax 7%
  const mixed: LineItem[] = [
    item({ qty: 1, price: 2261.2, taxable: true }),
    item({ qty: 1, price: 4658.58, taxable: false }),
  ];
  it('matches the DB trigger for a 30% discount', () => {
    const t = calcTotals(mixed, 7, 0, resolveDiscount(6919.78, { percent: 30, amount: 0 }));
    expect(t.discount).toBe(2075.93);
    expect(t.tax).toBe(110.8);
    expect(t.total).toBe(4954.65);
  });
  it('matches the DB trigger for a $1000 discount', () => {
    const t = calcTotals(mixed, 7, 0, resolveDiscount(6919.78, { percent: 0, amount: 1000 }));
    expect(t.tax).toBe(135.41);
    expect(t.total).toBe(6055.19);
  });
  it('a full discount zeroes the quote instead of going negative', () => {
    const t = calcTotals(mixed, 7, 0, resolveDiscount(6919.78, { percent: 100, amount: 0 }));
    expect(t.discount).toBe(6919.78);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(0);
  });
  it('taxes only the discounted share of the taxable base', () => {
    // everything taxable, 10% off → tax drops by exactly 10%
    const all: LineItem[] = [item({ qty: 1, price: 1000, taxable: true })];
    const t = calcTotals(all, 10, 0, 100);
    expect(t.tax).toBe(90);
    expect(t.total).toBe(990);
  });
  it('zero discount leaves the legacy numbers untouched', () => {
    const withZero = calcTotals(mixed, 7, 0, 0);
    const legacy = calcTotals(mixed, 7, 0);
    expect(withZero.total).toBe(legacy.total);
    expect(withZero.discount).toBe(0);
  });
});

describe('discountFromTarget ("deu 1.099, quer deixar 1.000 redondo")', () => {
  const mixed: LineItem[] = [
    item({ qty: 1, price: 2261.2, taxable: true }),
    item({ qty: 1, price: 4658.58, taxable: false }),
  ];
  it('lands exactly on the round number the owner typed', () => {
    const d = discountFromTarget(6919.78, 2261.2, 7, 6500);
    expect(calcTotals(mixed, 7, 0, d).total).toBe(6500);
  });
  it('works with no tax at all', () => {
    const plain: LineItem[] = [item({ qty: 1, price: 1099, taxable: false })];
    const d = discountFromTarget(1099, 0, 0, 1000);
    expect(d).toBe(99);
    expect(calcTotals(plain, 0, 0, d).total).toBe(1000);
  });
  it('a target above the total asks for no discount', () => {
    expect(discountFromTarget(1000, 0, 0, 5000)).toBe(0);
  });
  it('a target of zero clamps at the subtotal', () => {
    expect(discountFromTarget(1000, 0, 0, 0)).toBe(1000);
  });
  it('an empty quote cannot be targeted', () => {
    expect(discountFromTarget(0, 0, 7, 100)).toBe(0);
  });
});

/* ---------------- G-9: more than one invoice on the same job ---------------- */
describe('invoiceRollup', () => {
  it('adds up every invoice on the job', () => {
    const r = invoiceRollup([{ total: 8000, amountPaid: 8000 }, { total: 2400, amountPaid: 0 }]);
    expect(r.total).toBe(10400);
    expect(r.paid).toBe(8000);
    expect(r.balance).toBe(2400);
    expect(r.status).toBe('Partially Paid');
  });
  it('is Paid only when every dollar landed', () => {
    expect(invoiceRollup([{ total: 8000, amountPaid: 8000 }, { total: 2400, amountPaid: 2400 }]).status).toBe('Paid');
  });
  it('a paid first invoice plus a fresh second one is NOT Paid', () => {
    // the whole point: a complementary invoice pulls the job back to "still owes money"
    const r = invoiceRollup([{ total: 500, amountPaid: 500 }, { total: 100, amountPaid: 0 }]);
    expect(r.status).toBe('Partially Paid');
    expect(r.balance).toBe(100);
  });
  it('no invoices is an empty roll-up, not a paid job', () => {
    const r = invoiceRollup([]);
    expect(r.count).toBe(0);
    expect(r.total).toBe(0);
    expect(r.status).toBe('Unpaid');
  });
  it('overpayment never makes the balance negative', () => {
    expect(invoiceRollup([{ total: 100, amountPaid: 150 }]).balance).toBe(0);
  });
  it('keeps cents honest across many invoices', () => {
    const r = invoiceRollup([{ total: 0.1, amountPaid: 0 }, { total: 0.2, amountPaid: 0 }]);
    expect(r.total).toBe(0.3);
  });
});

describe('uninvoiced (what a complementary invoice starts at)', () => {
  it('is the part of the quote not yet billed', () => {
    expect(uninvoiced(10400, 8000)).toBe(2400);
  });
  it('is zero when everything is already billed', () => {
    expect(uninvoiced(8000, 8000)).toBe(0);
  });
  it('never goes negative when the quote shrank below what was billed', () => {
    expect(uninvoiced(5000, 8000)).toBe(0);
  });
});

describe('splitChangeOrder (a fatura complementar tem que fechar a própria conta)', () => {
  it('as partes reconstroem o valor e a linha de imposto é verdadeira', () => {
    // orçamento: subtotal 10.000 (2.000 tributável), imposto 7% → o cliente deve $2.400 a mais
    const s = splitChangeOrder(2400, 10000, 2000, 7);
    expect(s.total).toBe(2400);
    expect(round2(s.subtotal + s.tax)).toBe(2400);
    // a base que o app IMPRIME é derivada do imposto congelado (nada guarda a base), então é ela
    // que precisa fechar com a alíquota impressa — senão o PDF diz "7% de X" e o número é outro
    const baseImpressa = round2(s.tax / 0.07);
    expect(round2(baseImpressa * 0.07)).toBe(s.tax);
  });
  it('orçamento todo tributável cobra a alíquota cheia', () => {
    const s = splitChangeOrder(1070, 1000, 1000, 7);
    expect(s.subtotal).toBe(1000);
    expect(s.tax).toBe(70);
  });
  it('orçamento sem imposto gera complementar sem imposto', () => {
    const s = splitChangeOrder(1000, 5000, 0, 7);
    expect(s.tax).toBe(0);
    expect(s.subtotal).toBe(1000);
  });
  it('orçamento vazio não dita proporção nenhuma', () => {
    const s = splitChangeOrder(500, 0, 0, 7);
    expect(s.subtotal).toBe(500);
    expect(s.tax).toBe(0);
  });
  it('valor zero ou negativo não vira fatura', () => {
    expect(splitChangeOrder(0, 1000, 1000, 7).total).toBe(0);
    expect(splitChangeOrder(-5, 1000, 1000, 7).total).toBe(0);
  });
});

describe('parseMoney (o campo de total final aceita vírgula E ponto)', () => {
  it('reads the en convention', () => {
    expect(parseMoney('1,000.50')).toBe(1000.5);
    expect(parseMoney('1000.50')).toBe(1000.5);
  });
  it('reads the pt/es convention — the bug that turned $1.098 into $1.00', () => {
    expect(parseMoney('1.000,50')).toBe(1000.5);
    expect(parseMoney('1.000')).toBe(1000);
    expect(parseMoney('1.000.000')).toBe(1000000);
  });
  it('a lone separator with three digits after it is thousands, not cents', () => {
    expect(parseMoney('1,000')).toBe(1000);
  });
  it('keeps one and two decimals', () => {
    expect(parseMoney('1000,5')).toBe(1000.5);
    expect(parseMoney('999,99')).toBe(999.99);
  });
  it('strips currency noise', () => {
    expect(parseMoney('$ 1,099.00')).toBe(1099);
  });
  it('is null when there is no number', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('$')).toBeNull();
  });
});

describe('resolveDiscount arredonda como o Postgres, não como o float', () => {
  it('o empate de meio centavo sobe, igual ao numeric(12,2) do banco', () => {
    // caso real achado na revisão: subtotal 8746.71 a 50% dava 4373.35 na tela e 4373.36 no banco,
    // e as quatro linhas do PDF do cliente deixavam de fechar
    expect(resolveDiscount(8746.71, { percent: 50, amount: 0 })).toBe(4373.36);
  });
  it('segue batendo nos percentuais redondos', () => {
    expect(resolveDiscount(1000, { percent: 30, amount: 0 })).toBe(300);
    expect(resolveDiscount(6919.78, { percent: 30, amount: 0 })).toBe(2075.93);
  });
});

describe('parsePercent (percentual não é dinheiro)', () => {
  it('não confunde separador de milhar com decimal — o erro que parseMoney cometeria', () => {
    expect(parsePercent('12.567')).toBe(12.6); // parseMoney daria 12567
    expect(parsePercent('0.005')).toBe(0); // parseMoney daria 5
  });
  it('aceita vírgula e ponto', () => {
    expect(parsePercent('12,5')).toBe(12.5);
    expect(parsePercent('12.5')).toBe(12.5);
  });
  it('guarda meio ponto e descarta o resto', () => {
    expect(parsePercent('12')).toBe(12);
    expect(parsePercent('12.55')).toBe(12.6);
  });
  it('é null quando não há número', () => {
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('%')).toBeNull();
  });
});

describe('jobMatchesQuery (achar o job pelo número do cheque)', () => {
  const job = (over: Partial<Job> = {}): Job => ({
    id: 'j1',
    client: 'WL General Services',
    addr: '1017 Hansen St West Palm Beach, fl 33405',
    title: 'Drywall repair',
    stage: 'Invoiced' as Stage,
    value: 14947.01,
    photos: 1,
    date: 'Sep 3',
    docNumbers: ['INV-2026-0040', 'EST-099'],
    docLabel: 'INV-2026-0040',
    ...over,
  });

  it('mantém a busca por nome, endereço e título', () => {
    expect(jobMatchesQuery(job(), 'wl')).toBe(true);
    expect(jobMatchesQuery(job(), 'hansen')).toBe(true);
    expect(jobMatchesQuery(job(), 'drywall')).toBe(true);
    expect(jobMatchesQuery(job(), 'cornerstone')).toBe(false);
  });

  it('acha pelo número puro da fatura, com ou sem os zeros', () => {
    expect(jobMatchesQuery(job(), '40')).toBe(true);
    expect(jobMatchesQuery(job(), '0040')).toBe(true);
    expect(jobMatchesQuery(job(), '41')).toBe(false);
  });

  it('acha pelo número da cotação', () => {
    expect(jobMatchesQuery(job(), '99')).toBe(true);
  });

  it('NÃO casa com o ano de dentro do número — senão tudo apareceria', () => {
    expect(jobMatchesQuery(job(), '2026')).toBe(false);
  });

  it('aceita o número escrito por extenso, do jeito que vem no cheque', () => {
    expect(jobMatchesQuery(job(), 'INV-2026-0040')).toBe(true);
    expect(jobMatchesQuery(job(), 'inv 2026 0040')).toBe(true);
    expect(jobMatchesQuery(job(), 'est-099')).toBe(true);
    expect(jobMatchesQuery(job(), 'INV-2026-0041')).toBe(false);
  });

  it('o número da rua continua ganhando do número do documento', () => {
    expect(jobMatchesQuery(job(), '1017')).toBe(true);
  });

  it('job sem documento nenhum não quebra a busca por número', () => {
    const draft = job({ docNumbers: [], docLabel: null, addr: 'Rivercrest Apts, Apt 202' });
    expect(jobMatchesQuery(draft, '40')).toBe(false);
    expect(jobMatchesQuery(draft, 'wl')).toBe(true);
  });

  // comportamento ANTIGO preservado de propósito: o texto casa por pedaço, então "40" também traz
  // quem tem 40 no CEP/endereço. É ruído conhecido — o número do documento agora aparece no card,
  // que é o que deixa o contratante identificar o certo sem abrir um por um.
  it('o texto continua casando por pedaço (sem regressão na busca antiga)', () => {
    expect(jobMatchesQuery(job({ docNumbers: [], docLabel: null }), '40')).toBe(true); // 33405
  });

  it('busca vazia devolve tudo', () => {
    expect(jobMatchesQuery(job(), '')).toBe(true);
    expect(jobMatchesQuery(job(), '   ')).toBe(true);
  });
});
