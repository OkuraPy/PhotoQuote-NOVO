// PhotoQuote v2 — sending quotes/invoices: branded PDF (escaped HTML) + Email/SMS/WhatsApp.
// Client-facing output is ALWAYS English (owner's rule) — no i18n in this file on purpose.
import { Alert, Linking, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { parseDateOnly } from '../data';

const fmt = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// date-only 'YYYY-MM-DD' → "Jul 22, 2026"; null = the payment is due upon completion
const dueTxt = (d: string | null) => (d ? parseDateOnly(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Upon completion');

// Escape every dynamic value before it goes into the PDF HTML (prevents the XSS the v1 PDFs had).
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type SendData = {
  kind: 'quote' | 'invoice' | 'contract' | 'receipt';
  docLabel: string; // "Quote" | "Invoice" | "Receipt"
  number?: string;
  company: { name: string; license?: string; address?: string; phone?: string; email?: string };
  client: { name?: string; email?: string; phone?: string; addr?: string; city?: string } | null;
  jobSite?: string; // pre-formatted English job-site line ("123 Main St, Miami, FL, 33101")
  customerNote?: string; // client-facing note (G1, English) — printed as a "Notes" section
  photos?: string[]; // curated job photos printed on the quote PDF (G2, max 6 — public URLs)
  items: { cat: string; desc: string; qty: number; unit: string; price: number; taxable: boolean }[];
  totals: { subtotal: number; tax: number; total: number; taxRate: number };
  // invoice payment plan + ledger (labels/dates already English — planRows/DB method keys)
  payment?: {
    rows: { label: string; amount: number; due: string | null }[];
    paid: number;
    balance: number;
    received?: { date: string; method: string | null; amount: number }[];
  };
  // kind 'receipt' (G3): one recorded payment — no item table, just the money facts
  receipt?: {
    number: string;
    date: string; // date-only 'YYYY-MM-DD' (paid_at)
    method: string | null; // English DB key (Cash / Check / …)
    amount: number;
    invoiceNumber?: string;
    balanceAfter: number; // remaining balance right after this payment (0 = paid in full)
  };
};

// Receipt PDF (G3): a confirmation, not a bill — company header, big green "Amount received",
// then the plain facts (date / method / invoice ref / remaining balance). Always English.
function buildReceiptHtml(d: SendData, r: NonNullable<SendData['receipt']>): string {
  const c = d.company;
  const cl = d.client;
  const dateTxt = parseDateOnly(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const paidInFull = r.balanceAfter <= 0.005;
  const row = (label: string, value: string, cls = '') =>
    `<tr><td><div class="desc">${escapeHtml(label)}</div></td><td class="amt ${cls}" style="font-weight:600">${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#0C1116;padding:32px;font-size:13px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #E6E9EE;padding-bottom:16px}
    .brand{font-size:20px;font-weight:800;letter-spacing:-.02em}
    .muted{color:#5B6573;font-size:12px}
    .lab{font-size:10px;letter-spacing:.12em;color:#8A93A3;text-transform:uppercase}
    .num{font-weight:800;margin-top:2px}
    .parties{display:flex;gap:32px;margin-top:18px}
    .parties>div{flex:1}
    .name{font-weight:800;margin-top:4px}
    .hero{margin-top:26px;background:#F2F7F4;border-radius:14px;padding:22px;text-align:center}
    .hero .amt{font-size:34px;font-weight:800;color:#1E9E6A;margin-top:6px;letter-spacing:-.5px}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    td{padding:11px 0;border-bottom:1px solid #E6E9EE;vertical-align:top}
    .desc{font-weight:700;font-size:13px;color:#5B6573}
    .amt{text-align:right;white-space:nowrap}
    .ok{color:#1E9E6A;font-weight:800}
    .foot{color:#8A93A3;font-size:11px;margin-top:28px}
  </style></head>
  <body>
    <div class="head">
      <div><div class="brand">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.license || '')}</div></div>
      <div style="text-align:right"><div class="lab">Receipt</div><div class="num">${escapeHtml(r.number)}</div></div>
    </div>
    <div class="parties">
      <div><div class="lab">From</div><div class="name">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.address || '')}<br>${escapeHtml(c.phone || '')}</div></div>
      <div><div class="lab">Bill to</div><div class="name">${escapeHtml(cl?.name || '')}</div><div class="muted">${escapeHtml(cl?.addr || '')}<br>${escapeHtml(cl?.city || '')}<br>${escapeHtml(cl?.email || '')}</div></div>
    </div>
    <div class="hero"><div class="lab">Amount received</div><div class="amt">${fmt(r.amount)}</div></div>
    <table>
      ${row('Date', dateTxt)}
      ${r.method ? row('Method', r.method) : ''}
      ${r.invoiceNumber ? row('Invoice', r.invoiceNumber) : ''}
      ${paidInFull ? row('Remaining balance', 'Paid in full', 'ok') : row('Remaining balance', fmt(r.balanceAfter))}
    </table>
    <div class="foot">Thank you for your payment.</div>
  </body></html>`;
}

function buildHtml(d: SendData): string {
  if (d.kind === 'receipt' && d.receipt) return buildReceiptHtml(d, d.receipt);
  const c = d.company;
  const cl = d.client;
  const rows = d.items
    .map(
      (it) => `<tr>
        <td><div class="desc">${escapeHtml(it.desc)}</div><div class="meta">${escapeHtml(it.cat)} · ${escapeHtml(it.qty)} ${escapeHtml(it.unit)} × ${fmt(it.price)}</div></td>
        <td class="amt">${fmt(it.qty * it.price)}</td>
      </tr>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#0C1116;padding:32px;font-size:13px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #E6E9EE;padding-bottom:16px}
    .brand{font-size:20px;font-weight:800;letter-spacing:-.02em}
    .muted{color:#5B6573;font-size:12px}
    .lab{font-size:10px;letter-spacing:.12em;color:#8A93A3;text-transform:uppercase}
    .num{font-weight:800;margin-top:2px}
    .parties{display:flex;gap:32px;margin-top:18px}
    .parties>div{flex:1}
    .name{font-weight:800;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    td{padding:11px 0;border-bottom:1px solid #E6E9EE;vertical-align:top}
    .amt{text-align:right;font-weight:700;white-space:nowrap}
    .desc{font-weight:700;font-size:13.5px}
    .meta{color:#5B6573;font-size:11px;margin-top:2px}
    .tot{margin-top:16px;margin-left:auto;width:60%}
    .row{display:flex;justify-content:space-between;color:#5B6573;padding:4px 0}
    .row b{color:#0C1116}
    .grand{display:flex;justify-content:space-between;font-size:18px;font-weight:800;border-top:2px solid #D7DCE3;padding-top:10px;margin-top:8px}
    .foot{color:#8A93A3;font-size:11px;margin-top:28px}
    .ok{color:#1E9E6A}
    .due{color:#5B6573;text-align:right;white-space:nowrap;font-size:12px}
  </style></head>
  <body>
    <div class="head">
      <div><div class="brand">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.license || '')}</div></div>
      <div style="text-align:right"><div class="lab">${escapeHtml(d.docLabel)}</div><div class="num">${escapeHtml(d.number || '')}</div></div>
    </div>
    <div class="parties">
      <div><div class="lab">From</div><div class="name">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.address || '')}<br>${escapeHtml(c.phone || '')}</div></div>
      <div><div class="lab">Bill to</div><div class="name">${escapeHtml(cl?.name || '')}</div><div class="muted">${escapeHtml(cl?.addr || '')}<br>${escapeHtml(cl?.city || '')}<br>${escapeHtml(cl?.email || '')}</div></div>
      ${d.jobSite ? `<div><div class="lab">Job site</div><div class="muted" style="margin-top:5px">${escapeHtml(d.jobSite)}</div></div>` : ''}
    </div>
    ${
      d.photos?.length
        ? `<div class="lab" style="margin-top:22px">Job photos</div>
    <div style="margin-top:8px">${d.photos
      .slice(0, 6)
      .map((u) => `<div style="display:inline-block;width:48%;margin:0 1% 8px 0;vertical-align:top;page-break-inside:avoid"><img src="${escapeHtml(u)}" style="width:100%;height:220px;object-fit:cover;border-radius:8px"/></div>`)
      .join('')}</div>`
        : ''
    }
    <table>${rows}</table>
    ${
      d.payment
        ? `<div class="lab" style="margin-top:24px">Payment schedule</div>
    <table>${d.payment.rows
      .map((r) => `<tr><td><div class="desc">${escapeHtml(r.label)}</div></td><td class="due">${escapeHtml(dueTxt(r.due))}</td><td class="amt">${fmt(r.amount)}</td></tr>`)
      .join('')}</table>`
        : ''
    }
    ${
      d.payment?.received?.length
        ? `<div class="lab" style="margin-top:24px">Payments received</div>
    <table>${d.payment.received
      .map((p) => `<tr><td><div class="desc">${escapeHtml(dueTxt(p.date))}${p.method ? `<span class="muted"> · ${escapeHtml(p.method)}</span>` : ''}</div></td><td class="amt ok">${fmt(p.amount)}</td></tr>`)
      .join('')}</table>`
        : ''
    }
    <div class="tot">
      <div class="row"><span>Subtotal</span><b>${fmt(d.totals.subtotal)}</b></div>
      <div class="row"><span>Tax (${escapeHtml(d.totals.taxRate)}%)</span><b>${fmt(d.totals.tax)}</b></div>
      <div class="grand"><span>Total</span><span>${fmt(d.totals.total)}</span></div>
      ${
        d.payment
          ? `${d.payment.paid > 0 ? `<div class="row" style="margin-top:6px"><span>Paid</span><b class="ok">${fmt(d.payment.paid)}</b></div>` : ''}
      <div class="grand" style="border-top:1px solid #E6E9EE;font-size:15px"><span>Balance due</span><span>${fmt(d.payment.balance)}</span></div>`
          : ''
      }
    </div>
    ${
      d.customerNote
        ? `<div class="lab" style="margin-top:26px">Notes</div>
    <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.55;margin-top:6px">${escapeHtml(d.customerNote)}</div>`
        : ''
    }
    <div class="foot">Thank you for your business.</div>
  </body></html>`;
}

function buildText(d: SendData): string {
  if (d.kind === 'receipt' && d.receipt) {
    const r = d.receipt;
    return `Receipt ${r.number} — ${d.company.name}\n${d.client?.name ? `For: ${d.client.name}\n` : ''}\nAmount received: ${fmt(r.amount)}\nDate: ${dueTxt(r.date)}${r.method ? `\nMethod: ${r.method}` : ''}${r.invoiceNumber ? `\nInvoice: ${r.invoiceNumber}` : ''}\n${r.balanceAfter > 0.005 ? `Remaining balance: ${fmt(r.balanceAfter)}` : 'Paid in full'}\n\nThank you for your payment.`;
  }
  const lines = d.items.map((it) => `• ${it.desc} — ${fmt(it.qty * it.price)}`).join('\n');
  const pay = d.payment
    ? `\n${
        d.payment.rows.length > 1
          ? '\nPayment schedule:\n' + d.payment.rows.map((r) => `• ${r.label} — ${fmt(r.amount)} (${r.due ? 'due ' + dueTxt(r.due) : 'upon completion'})`).join('\n') + '\n'
          : ''
      }${
        d.payment.received?.length
          ? 'Payments received:\n' + d.payment.received.map((p) => `• ${dueTxt(p.date)}${p.method ? ' · ' + p.method : ''} — ${fmt(p.amount)}`).join('\n') + '\n'
          : ''
      }${d.payment.paid > 0 ? `Paid ${fmt(d.payment.paid)} · ` : ''}Balance due ${fmt(d.payment.balance)}`
    : '';
  const note = d.customerNote ? `\n\nNotes: ${d.customerNote}` : '';
  return `${d.docLabel}${d.number ? ' ' + d.number : ''} — ${d.company.name}\n${d.client?.name ? `For: ${d.client.name}\n` : ''}${d.jobSite ? `Job site: ${d.jobSite}\n` : ''}\n${lines}\n\nSubtotal ${fmt(d.totals.subtotal)} · Tax ${fmt(d.totals.tax)} · Total ${fmt(d.totals.total)}${pay}${note}`;
}

export async function sendDoc(option: string, d: SendData) {
  const text = buildText(d);
  const phone = (d.client?.phone || '').replace(/\D/g, '');
  try {
    if (option === 'Email') {
      await Linking.openURL(`mailto:${d.client?.email || ''}?subject=${encodeURIComponent(`${d.docLabel} ${d.number || ''}`.trim())}&body=${encodeURIComponent(text)}`);
    } else if (option === 'SMS') {
      const sep = Platform.OS === 'ios' ? '&' : '?';
      await Linking.openURL(`sms:${phone}${sep}body=${encodeURIComponent(text)}`);
    } else if (option === 'WhatsApp') {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
    } else {
      // Save PDF
      const { uri } = await Print.printToFileAsync({ html: buildHtml(d) });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${d.docLabel} ${d.number || ''}` });
      else Alert.alert('PDF saved', uri);
    }
  } catch (e: any) {
    Alert.alert('Could not send', e?.message || 'Try another option.');
  }
}
