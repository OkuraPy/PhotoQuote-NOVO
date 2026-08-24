// PhotoQuote v2 — sending quotes/invoices: branded PDF (escaped HTML) + Email/SMS/WhatsApp.
// Client-facing output is ALWAYS English (owner's rule) — no i18n in this file on purpose,
// EXCEPT the two Alerts below: those are the CONTRACTOR's UI, so they do translate.
import { Alert, Linking, Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { DOC_PHOTO_CAP, parseDateOnly } from '../data';
import { registerStrings, translate } from './i18n';

registerStrings({
  'send.pdfSaved': { en: 'PDF saved', es: 'PDF guardado', pt: 'PDF salvo' },
  'send.couldNotSend': { en: 'Could not send', es: 'No se pudo enviar', pt: 'Não foi possível enviar' },
  'send.tryAnother': { en: 'Try another option.', es: 'Prueba otra opción.', pt: 'Tente outra opção.' },
});

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

/* ---------------- photos on the PDF: inline them, never let the renderer race the network ------- */
// expo-print snapshots the rendered HTML: a remote <img> that hasn't finished downloading simply
// doesn't make it into the PDF (owner's field report 26/07 — "I put 8 photos on the quote and only
// 3 came out"). Each photo is downloaded to the cache and turned into a data URI BEFORE printing,
// so nothing is left to load. The downloaded LOCAL file is then resized through the image pipeline
// (the manipulator refuses remote urls on iOS, so it can only run on the local copy); any failure
// keeps the original URL — that's exactly today's behavior, so this can only improve it.
const PHOTO_TIMEOUT = 9000; // a stalled download must not hold the whole document hostage
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('photo timeout')), ms);
    p.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); }
    );
  });
}
// maxWidth = null skips the resize entirely: the company logo (G-8) is small AND often a PNG with
// a transparent background, and the manipulator's JPEG re-encode would paint that transparency
// black right in the document header.
async function toDataUri(url: string, i: number, maxWidth: number | null = 900): Promise<string> {
  // the whole body is guarded: ANY throw here would reject the Promise.all and cost the user the
  // entire PDF, which is worse than the missing photo we're fixing
  try {
    if (url.startsWith('data:')) return url;
    // structural type on purpose: downloadFileAsync is typed against the base File class, which
    // doesn't line up with the exported subclass in this SDK's typings
    let tmp: { uri: string; base64: () => Promise<string>; delete: () => void } | null = null;
    try {
      // unique destination name: two jobs can hold photos with the same file name
      tmp = await withTimeout(File.downloadFileAsync(url, new File(Paths.cache, `pqimg_${Date.now()}_${i}.jpg`)), PHOTO_TIMEOUT);
      // resize the LOCAL file (never the remote url — on iOS the manipulator only reads local
      // paths). The page prints each photo at ~500px, so shipping the 1-2MB original would only
      // bloat the HTML the print WebView has to swallow.
      if (maxWidth) {
        try {
          const m = await ImageManipulator.manipulateAsync(tmp.uri, [{ resize: { width: maxWidth } }], {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          });
          if (m.base64) return `data:image/jpeg;base64,${m.base64}`;
        } catch {
          /* fall back to the bytes as downloaded */
        }
      }
      const b64 = await tmp.base64();
      if (b64) return `data:${/\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg'};base64,${b64}`;
    } finally {
      try {
        tmp?.delete();
      } catch {
        /* a leftover cache file is reclaimed by the OS */
      }
    }
  } catch {
    /* keep the remote url as the last resort — that is exactly today's behavior */
  }
  return url;
}
// a null/garbage entry in doc_photo_urls must not blow up the document
const inlinePhotos = (urls: string[]) =>
  Promise.all(urls.filter((u) => typeof u === 'string' && !!u).slice(0, DOC_PHOTO_CAP).map((u, i) => toDataUri(u, i)));

// G-8: the logo only goes on the page if it came back as REAL bytes. toDataUri falls back to the
// remote url when the download fails, and a remote <img> in expo-print prints as a broken-image
// box — on the company header, that is worse than no logo at all.
async function inlineLogo(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  const inlined = await toDataUri(url, 0, null);
  return inlined.startsWith('data:') ? inlined : null;
}

export type SendData = {
  kind: 'quote' | 'invoice' | 'contract' | 'receipt';
  docLabel: string; // "Quote" | "Invoice" | "Receipt"
  number?: string;
  // G-8: `logo` is the company logo the owner already uploads in the profile — it was stored and
  // never printed on anything. Passed as the storage URL; inlined as a data URI before printing
  // (expo-print snapshots the HTML without waiting for remote <img>, the Onda F lesson).
  company: { name: string; license?: string; address?: string; phone?: string; email?: string; logo?: string | null };
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
    reference?: string | null; // G-6: check number / bank, as the owner typed it
    amount: number;
    invoiceNumber?: string;
    balanceAfter: number; // remaining balance right after this payment (0 = paid in full)
  };
};

