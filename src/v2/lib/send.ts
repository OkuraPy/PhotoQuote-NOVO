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
  kind: 'quote' | 'invoice' | 'contract';
  docLabel: string; // "Quote" | "Invoice"
  number?: string;
  company: { name: string; license?: string; address?: string; phone?: string; email?: string };
  client: { name?: string; email?: string; phone?: string; addr?: string; city?: string } | null;
  items: { cat: string; desc: string; qty: number; unit: string; price: number; taxable: boolean }[];
  totals: { subtotal: number; tax: number; total: number; taxRate: number };
  // invoice payment plan + ledger summary (labels/dates already English — planRows output)
  payment?: { rows: { label: string; amount: number; due: string | null }[]; paid: number; balance: number };
};

function buildHtml(d: SendData): string {
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
    </div>
    <table>${rows}</table>
    ${
      d.payment
        ? `<div class="lab" style="margin-top:24px">Payment schedule</div>
    <table>${d.payment.rows
      .map((r) => `<tr><td><div class="desc">${escapeHtml(r.label)}</div></td><td class="due">${escapeHtml(dueTxt(r.due))}</td><td class="amt">${fmt(r.amount)}</td></tr>`)
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
    <div class="foot">Thank you for your business.</div>
  </body></html>`;
}

function buildText(d: SendData): string {
  const lines = d.items.map((it) => `• ${it.desc} — ${fmt(it.qty * it.price)}`).join('\n');
  const pay = d.payment
    ? `\n${
        d.payment.rows.length > 1
          ? '\nPayment schedule:\n' + d.payment.rows.map((r) => `• ${r.label} — ${fmt(r.amount)} (${r.due ? 'due ' + dueTxt(r.due) : 'upon completion'})`).join('\n') + '\n'
          : ''
      }${d.payment.paid > 0 ? `Paid ${fmt(d.payment.paid)} · ` : ''}Balance due ${fmt(d.payment.balance)}`
    : '';
  return `${d.docLabel}${d.number ? ' ' + d.number : ''} — ${d.company.name}\n${d.client?.name ? `For: ${d.client.name}\n` : ''}\n${lines}\n\nSubtotal ${fmt(d.totals.subtotal)} · Tax ${fmt(d.totals.tax)} · Total ${fmt(d.totals.total)}${pay}`;
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
