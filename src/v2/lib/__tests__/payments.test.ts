import {
  addDaysISO,
  applyCreditToRows,
  round2,
  balanceAfterNewPayment,
  creditTotalUpTo,
  balanceAfterPayment,
  creditRoom,
  creditTotal,
  invoiceDue,
  invoiceRollup,
  overbilled,
  pickCreditTarget,
  uninvoiced,
  daysFromToday,
  deriveStage,
  invoiceBalance,
  paidTotal,
  parseDateOnly,
  planFromInvoice,
  planRows,
  rescaleSchedule,
  resizeDraftRows,
  splitInstallments,
  statusFromPayments,
  toDateOnly,
  unallocated,
} from '../../data';
import type { PaymentPlan, ScheduleRow } from '../../data';

const row = (over: Partial<ScheduleRow> = {}): ScheduleRow => ({
  label: 'Payment 1', amount: 100, dueDate: '2026-08-01', sort: 0, ...over,
});
const plan = (over: Partial<PaymentPlan> = {}): PaymentPlan => ({
  mode: 'full', dueDate: '2026-07-22', depositPercent: null, depositAmount: 0, installments: [], ...over,
});

describe('splitInstallments (portions of the TOTAL — tax already inside, never re-taxed)', () => {
  it('puts the leftover cents on the LAST part so the sum is exact', () => {
    expect(splitInstallments(1000, 3)).toEqual([333.33, 333.33, 333.34]);
    expect(splitInstallments(100.01, 2)).toEqual([50, 50.01]);
  });

  it('splits evenly when the total divides cleanly', () => {
    expect(splitInstallments(900, 3)).toEqual([300, 300, 300]);
    expect(splitInstallments(999.99, 3)).toEqual([333.33, 333.33, 333.33]);
  });

  it('always sums EXACTLY to the total (cent arithmetic, no float dust)', () => {
    for (const total of [0.01, 10, 100.01, 333.33, 1000, 12345.67]) {
      for (let n = 2; n <= 12; n++) {
        const parts = splitInstallments(total, n);
        expect(parts).toHaveLength(n);
        expect(Math.round(parts.reduce((s, p) => s + p, 0) * 100)).toBe(Math.round(total * 100));
      }
    }
  });

  it('guards: n <= 1 (or garbage) → single part; total 0 → zeros', () => {
    expect(splitInstallments(1000, 1)).toEqual([1000]);
    expect(splitInstallments(1000, 0)).toEqual([1000]);
    expect(splitInstallments(1000, -3)).toEqual([1000]);
    expect(splitInstallments(1000, NaN)).toEqual([1000]);
    expect(splitInstallments(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('planRows (English labels by design — they feed the PDF and the contract)', () => {
  it('full → one row with the plan due date', () => {
    expect(planRows(plan(), 500)).toEqual([{ label: 'Full payment', amount: 500, dueDate: '2026-07-22' }]);
  });

  it('deposit entered as % → Deposit (due) + Balance (upon completion), amounts exact', () => {
    const p = plan({ mode: 'deposit', dueDate: '2026-07-07', depositPercent: 25, depositAmount: 250 });
    expect(planRows(p, 1000)).toEqual([
      { label: 'Deposit', amount: 250, dueDate: '2026-07-07' },
      { label: 'Balance', amount: 750, dueDate: null },
    ]);
  });

  it('deposit entered as an absolute $ (percent null) works the same', () => {
    const p = plan({ mode: 'deposit', dueDate: '2026-07-07', depositPercent: null, depositAmount: 300 });
    expect(planRows(p, 1000.01)).toEqual([
      { label: 'Deposit', amount: 300, dueDate: '2026-07-07' },
      { label: 'Balance', amount: 700.01, dueDate: null },
    ]);
  });

  it('deposit 0 collapses to a single row; a too-big deposit is clamped to the total', () => {
    expect(planRows(plan({ mode: 'deposit', depositAmount: 0 }), 800)).toEqual([
      { label: 'Full payment', amount: 800, dueDate: null },
    ]);
    const clamped = planRows(plan({ mode: 'deposit', dueDate: '2026-07-07', depositAmount: 900 }), 500);
    expect(clamped[0].amount).toBe(500);
    expect(clamped[1].amount).toBe(0);
  });

  it('installments echo the schedule ORDERED BY sort', () => {
    const p = plan({
      mode: 'installments',
      installments: [
        row({ label: 'Payment 3', amount: 200, dueDate: '2026-10-01', sort: 2 }),
        row({ label: 'Payment 1', amount: 500, dueDate: '2026-08-01', sort: 0 }),
        row({ label: 'Payment 2', amount: 300, dueDate: '2026-09-01', sort: 1 }),
      ],
    });
    expect(planRows(p, 1000).map((r) => r.label)).toEqual(['Payment 1', 'Payment 2', 'Payment 3']);
    expect(planRows(p, 1000).map((r) => r.amount)).toEqual([500, 300, 200]);
  });

  it('installments with an EMPTY schedule fall back to one full row (failed insert safety net)', () => {
    expect(planRows(plan({ mode: 'installments', dueDate: null }), 750)).toEqual([
      { label: 'Full payment', amount: 750, dueDate: null },
    ]);
  });
});

describe('unallocated (installments editor indicator)', () => {
  it('0 when the rows cover the total; positive when short; negative when over', () => {
    expect(unallocated(1000, [{ amount: 333.33 }, { amount: 333.33 }, { amount: 333.34 }])).toBe(0);
    expect(unallocated(1000, [{ amount: 500 }, { amount: 499.99 }])).toBe(0.01);
    expect(unallocated(1000, [{ amount: 600 }, { amount: 500 }])).toBe(-100);
    expect(unallocated(100, [])).toBe(100);
  });
});

describe('paidTotal / invoiceBalance / statusFromPayments (ledger math)', () => {
  it('sums the ledger without float dust and floors the balance at 0 on overpay', () => {
    expect(paidTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(invoiceBalance(100, 30)).toBe(70);
    expect(invoiceBalance(100, 150)).toBe(0);
  });

  it('nothing recorded → Unpaid (even for a $0 total)', () => {
    expect(statusFromPayments(100, 0)).toBe('Unpaid');
    expect(statusFromPayments(0, 0)).toBe('Unpaid');
  });

  it('partial → Partially Paid; a whole cent short is still partial', () => {
    expect(statusFromPayments(100, 50)).toBe('Partially Paid');
    expect(statusFromPayments(100, 99.99)).toBe('Partially Paid');
  });

  it('half-cent epsilon: total − 0.004 counts as Paid; overpay is Paid', () => {
    expect(statusFromPayments(100, 99.996)).toBe('Paid');
    expect(statusFromPayments(100, 100)).toBe('Paid');
    expect(statusFromPayments(100, 150)).toBe('Paid');
  });
});

describe('rescaleSchedule (quote edited after invoicing, no payments yet)', () => {
  it('scales proportionally and keeps the sum exact (last row absorbs rounding)', () => {
    const rows = [row({ amount: 600, sort: 0 }), row({ label: 'Payment 2', amount: 400, sort: 1 })];
    const out = rescaleSchedule(rows, 1000, 500);
    expect(out.map((r) => r.amount)).toEqual([300, 200]);

    const thirds = [row({ amount: 333.33, sort: 0 }), row({ amount: 333.33, sort: 1 }), row({ amount: 333.34, sort: 2 })];
    const scaled = rescaleSchedule(thirds, 1000, 2000.01);
    expect(Math.round(scaled.reduce((s, r) => s + r.amount, 0) * 100)).toBe(200001);
    expect(scaled[0].amount).toBeCloseTo(666.66, 2);
  });

  it('preserves everything except the amounts (labels, dates, ids, sort)', () => {
    const src = [row({ id: 'a', label: 'Payment 1', dueDate: '2026-08-01', phaseId: 'ph1', sort: 0, amount: 100 })];
    const [out] = rescaleSchedule(src, 100, 200);
    expect(out).toEqual({ id: 'a', label: 'Payment 1', dueDate: '2026-08-01', phaseId: 'ph1', sort: 0, amount: 200 });
    expect(src[0].amount).toBe(100); // pure: input untouched
  });

  it('guards: empty rows → []; degenerate old total → even split that still sums exactly', () => {
    expect(rescaleSchedule([], 100, 200)).toEqual([]);
    const out = rescaleSchedule([row({ amount: 0, sort: 0 }), row({ label: 'Payment 2', amount: 0, sort: 1 })], 0, 100.01);
    expect(out.map((r) => r.amount)).toEqual([50, 50.01]);
  });
});

describe('date-only helpers (no UTC shift — the classic new Date("YYYY-MM-DD") bug)', () => {
  it('round-trips a date-only string in ANY timezone', () => {
    expect(toDateOnly(parseDateOnly('2026-07-07'))).toBe('2026-07-07');
    expect(toDateOnly(parseDateOnly('2026-01-01'))).toBe('2026-01-01'); // would be Dec 31 with new Date(string) in UTC− zones
    const d = parseDateOnly('2026-07-07');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 7]); // local parts, not UTC
  });

  it('addDaysISO: +15 from 2026-07-07 is 2026-07-22; month and year roll over', () => {
    expect(addDaysISO(15, '2026-07-07')).toBe('2026-07-22');
    expect(addDaysISO(0, '2026-07-07')).toBe('2026-07-07');
    expect(addDaysISO(1, '2026-01-31')).toBe('2026-02-01');
    expect(addDaysISO(30, '2026-12-15')).toBe('2027-01-14');
    expect(addDaysISO(1, '2028-02-28')).toBe('2028-02-29'); // leap year
  });
});

describe('planFromInvoice (stored invoice → plan)', () => {
  it('resolves a legacy %-only deposit (deposit_amount null) against the frozen total', () => {
    const p = planFromInvoice({ paymentMode: 'deposit', dueDate: '2026-07-22', depositPercent: 30, depositAmount: null, total: 1000, schedule: [] });
    expect(p.depositAmount).toBe(300);
    expect(p.depositPercent).toBe(30);
    expect(p.mode).toBe('deposit');
  });

  it('prefers the materialized deposit_amount when present and carries the schedule through', () => {
    const sched = [row()];
    const p = planFromInvoice({ paymentMode: 'installments', dueDate: null, depositPercent: null, depositAmount: 123.45, total: 1000, schedule: sched });
    expect(p.depositAmount).toBe(123.45);
    expect(p.installments).toBe(sched);
  });
});

describe('daysFromToday (re-editing a stored plan; NEGATIVE = overdue, never clamped)', () => {
  const today = new Date(2026, 6, 7); // 2026-07-07 local

  it('future / today / past / null (15-day default)', () => {
    expect(daysFromToday('2026-07-22', today)).toBe(15);
    expect(daysFromToday('2026-07-07', today)).toBe(0);
    expect(daysFromToday('2026-07-01', today)).toBe(-6); // overdue keeps its real date on re-save
    expect(daysFromToday(null, today)).toBe(15);
  });

  it('rolls over months/years and ignores the time of day of `today`', () => {
    expect(daysFromToday('2026-08-06', today)).toBe(30);
    expect(daysFromToday('2025-07-07', today)).toBe(-365);
    expect(daysFromToday('2026-07-08', new Date(2026, 6, 7, 23, 59, 59))).toBe(1); // whole days, not 86400s windows
  });
});

describe('resizeDraftRows (N× stepper on hand-edited rows: preserve, never re-split)', () => {
  const rows = [
    { label: 'Payment 1', amount: 700, days: 10 },
    { label: 'Payment 2', amount: 200, days: 40 },
  ];

  it('growing appends a row that soaks up the unallocated remainder, due 30 days after the last', () => {
    const out = resizeDraftRows(rows, 3, 1000);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(rows[0]); // edits preserved untouched
    expect(out[1]).toEqual(rows[1]);
    expect(out[2]).toEqual({ label: 'Payment 3', amount: 100, days: 70 });
  });

  it('growing by several appends sequentially (each soaks what is left; then $0)', () => {
    const out = resizeDraftRows([{ label: 'Payment 1', amount: 100, days: 15 }], 3, 400);
    expect(out.map((r) => r.amount)).toEqual([100, 300, 0]);
    expect(out.map((r) => r.days)).toEqual([15, 45, 75]);
    expect(out.map((r) => r.label)).toEqual(['Payment 1', 'Payment 2', 'Payment 3']);
  });

  it('an over-allocated plan appends $0 rows — never a negative amount', () => {
    const out = resizeDraftRows([{ label: 'Payment 1', amount: 1200, days: 15 }], 2, 1000);
    expect(out[1].amount).toBe(0);
  });

  it('growing a FULLY allocated stored plan appends a $0 row (the sheet blocks saving until it is filled)', () => {
    // the most common grow in production: a saved 2×$500 plan → "+" must not steal from agreed rows
    const stored = [{ label: 'Payment 1', amount: 500, days: 0 }, { label: 'Payment 2', amount: 500, days: 30 }];
    const out = resizeDraftRows(stored, 3, 1000);
    expect(out[0]).toEqual(stored[0]);
    expect(out[1]).toEqual(stored[1]);
    expect(out[2]).toEqual({ label: 'Payment 3', amount: 0, days: 60 });
  });

  it('shrinking drops from the END and keeps the rest untouched', () => {
    expect(resizeDraftRows(rows, 1, 1000)).toEqual([rows[0]]);
    expect(resizeDraftRows(rows, 2, 1000)).toEqual(rows); // same size = no-op copy
  });

  it('is pure: the input rows are never mutated', () => {
    const src = [{ label: 'Payment 1', amount: 700, days: 10 }];
    resizeDraftRows(src, 3, 1000);
    expect(src).toEqual([{ label: 'Payment 1', amount: 700, days: 10 }]);
  });
});

describe('deriveStage × partial payments (regression)', () => {
  it('a Partially Paid invoice is Invoiced — NOT Paid', () => {
    expect(deriveStage('Approved', 'Partially Paid')).toBe('Invoiced');
    expect(deriveStage('Approved', 'partially paid')).toBe('Invoiced');
  });

  it('only a fully paid invoice reaches Paid', () => {
    expect(deriveStage('Approved', 'Paid')).toBe('Paid');
  });
});

describe('pagamento com data escolhida (cheque pré-datado / recebido ontem)', () => {
  // o banco devolve o ledger ordenado por paid_at, então um pagamento lançado hoje com data de
  // ONTEM entra ANTES do que já estava — e o "saldo após" de cada recibo segue a cronologia
  it('o saldo por pagamento segue a data, não a ordem em que foi digitado', () => {
    const total = 1000;
    // digitado primeiro: $400 hoje. Depois lançado $600 com data de ontem → vem antes na lista.
    const ledger = [
      { id: 'ontem', amount: 600 },
      { id: 'hoje', amount: 400 },
    ];
    expect(balanceAfterPayment(total, ledger, 'ontem')).toBe(400);
    expect(balanceAfterPayment(total, ledger, 'hoje')).toBe(0);
  });

  it('o total recebido não depende da ordem', () => {
    expect(paidTotal([{ amount: 600 }, { amount: 400 }])).toBe(paidTotal([{ amount: 400 }, { amount: 600 }]));
  });

  it('data escolhida é date-only: não escorrega um dia por fuso', () => {
    // o cheque datado de 12/09 tem que continuar 12/09 na Flórida (UTC-4), não 11/09
    expect(toDateOnly(parseDateOnly('2026-09-12'))).toBe('2026-09-12');
    expect(parseDateOnly('2026-09-12').getDate()).toBe(12);
  });
});

describe('créditos na fatura (devolveu material depois de faturado)', () => {
  // caso real do dono (05/09): fatura de $580.55, 3 detectores. Só 2 couberam, 1 voltou (~$40),
  // e o cliente já tinha pago metade ($290.27) por Zelle.
  const TOTAL = 580.55;
  const PAGO = 290.27;

  it('o crédito reduz o que é devido, sem mexer no que foi faturado', () => {
    expect(invoiceDue(TOTAL, 40)).toBe(540.55);
    expect(invoiceBalance(invoiceDue(TOTAL, 40), PAGO)).toBe(250.28);
  });

  it('o crédito pode fechar a fatura sozinho quando o cliente já pagou o valor reduzido', () => {
    const pago = 540.55;
    expect(statusFromPayments(invoiceDue(TOTAL, 40), pago)).toBe('Paid');
    // sem o crédito, a mesma fatura ficaria eternamente parcial
    expect(statusFromPayments(TOTAL, pago)).toBe('Partially Paid');
  });

  it('creditRoom nunca deixa creditar além do saldo em aberto (não existe reembolso)', () => {
    expect(creditRoom(TOTAL, 0, PAGO)).toBe(290.28);
    expect(creditRoom(TOTAL, 40, PAGO)).toBe(250.28);
    // cliente já pagou tudo: não cabe crédito nenhum
    expect(creditRoom(TOTAL, 0, TOTAL)).toBe(0);
    // e nunca fica negativo
    expect(creditRoom(TOTAL, 600, PAGO)).toBe(0);
  });

  it('overbilled é o espelho de uninvoiced', () => {
    // orçamento caiu para 540.55 e já havia 580.55 faturado → 40 de crédito
    expect(overbilled(540.55, 580.55)).toBe(40);
    expect(uninvoiced(540.55, 580.55)).toBe(0); // nada novo a cobrar
    // e no sentido oposto, quem manda é o uninvoiced
    expect(uninvoiced(700, 580.55)).toBe(119.45);
    expect(overbilled(700, 580.55)).toBe(0);
  });

  it('creditTotal soma os créditos', () => {
    expect(creditTotal([{ amount: 40 }, { amount: 10.5 }])).toBe(50.5);
    expect(creditTotal([])).toBe(0);
  });

  it('o roll-up do job desconta os créditos (o job não vale o que foi estornado)', () => {
    const r = invoiceRollup([
      { total: TOTAL, amountPaid: PAGO, creditTotal: 40 },
      { total: 200, amountPaid: 0 },
    ]);
    expect(r.total).toBe(740.55); // 540.55 + 200
    expect(r.paid).toBe(PAGO);
    expect(r.balance).toBe(450.28);
  });
});

describe('recibo de fatura com crédito (achado BLOQUEANTE do revisor)', () => {
  // 580,55 faturados, 40 creditados (detector devolvido) → devidos 540,55.
  // Cliente pagou 290,27 e depois 250,28 = quitado.
  const DUE = invoiceDue(580.55, 40);
  const ledger = [
    { id: 'p1', amount: 290.27, paidAt: '2026-09-03' },
    { id: 'p2', amount: 250.28, paidAt: '2026-09-06' },
  ];

  it('o recibo do pagamento que fecha a fatura diz saldo ZERO', () => {
    expect(balanceAfterPayment(DUE, ledger, 'p2')).toBe(0);
    // sem descontar o crédito, o mesmo recibo imprimiria "faltam $40" numa fatura quitada
    expect(balanceAfterPayment(580.55, ledger, 'p2')).toBe(40);
  });

  it('o recibo do primeiro pagamento mostra o saldo já com o crédito aplicado', () => {
    expect(balanceAfterPayment(DUE, ledger, 'p1')).toBe(250.28);
  });

  it('e o recibo imediato (mesmo número) chega no mesmo valor', () => {
    expect(balanceAfterNewPayment(DUE, [ledger[0]], ledger[1])).toBe(0);
  });
});

describe('creditTotalUpTo (recibo antigo não pode ser reescrito por crédito novo)', () => {
  const credits = [
    { amount: 40, createdAt: '2026-09-05T14:00:00Z', reason: null },
    { amount: 10, createdAt: '2026-09-09T14:00:00Z', reason: null },
  ];
  it('conta só o que existia até o dia daquele pagamento', () => {
    expect(creditTotalUpTo(credits, '2026-09-03')).toBe(0); // recibo do 1º pagamento: sem crédito
    expect(creditTotalUpTo(credits, '2026-09-05')).toBe(40); // mesmo dia entra
    expect(creditTotalUpTo(credits, '2026-09-10')).toBe(50);
  });
  it('o recibo do pagamento anterior ao crédito mantém o saldo que foi impresso', () => {
    const ledger = [{ id: 'p1', amount: 290.27, paidAt: '2026-09-03' }];
    const dueNaEpoca = invoiceDue(580.55, creditTotalUpTo(credits, '2026-09-03'));
    expect(balanceAfterPayment(dueNaEpoca, ledger, 'p1')).toBe(290.28);
  });
});

describe('applyCreditToRows (o crédito tem que caber nas parcelas)', () => {
  const rows = () => [
    { label: 'Deposit', amount: 290.27, dueDate: '2026-09-05' },
    { label: 'Balance', amount: 290.28, dueDate: null },
  ];

  it('abate da ÚLTIMA parcela: o que falta é que diminui', () => {
    const out = applyCreditToRows(rows(), 40);
    expect(out.map((r) => r.amount)).toEqual([290.27, 250.28]);
  });

  it('a soma das parcelas passa a bater com o que é devido', () => {
    const credito = 40;
    const out = applyCreditToRows(rows(), credito);
    const soma = out.reduce((s, r) => s + r.amount, 0);
    expect(round2(soma)).toBe(invoiceDue(580.55, credito));
  });

  it('crédito maior que a última parcela vai comendo para trás', () => {
    const out = applyCreditToRows(rows(), 400);
    expect(out.map((r) => r.amount)).toEqual([180.55]); // a última zerou e sumiu
  });

  it('crédito igual ao total não deixa parcela nenhuma', () => {
    expect(applyCreditToRows(rows(), 580.55)).toEqual([]);
  });

  it('sem crédito, o plano é o mesmo objeto de antes', () => {
    const r = rows();
    expect(applyCreditToRows(r, 0)).toBe(r);
  });

  it('não inventa parcela negativa', () => {
    expect(applyCreditToRows(rows(), 9999).length).toBe(0);
  });
});

describe('pickCreditTarget (de qual fatura sai o abatimento)', () => {
  const inv = (id: string, total: number, paid: number, credit = 0) => ({ id, total, amountPaid: paid, creditTotal: credit });

  it('escolhe a primeira fatura que ainda tem saldo', () => {
    // job com 2 faturas: a #1 quitada, a complementar em aberto
    const alvo = pickCreditTarget([inv('a', 580.55, 580.55), inv('b', 2400, 0)]);
    expect(alvo?.id).toBe('b');
  });

  it('quando a primeira tem saldo, é ela', () => {
    expect(pickCreditTarget([inv('a', 580.55, 290.27), inv('b', 2400, 0)])?.id).toBe('a');
  });

  it('tudo quitado: nenhuma absorve', () => {
    expect(pickCreditTarget([inv('a', 100, 100), inv('b', 200, 200)])).toBeUndefined();
  });

  it('conta o que já foi abatido antes', () => {
    // 100 faturados, 60 pagos, 40 já abatidos → não cabe mais nada
    expect(pickCreditTarget([inv('a', 100, 60, 40)])).toBeUndefined();
  });
});

describe('o par cobrar/tirar tem que ZERAR depois de cada ação (bases diferentes de propósito)', () => {
  // A fiação de verdade, não literais: um verificador mostrou que testar com números soltos deixava
  // o defeito passar — trocar a base na tela mantinha tudo verde. Aqui o roll-up é calculado, e é
  // dele que saem os dois lados, exatamente como em Job.tsx.
  const lados = (quote: number, invoices: { total: number; amountPaid: number; creditTotal?: number }[]) => {
    const roll = invoiceRollup(invoices);
    return { cobrar: uninvoiced(quote, roll.billed), tirar: overbilled(quote, roll.total) };
  };

  it('perdoar saldo (sem mexer no orçamento) não vira "o trabalho aumentou"', () => {
    // fatura 580,55, pago 290,27, perdoados 290,28 → o orçamento continua 580,55
    const r = lados(580.55, [{ total: 580.55, amountPaid: 290.27, creditTotal: 290.28 }]);
    expect(r.cobrar).toBe(0); // era ISTO que anunciava "cobrar mais $290,28"
    expect(r.tirar).toBe(0);
  });

  it('material devolvido: sugere tirar uma vez, e some depois de tirado', () => {
    const antes = lados(540.55, [{ total: 580.55, amountPaid: 290.27 }]);
    expect(antes.tirar).toBe(40);
    expect(antes.cobrar).toBe(0);
    const depois = lados(540.55, [{ total: 580.55, amountPaid: 290.27, creditTotal: 40 }]);
    expect(depois.tirar).toBe(0);
    expect(depois.cobrar).toBe(0);
  });

  it('obra cresceu: sugere cobrar, e nada a tirar', () => {
    const r = lados(700, [{ total: 580.55, amountPaid: 290.27 }]);
    expect(r.cobrar).toBe(119.45);
    expect(r.tirar).toBe(0);
  });

  it('complementar + abatimento no mesmo job também zera', () => {
    const r = lados(10400, [
      { total: 8000, amountPaid: 8000 },
      { total: 2440, amountPaid: 0, creditTotal: 40 },
    ]);
    expect(r.cobrar).toBe(0); // bruto 10.440 ≥ orçamento
    expect(r.tirar).toBe(0); // líquido 10.400 = orçamento
  });
});