/* ---------------- G-8: logo in the header + print pagination ---------------- */
// The logo the owner uploads in the profile was stored and printed nowhere. `logo` here is
// already a data URI (inlineLogo) — OUR bytes, base64 alphabet, nothing to escape.
const LOGO_CSS = `.co{display:flex;align-items:center;gap:12px}.logo{height:46px;max-width:170px;object-fit:contain;display:block}`;
const logoImg = (logo?: string | null) => (logo && logo.startsWith('data:') ? `<img class="logo" src="${logo}"/>` : '');

// "tem que formatar melhor isso daí, paginar melhor" (Gladson, 31/07): a line item was being cut
// in half by the page break and a section heading could end up alone at the bottom of a page.
// WebKit (what expo-print renders with) honours break-inside on table rows and blocks; both the
// legacy `page-break-*` and the modern `break-*` spellings are emitted so neither engine misses it.
const PAGE_CSS = `
    tr,.row,.grand,.tot,.shot{page-break-inside:avoid;break-inside:avoid}
    .lab{page-break-after:avoid;break-after:avoid}
    .head,.parties{page-break-after:avoid}
    img{max-width:100%}`;

// Receipt PDF (G3): a confirmation, not a bill — company header, big green "Amount received",
// then the plain facts (date / method / reference / invoice ref / remaining balance). Always English.
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
    ${LOGO_CSS}
    ${PAGE_CSS}
  </style></head>
  <body>
    <div class="head">
      <div class="co">${logoImg(c.logo)}<div><div class="brand">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.license || '')}</div></div></div>
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
      ${r.reference ? row('Reference', r.reference) : ''}
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
    .shot{display:inline-block;width:48%;margin:0 1% 8px 0;vertical-align:top}
    .shot img{width:100%;height:210px;object-fit:cover;border-radius:8px}
    ${LOGO_CSS}
    ${PAGE_CSS}
  </style></head>
  <body>
    <div class="head">
      <div class="co">${logoImg(c.logo)}<div><div class="brand">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.license || '')}</div></div></div>
      <div style="text-align:right"><div class="lab">${escapeHtml(d.docLabel)}</div><div class="num">${escapeHtml(d.number || '')}</div></div>
    </div>
    <div class="parties">
      <div><div class="lab">From</div><div class="name">${escapeHtml(c.name)}</div><div class="muted">${escapeHtml(c.address || '')}<br>${escapeHtml(c.phone || '')}</div></div>
      <div><div class="lab">Bill to</div><div class="name">${escapeHtml(cl?.name || '')}</div><div class="muted">${escapeHtml(cl?.addr || '')}<br>${escapeHtml(cl?.city || '')}<br>${escapeHtml(cl?.email || '')}</div></div>
      ${d.jobSite ? `<div><div class="lab">Job site</div><div class="muted" style="margin-top:5px">${escapeHtml(d.jobSite)}</div></div>` : ''}
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
    ${
      // G-8: the photos moved from ABOVE the line items to the end of the document. Six 220px
      // tiles right under the header ate page 1 whole and pushed the item table into the page
      // break — the client opened the quote and saw pictures, not the price. Money first, photos
      // as the closing evidence.
      d.photos?.length
        ? `<div class="lab" style="margin-top:26px">Job photos</div>
    <div style="margin-top:8px">${d.photos
      .slice(0, DOC_PHOTO_CAP)
      // a data URI is OUR bytes (base64 alphabet, nothing to escape) — running the 5-pass escape
      // over a ~600KB string per photo is pure copying right before the print
      .map((u) => `<div class="shot"><img src="${u.startsWith('data:') ? u : escapeHtml(u)}"/></div>`)
      .join('')}</div>`
        : ''
    }
    <div class="foot">Thank you for your business.</div>
  </body></html>`;
}

function buildText(d: SendData): string {
  if (d.kind === 'receipt' && d.receipt) {
    const r = d.receipt;
    return `Receipt ${r.number} — ${d.company.name}\n${d.client?.name ? `For: ${d.client.name}\n` : ''}\nAmount received: ${fmt(r.amount)}\nDate: ${dueTxt(r.date)}${r.method ? `\nMethod: ${r.method}` : ''}${r.reference ? `\nReference: ${r.reference}` : ''}${r.invoiceNumber ? `\nInvoice: ${r.invoiceNumber}` : ''}\n${r.balanceAfter > 0.005 ? `Remaining balance: ${fmt(r.balanceAfter)}` : 'Paid in full'}\n\nThank you for your payment.`;
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
      // no phone on file → wa.me without a number lands on an error page; share sheet instead
      if (phone) await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
      else await Share.share({ message: text });
    } else {
      // Save PDF — photos AND the company logo are inlined first (see toDataUri) so the renderer
      // never races them. Both run together: the logo is one small file next to up to 6 photos.
      const [photos, logo] = await Promise.all([d.photos?.length ? inlinePhotos(d.photos) : Promise.resolve(null), inlineLogo(d.company.logo)]);
      const doc: SendData = { ...d, company: { ...d.company, logo }, ...(photos ? { photos } : {}) };
      const { uri } = await Print.printToFileAsync({ html: buildHtml(doc) });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${d.docLabel} ${d.number || ''}` });
      else Alert.alert(translate('send.pdfSaved'), uri);
    }
  } catch (e: any) {
    Alert.alert(translate('send.couldNotSend'), e?.message || translate('send.tryAnother'));
  }
}
