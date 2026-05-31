// PhotoQuote v2 — Job screen: timeline + Quote / Invoice / Contract / Progress tabs
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow, Stage } from '../theme';
import { calcTotals, CLIENTS, COMPANY, ESTIMATE_ITEMS, fmt, LineItem, split, STAGES } from '../data';
import { useQuery } from '@tanstack/react-query';
import { fetchJobDetail, JobDetail } from '../lib/api';
import { Between, Btn, Card, CatChip, Divider, Nav, NavBtn, PhotoTile, Row, SectionTitle, SendSheet, StageChip, useStore } from '../ui';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };

const NEXT: Record<Stage, { label: string; ico: string; act: string }> = {
  Draft: { label: 'Send quote', ico: 'send', act: 'send' },
  Quoted: { label: 'Send quote', ico: 'send', act: 'send' },
  Sent: { label: 'Mark approved', ico: 'check', act: 'approve' },
  Approved: { label: 'Generate invoice', ico: 'receipt', act: 'invoice' },
  Invoiced: { label: 'Mark paid', ico: 'wallet', act: 'paid' },
  Paid: { label: 'Paid in full', ico: 'checkCircle', act: 'done' },
};

function Timeline({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, paddingTop: 6 }}>
      {STAGES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const active = done || current;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            {i > 0 ? <View style={{ position: 'absolute', top: 12, left: '-50%', width: '100%', height: 2, backgroundColor: active ? colors.primary : colors.border }} /> : null}
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? colors.primaryTint : 'transparent' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.primary : '#fff', borderWidth: 2, borderColor: active ? colors.primary : colors.border }}>
                {done ? <Icon name="check" size={13} sw={3} color="#fff" /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: current ? colors.primary : colors.faint }}>{i + 1}</Text>}
              </View>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: current ? colors.primary : colors.muted, textAlign: 'center' }}>{s}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function JobScreen({ go, back, params }: NavProp) {
  const { store, up } = useStore();
  const job = params?.job || null;
  const client = job ? CLIENTS.find((c) => c.name === job.client) || null : CLIENTS[0];
  const id = job?.id || (params && params.id) || 'new';
  const baseStage: Stage = job ? job.stage : 'Quoted';
  const stage = store.stageOverride[id] || baseStage;
  const tab = store.jobTab || 'quote';
  const setStage = (s: Stage) => up((st) => ({ stageOverride: { ...st.stageOverride, [id]: s } }));
  const setTab = (k: string) => up({ jobTab: k });
  const projectId: string | null = job?.projectId || job?.id || null;
  const { data: detail } = useQuery({ queryKey: ['jobDetail', projectId], queryFn: () => fetchJobDetail(projectId!), enabled: !!projectId });
  const items = detail?.items?.length ? detail.items : job ? [] : ESTIMATE_ITEMS;
  const taxRate = detail?.estimate?.taxRate ?? 8.25;
  const t = calcTotals(items, taxRate, detail?.estimate?.marginRate ?? 0);
  const [vd, vc] = split(job ? job.value : t.total);
  const name = job ? job.title : 'Exterior repaint';
  const cName = job ? job.client || 'No client' : client?.name || 'Maria Alvarez';
  const addr = job ? job.addr : client?.addr || '14 Linden Ave';
  const next = NEXT[stage];

  const doNext = () => {
    if (next.act === 'send') return up({ sheet: true });
    if (next.act === 'approve') setStage('Approved');
    if (next.act === 'invoice') { setStage('Invoiced'); setTab('invoice'); }
    if (next.act === 'paid') setStage('Paid');
  };

  return (
    <>
      <Nav title={cName || 'No client'} sub={name} center onBack={back} right={<NavBtn icon="more" size={18} />} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: 18, ...shadow.sm }}>
          <Between style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>{name}</Text>
              <Row style={{ gap: 6, marginTop: 3 }}>
                <Icon name="mapPin" size={13} color={colors.faint} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{addr}</Text>
              </Row>
            </View>
            <StageChip stage={stage} lg />
          </Between>
          <Text style={{ fontFamily: fonts.num, fontSize: 32, color: colors.ink, marginTop: 14, letterSpacing: -0.6 }}>
            {vd}<Text style={{ color: colors.muted }}>{vc}</Text>
          </Text>
          <Divider />
          <Timeline stage={stage} />
        </View>

        {stage !== 'Paid' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primaryTint2, borderRadius: radii.lg, padding: 13, marginTop: 16 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={next.ico} size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.primary }}>NEXT STEP</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 2 }}>{next.label}</Text>
            </View>
            <Btn title={next.label} sm onPress={doNext} />
          </View>
        ) : null}

        {/* internal tabs */}
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#EEF1F4', borderRadius: 14, marginTop: 16 }}>
          {[['quote', 'Quote'], ['invoice', 'Invoice'], ['contract', 'Contract'], ['progress', 'Progress']].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[{ flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tab === k && { backgroundColor: colors.card, ...shadow.sm }]}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: tab === k ? colors.ink : colors.muted }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'quote' && <QuoteTab items={items} t={t} go={go} />}
        {tab === 'invoice' && <InvoiceTab stage={stage} items={items} t={t} client={client} invoice={detail?.invoice} onGen={() => { setStage('Invoiced'); }} setSheet={(b: boolean) => up({ sheet: b })} />}
        {tab === 'contract' && <ContractTab setSheet={(b: boolean) => up({ sheet: b })} />}
        {tab === 'progress' && <ProgressTab />}
      </ScrollView>

      <SendSheet
        open={store.sheet}
        onClose={() => up({ sheet: false })}
        what={tab === 'invoice' ? 'invoice' : tab === 'contract' ? 'contract' : 'quote'}
        onSent={() => { up({ sheet: false }); setStage('Sent'); }}
      />
    </>
  );
}

function TotRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <Between style={{ paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: bold ? fonts.bold : fonts.bold, fontSize: 13, color: color || colors.ink }}>{value}</Text>
    </Between>
  );
}

function QuoteTab({ items, t, go }: { items: LineItem[]; t: ReturnType<typeof calcTotals>; go: NavProp['go'] }) {
  return (
    <View style={{ marginTop: 16 }}>
      <SectionTitle title="Line items" link="Edit" onLink={() => go('estimate', {})} />
      <View style={{ gap: 10 }}>
        {items.map((it) => (
          <Card key={it.id} style={{ padding: 14 }}>
            <Between>
              <CatChip label={it.cat} />
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink }}>{fmt(it.qty * it.price)}</Text>
            </Between>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, marginTop: 9 }}>{it.desc}</Text>
            <Between style={{ marginTop: 7 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{it.qty} {it.unit} × {fmt(it.price)}</Text>
              <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: it.taxable ? colors.primaryTint : '#EEF1F4' }}>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: it.taxable ? colors.primary : colors.faint }}>{it.taxable ? 'Taxable' : 'No tax'}</Text>
              </View>
            </Between>
          </Card>
        ))}
      </View>
      <Card style={{ padding: 16, marginTop: 16 }}>
        <TotRow label="Subtotal" value={fmt(t.subtotal)} />
        <TotRow label={`Tax (8.25% on ${fmt(t.taxableSubtotal)})`} value={fmt(t.tax)} />
        <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>Total</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(t.total)}</Text>
        </Between>
      </Card>
    </View>
  );
}

function InvoiceTab({ stage, items, t, client, invoice, onGen, setSheet }: { stage: Stage; items: LineItem[]; t: ReturnType<typeof calcTotals>; client: any; invoice?: JobDetail['invoice']; onGen: () => void; setSheet: (b: boolean) => void }) {
  const has = !!invoice || ['Invoiced', 'Paid'].includes(stage);
  const deposit = 25;
  if (!has) {
    return (
      <View style={{ marginTop: 16, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="receipt" size={30} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>No invoice yet</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Generate a professional invoice from this quote. Totals stay in sync automatically.</Text>
        <Btn title="Generate invoice" icon="receipt" onPress={onGen} style={{ marginTop: 20, maxWidth: 240 }} />
      </View>
    );
  }
  const depAmt = t.total * (deposit / 100);
  const balance = t.total - depAmt;
  const paid = invoice?.status === 'Paid' || stage === 'Paid';
  return (
    <View style={{ marginTop: 16 }}>
      <Card style={{ overflow: 'hidden', ...shadow.card }}>
        {/* head */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Between>
            <Row style={{ gap: 11, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: '#fff' }}>A</Text>
              </View>
              <View>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{COMPANY.name}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{COMPANY.license}</Text>
              </View>
            </Row>
            <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: paid ? colors.successTint : colors.warningTint }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: paid ? colors.success : colors.warning }}>{paid ? 'PAID' : 'DUE'}</Text>
            </View>
          </Between>
          <Between style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <View><DpLab text="Invoice" /><Text style={{ fontFamily: fonts.num, fontSize: 14, color: colors.muted, marginTop: 3 }}>{invoice?.number || 'INV-2026-0001'}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><DpLab text="Issued · Due" /><Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink, marginTop: 3 }}>May 31 · Jun 15</Text></View>
          </Between>
        </View>
        {/* parties */}
        <View style={{ flexDirection: 'row', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <DpLab text="From" />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{COMPANY.name}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{COMPANY.addr}{'\n'}{COMPANY.city}{'\n'}{COMPANY.phone}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <DpLab text="Bill to" />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{client ? client.name : 'Maria Alvarez'}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{client ? client.addr : '14 Linden Ave'}{'\n'}{client ? client.city : 'Austin, TX'}{'\n'}{client ? client.email : ''}</Text>
          </View>
        </View>
        {/* rows */}
        <View style={{ paddingHorizontal: 20 }}>
          {items.map((it, idx) => (
            <Between key={it.id} style={{ paddingVertical: 11, borderBottomWidth: idx === items.length - 1 ? 0 : 1, borderBottomColor: colors.border, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{it.desc}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{it.cat} · {it.qty} {it.unit} × {fmt(it.price)}</Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{fmt(it.qty * it.price)}</Text>
            </Between>
          ))}
        </View>
        {/* totals */}
        <View style={{ padding: 20, backgroundColor: colors.card2, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TotRow label="Subtotal" value={fmt(t.subtotal)} />
          <TotRow label={`Tax (8.25% on ${fmt(t.taxableSubtotal)})`} value={fmt(t.tax)} />
          <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>Total due</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(t.total)}</Text>
          </Between>
          <View style={{ marginTop: 10 }}>
            <TotRow label={`Deposit (${deposit}%)`} value={fmt(depAmt)} />
            <TotRow label={paid ? 'Paid' : 'Balance due'} value={paid ? fmt(t.total) : fmt(balance)} color={paid ? colors.success : colors.ink} />
          </View>
        </View>
      </Card>
      <Row style={{ gap: 6, marginTop: 12, paddingHorizontal: 4 }}>
        <Icon name="card" size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, flex: 1, lineHeight: 18 }}>Pay by card, ACH or check. Terms: Net 15 from issue date.</Text>
      </Row>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" icon="pdf" title="PDF" style={{ flex: 0.4 }} />
        <Btn title="Send invoice" icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
const DpLab = ({ text }: { text: string }) => <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1, color: colors.faint }}>{text.toUpperCase()}</Text>;

function ContractTab({ setSheet }: { setSheet: (b: boolean) => void }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Card pad>
        <Between>
          <Row style={{ gap: 11, flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="signature" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>Service agreement</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Standard template · TX</Text>
            </View>
          </Row>
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: '#EEF0F3' }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: '#8A93A3' }}>DRAFT</Text>
          </View>
        </Between>
        <Divider />
        <Between>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Required deposit</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>25% · {fmt(4238.8 * 0.25)}</Text>
        </Between>
        <Between style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Signature</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>Awaiting client</Text>
        </Between>
      </Card>
      <Card pad style={{ marginTop: 12, backgroundColor: colors.card2 }}>
        <DpLab text="Preview" />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 20 }}>
          This agreement is between <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{COMPANY.name}</Text> and the client for <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>exterior repaint</Text> services at the property listed. Work to begin upon deposit and signature…
        </Text>
      </Card>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" icon="fileText" title="PDF" style={{ flex: 0.4 }} />
        <Btn title="Send for signature" icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

function ProgressTab() {
  const phases = [
    { name: 'Prep & masking', status: 'completed', photos: 4, note: 'Surfaces washed, trim taped.' },
    { name: 'Priming', status: 'in_progress', photos: 2, note: 'North & east walls primed.' },
    { name: 'Top coat', status: 'not_started', photos: 0 },
    { name: 'Final walkthrough', status: 'not_started', photos: 0 },
  ];
  const map: Record<string, [string, string, string]> = {
    completed: [colors.success, colors.successTint, 'Done'],
    in_progress: [colors.info, colors.infoTint, 'In progress'],
    not_started: [colors.faint, colors.bg, 'Not started'],
  };
  return (
    <View style={{ marginTop: 16 }}>
      <Between style={{ marginBottom: 14 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>2 of 4 phases</Text>
        <Row style={{ gap: 5 }}>
          <Icon name="link" size={14} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Client link</Text>
        </Row>
      </Between>
      <View style={{ gap: 12 }}>
        {phases.map((p, i) => {
          const [c, bg, lab] = map[p.status];
          return (
            <Card key={i} pad>
              <Between>
                <Row style={{ gap: 11 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                    {p.status === 'completed' ? <Icon name="check" size={17} sw={3} color={c} /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: c }}>{i + 1}</Text>}
                  </View>
                  <View>
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{p.name}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: c }}>{lab}</Text>
                  </View>
                </Row>
                {p.photos > 0 ? (
                  <Row style={{ gap: 5, backgroundColor: colors.chipBg, borderRadius: 7, paddingVertical: 4, paddingHorizontal: 9 }}>
                    <Icon name="image" size={13} color="#4A5260" />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#4A5260' }}>{p.photos}</Text>
                  </Row>
                ) : null}
              </Between>
              {p.note ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 19 }}>{p.note}</Text> : null}
              {p.photos > 0 ? (
                <Row style={{ gap: 8, marginTop: 12 }}>
                  {Array.from({ length: Math.min(p.photos, 4) }).map((_, k) => <PhotoTile key={k} seed={i + k} size={54} radius={10} />)}
                </Row>
              ) : null}
            </Card>
          );
        })}
      </View>
    </View>
  );
}
