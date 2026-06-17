// PhotoQuote v2 — Job screen: timeline + Quote / Invoice / Contract / Progress tabs
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow, Stage } from '../theme';
import { calcTotals, CLIENTS, COMPANY, fmt, LineItem, split, STAGES } from '../data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addPhasePhotos, agreementLink, createAgreement, createInvoice, createPhase, deletePhase, deriveStage, ensureShareToken, fetchCompanyProfile, fetchJobDetail, fetchPhases, JobDetail, progressLink, ProgressPhase, PhaseStatus, updateEstimateStatus, updateInvoiceStatus, updatePhase } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sendDoc } from '../lib/send';
import { Between, Btn, Card, CatChip, Divider, Empty, Field, Input, Nav, NavBtn, Row, SectionTitle, SendSheet, Sheet, StageChip, useStore } from '../ui';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
type Totals = { subtotal: number; taxableSubtotal: number; tax: number; total: number; taxRate: number };

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
  const client = job ? CLIENTS.find((c) => c.name === job.client) || null : store.aSel || null;
  const id = job?.id || (params && params.id) || 'new';
  const tab = store.jobTab || 'quote';
  const setStage = (s: Stage) => up((st) => ({ stageOverride: { ...st.stageOverride, [id]: s } }));
  const clearStage = () => up((st) => { const o = { ...st.stageOverride }; delete o[id]; return { stageOverride: o }; });
  const setTab = (k: string) => up({ jobTab: k });
  const { user } = useAuth();
  const { data: company } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  const projectId: string | null = job?.projectId || job?.id || (params?.id && params.id !== 'new' ? params.id : null);
  const { data: detail } = useQuery({ queryKey: ['jobDetail', projectId], queryFn: () => fetchJobDetail(projectId!), enabled: !!projectId });
  const est = detail?.estimate;
  const inv = detail?.invoice;
  // stage derived from the DB (estimate/invoice status) once detail loads; falls back to the list value
  const baseStage: Stage = detail ? deriveStage(est?.status, inv?.status) : job ? job.stage : 'Quoted';
  const stage = store.stageOverride[id] || baseStage;
  const realClient = detail?.client || null;
  // new job (not yet persisted): show the AI estimate the user just generated, held in the store
  const items = detail?.items?.length ? detail.items : job ? [] : store.items;
  const taxRate = est?.taxRate ?? store.taxRate ?? 8.25;
  const computed = calcTotals(items, taxRate, est?.marginRate ?? store.marginRate ?? 0);
  // stored DB totals are the source of truth (trigger); fall back to computed for mock/no-estimate
  const quoteTotals: Totals = est
    ? { subtotal: est.subtotal, taxableSubtotal: computed.taxableSubtotal, tax: est.tax, total: est.total, taxRate }
    : { ...computed, taxRate };
  const invoiceTotals: Totals = inv
    ? { subtotal: inv.subtotal, taxableSubtotal: computed.taxableSubtotal, tax: inv.tax, total: inv.total, taxRate: inv.taxRate }
    : quoteTotals;
  const [vd, vc] = split(job ? job.value : quoteTotals.total);
  const name = job ? job.title : store.svcs[0] ? `${store.svcs[0]} job` : 'New estimate';
  const cName = job ? job.client || 'No client' : client?.name || 'No client';
  const addr = job ? job.addr : client?.addr || store.aLoc?.city || 'No address yet';
  const next = NEXT[stage];
  const queryClient = useQueryClient();
  const [genningInv, setGenningInv] = useState(false);

  // generate a real invoice from the saved estimate (copies its totals; sequential number)
  const generateInvoice = async () => {
    if (inv) { clearStage(); setTab('invoice'); return; }
    if (!user?.id || !est?.id || !projectId) { Alert.alert('Estimate needed', 'Save the estimate first, then generate the invoice.'); return; }
    setGenningInv(true);
    try {
      await createInvoice(user.id, est.id, projectId);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      clearStage(); // invoice now exists → DB-derived stage becomes "Invoiced"
      setTab('invoice');
    } catch (e: any) {
      Alert.alert('Could not create the invoice', e?.message || 'Try again.');
    } finally {
      setGenningInv(false);
    }
  };

  // contract / service agreement → generate (from the invoice) and share the signing link
  const [genningContract, setGenningContract] = useState(false);
  const shareContract = async (token: string) => {
    try {
      await Share.share({ message: `Please review and sign your service agreement:\n${agreementLink(token)}` });
    } catch {
      /* user dismissed the share sheet */
    }
  };
  const generateContract = async () => {
    if (detail?.agreement) return shareContract(detail.agreement.token);
    if (!inv) { Alert.alert('Invoice needed', 'Generate the invoice first, then the contract.'); return; }
    if (!user?.id || !projectId) return;
    setGenningContract(true);
    try {
      const { token } = await createAgreement(user.id, projectId, inv.id);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await shareContract(token);
    } catch (e: any) {
      Alert.alert('Could not create the contract', e?.message || 'Try again.');
    } finally {
      setGenningContract(false);
    }
  };

  // persist a status change to the DB then refetch. The optimistic update is applied only AFTER the
  // id guard, and is cleared on success (DB-derived stage takes over) and reverted on failure —
  // so a failed/blocked write never leaves a fake stage stuck in the UI.
  const setEstimateStatus = async (status: string, optimistic: Stage) => {
    if (!est?.id) return;
    setStage(optimistic);
    try {
      await updateEstimateStatus(est.id, status);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      clearStage();
    } catch (e: any) {
      clearStage();
      Alert.alert('Could not update', e?.message || 'Try again.');
    }
  };
  const setInvoiceStatus = async (status: string, optimistic?: Stage) => {
    if (!inv?.id) return;
    if (optimistic) setStage(optimistic);
    try {
      await updateInvoiceStatus(inv.id, status);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      if (optimistic) clearStage();
    } catch (e: any) {
      if (optimistic) clearStage();
      Alert.alert('Could not update', e?.message || 'Try again.');
    }
  };

  const doNext = () => {
    if (next.act === 'send') return up({ sheet: true });
    if (next.act === 'approve') return setEstimateStatus('Approved', 'Approved');
    if (next.act === 'invoice') return generateInvoice();
    if (next.act === 'paid') return setInvoiceStatus('Paid', 'Paid');
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

        {tab === 'quote' && <QuoteTab items={items} totals={quoteTotals} go={go} photos={detail?.photoUrls || []} />}
        {tab === 'invoice' && <InvoiceTab stage={stage} items={items} totals={invoiceTotals} client={realClient} company={company} invoice={inv} genning={genningInv} onGen={generateInvoice} setSheet={(b: boolean) => up({ sheet: b })} />}
        {tab === 'contract' && <ContractTab agreement={detail?.agreement || null} hasInvoice={!!inv} totals={invoiceTotals} depositPercent={inv?.depositPercent ?? 25} company={company} genning={genningContract} onGenerate={generateContract} />}
        {tab === 'progress' && <ProgressTab projectId={projectId} estimateId={est?.id || null} userId={user?.id || null} />}
      </ScrollView>

      <SendSheet
        open={store.sheet}
        onClose={() => up({ sheet: false })}
        what={tab === 'invoice' ? 'invoice' : tab === 'contract' ? 'contract' : 'quote'}
        onSent={(option: string) => {
          up({ sheet: false });
          const kind = tab === 'invoice' ? 'invoice' : tab === 'contract' ? 'contract' : 'quote';
          const tt = kind === 'invoice' ? invoiceTotals : quoteTotals;
          const co = (company as any) || {};
          sendDoc(option, {
            kind,
            docLabel: kind === 'invoice' ? 'Invoice' : kind === 'contract' ? 'Agreement' : 'Quote',
            number: kind === 'invoice' ? inv?.number : undefined,
            company: { name: co.company_name || 'Your company', license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email },
            client: realClient,
            items,
            totals: tt,
          });
          if (kind === 'quote') setEstimateStatus('Sent', 'Sent');
          else if (kind === 'invoice') setInvoiceStatus('Sent');
        }}
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

function QuoteTab({ items, totals, go, photos }: { items: LineItem[]; totals: Totals; go: NavProp['go']; photos: string[] }) {
  return (
    <View style={{ marginTop: 16 }}>
      {photos.length ? (
        <>
          <SectionTitle title={`Photos · ${photos.length}`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
            {photos.map((u, i) => (
              <Image key={i} source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: colors.chipBg }} />
            ))}
          </ScrollView>
        </>
      ) : null}
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
        <TotRow label="Subtotal" value={fmt(totals.subtotal)} />
        <TotRow label={`Tax (${totals.taxRate}% on ${fmt(totals.taxableSubtotal)})`} value={fmt(totals.tax)} />
        <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>Total</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
        </Between>
      </Card>
    </View>
  );
}

function InvoiceTab({ stage, items, totals, client, company, invoice, genning, onGen, setSheet }: { stage: Stage; items: LineItem[]; totals: Totals; client: JobDetail['client']; company?: any; invoice?: JobDetail['invoice']; genning: boolean; onGen: () => void; setSheet: (b: boolean) => void }) {
  const has = !!invoice || ['Invoiced', 'Paid'].includes(stage);
  const deposit = invoice?.depositPercent ?? 25;
  const co = company || {};
  const coName = co.company_name || 'Your company';
  // real issued / due dates (Net 15 from issue)
  const issued = invoice?.created ? new Date(invoice.created) : new Date();
  const due = new Date(issued);
  due.setDate(due.getDate() + 15);
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!has) {
    return (
      <View style={{ marginTop: 16, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="receipt" size={30} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>No invoice yet</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Generate a professional invoice from this quote. Totals stay in sync automatically.</Text>
        <Btn title={genning ? 'Generating…' : 'Generate invoice'} icon={genning ? undefined : 'receipt'} disabled={genning} onPress={onGen} style={{ marginTop: 20, maxWidth: 240 }} />
      </View>
    );
  }
  const depAmt = totals.total * (deposit / 100);
  const balance = totals.total - depAmt;
  const paid = invoice?.status === 'Paid' || stage === 'Paid';
  return (
    <View style={{ marginTop: 16 }}>
      <Card style={{ overflow: 'hidden', ...shadow.card }}>
        {/* head */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Between>
            <Row style={{ gap: 11, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: '#fff' }}>{(coName[0] || 'P').toUpperCase()}</Text>
              </View>
              <View>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{coName}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{co.company_license || ''}</Text>
              </View>
            </Row>
            <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: paid ? colors.successTint : colors.warningTint }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: paid ? colors.success : colors.warning }}>{paid ? 'PAID' : 'DUE'}</Text>
            </View>
          </Between>
          <Between style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <View><DpLab text="Invoice" /><Text style={{ fontFamily: fonts.num, fontSize: 14, color: colors.muted, marginTop: 3 }}>{invoice?.number || 'INV-2026-0001'}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><DpLab text="Issued · Due" /><Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink, marginTop: 3 }}>{md(issued)} · {md(due)}</Text></View>
          </Between>
        </View>
        {/* parties */}
        <View style={{ flexDirection: 'row', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <DpLab text="From" />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{coName}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{[co.company_address, [co.default_city, co.default_state].filter(Boolean).join(', '), co.company_phone].filter(Boolean).join('\n')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <DpLab text="Bill to" />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{client?.name || 'No client'}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{[client?.addr, client?.city, client?.email].filter(Boolean).join('\n')}</Text>
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
          <TotRow label="Subtotal" value={fmt(totals.subtotal)} />
          <TotRow label={`Tax (${totals.taxRate}% on ${fmt(totals.taxableSubtotal)})`} value={fmt(totals.tax)} />
          <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>Total due</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
          </Between>
          <View style={{ marginTop: 10 }}>
            <TotRow label={`Deposit (${deposit}%)`} value={fmt(depAmt)} />
            <TotRow label={paid ? 'Paid' : 'Balance due'} value={paid ? fmt(totals.total) : fmt(balance)} color={paid ? colors.success : colors.ink} />
          </View>
        </View>
      </Card>
      <Row style={{ gap: 6, marginTop: 12, paddingHorizontal: 4 }}>
        <Icon name="card" size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, flex: 1, lineHeight: 18 }}>Pay by card, ACH or check. Terms: Net 15 from issue date.</Text>
      </Row>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" icon="pdf" title="PDF" onPress={() => setSheet(true)} style={{ flex: 0.4 }} />
        <Btn title="Send invoice" icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
const DpLab = ({ text }: { text: string }) => <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1, color: colors.faint }}>{text.toUpperCase()}</Text>;

function ContractTab({ agreement, hasInvoice, totals, depositPercent, company, genning, onGenerate }: { agreement: JobDetail['agreement']; hasInvoice: boolean; totals: Totals; depositPercent: number; company?: any; genning: boolean; onGenerate: () => void }) {
  const coName = company?.company_name || 'Your company';
  const signed = agreement?.status === 'signed';
  const sent = !!agreement && !signed;
  const deposit = totals.total * (depositPercent / 100);
  const statusLabel = signed ? 'SIGNED' : sent ? 'SENT' : 'DRAFT';
  const statusColor = signed ? colors.success : sent ? colors.accentInk : '#8A93A3';
  const statusBg = signed ? colors.successTint : sent ? colors.accentTint : '#EEF0F3';

  if (!hasInvoice) {
    return (
      <View style={{ marginTop: 16, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="signature" size={30} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>Invoice needed first</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Generate the invoice, then create a service agreement for the client to sign.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Card pad>
        <Between>
          <Row style={{ gap: 11, flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="signature" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>Service agreement</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{coName}</Text>
            </View>
          </Row>
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: statusBg }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: statusColor }}>{statusLabel}</Text>
          </View>
        </Between>
        <Divider />
        <Between>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Required deposit ({depositPercent}%)</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>{fmt(deposit)}</Text>
        </Between>
        <Between style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Signature</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: signed ? colors.success : colors.ink }}>
            {signed ? `Signed by ${agreement?.signedName || 'client'}` : sent ? 'Awaiting client' : 'Not sent yet'}
          </Text>
        </Between>
        {signed && agreement?.signedDate ? (
          <Between style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Signed on</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>{new Date(agreement.signedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          </Between>
        ) : null}
      </Card>

      <Card pad style={{ marginTop: 12, backgroundColor: colors.card2 }}>
        <Row style={{ gap: 6 }}>
          <Icon name="shield" size={14} color={colors.accentInk} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>Secure e-signature</Text>
        </Row>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 19 }}>
          {signed
            ? 'The client signed the agreement online — recorded with date and IP.'
            : 'The client gets a secure link to review and sign on their phone — legally binding under the ESIGN Act.'}
        </Text>
      </Card>

      {!signed ? (
        <Btn title={genning ? 'Working…' : sent ? 'Resend signing link' : 'Generate & send contract'} icon={genning ? undefined : 'send'} disabled={genning} onPress={onGenerate} style={{ marginTop: 16 }} />
      ) : (
        <Btn variant="ghost" title="Share signed link" icon="share" onPress={onGenerate} style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

const PHASE_STAT: Record<PhaseStatus, [string, string, string]> = {
  completed: [colors.success, colors.successTint, 'Done'],
  in_progress: [colors.info, colors.infoTint, 'In progress'],
  not_started: [colors.faint, colors.bg, 'Not started'],
};
const NEXT_PHASE_STATUS: Record<PhaseStatus, PhaseStatus> = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' };

function ProgressTab({ projectId, estimateId, userId }: { projectId: string | null; estimateId: string | null; userId: string | null }) {
  const qc = useQueryClient();
  const { data: phases = [], isLoading } = useQuery({ queryKey: ['phases', projectId], queryFn: () => fetchPhases(projectId!), enabled: !!projectId });
  const [sheet, setSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['phases', projectId] });

  if (!projectId) {
    return <View style={{ marginTop: 16 }}><Empty icon="layers" title="Save the job first" body="Create the estimate, then track the work in phases the client can follow." /></View>;
  }

  const addPhase = async () => {
    if (!userId || !estimateId) { Alert.alert('Estimate needed', 'Generate the estimate first, then add phases.'); return; }
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const nextOrder = phases.length ? Math.max(...phases.map((p) => p.order)) + 1 : 0;
      await createPhase(userId, projectId, estimateId, newName.trim(), nextOrder);
      setNewName('');
      setSheet(false);
      refresh();
    } catch (e: any) {
      Alert.alert('Could not add phase', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const cycleStatus = async (p: ProgressPhase) => {
    const next = NEXT_PHASE_STATUS[p.status];
    // optimistic: update the cache now so quick taps read the new status (no "swallowed" taps)
    qc.setQueryData(['phases', projectId], (old?: ProgressPhase[]) => (old || []).map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    try {
      await updatePhase(p.id, { status: next });
      refresh();
    } catch (e: any) {
      refresh(); // revert to the DB truth
      Alert.alert('Could not update', e?.message || 'Try again.');
    }
  };

  const removePhase = (p: ProgressPhase) => {
    Alert.alert('Delete phase?', `Remove "${p.name}" and its photos? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deletePhase(p.id); refresh(); } catch (e: any) { Alert.alert('Error', e?.message || 'Could not delete.'); } } },
    ]);
  };

  const addPhotos = async (p: ProgressPhase) => {
    if (!userId) return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8, selectionLimit: 10 });
    if (res.canceled || !res.assets?.length) return;
    try {
      const n = await addPhasePhotos(userId, projectId, p.id, res.assets.map((a) => ({ uri: a.uri })));
      refresh();
      if (!n) Alert.alert('Upload failed', 'No photos were added. Try again.');
    } catch (e: any) {
      Alert.alert('Could not add photos', e?.message || 'Try again.');
    }
  };

  const shareWithClient = async () => {
    if (!userId) return;
    setSharing(true);
    try {
      const token = await ensureShareToken(userId, projectId);
      await Share.share({ message: `Track your project's progress here:\n${progressLink(token)}` });
    } catch (e: any) {
      Alert.alert('Could not create the link', e?.message || 'Try again.');
    } finally {
      setSharing(false);
    }
  };

  const done = phases.filter((p) => p.status === 'completed').length;

  return (
    <View style={{ marginTop: 16 }}>
      <Between style={{ marginBottom: 14 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{phases.length ? `${done} of ${phases.length} phases` : 'Work phases'}</Text>
        <Pressable onPress={shareWithClient} disabled={sharing} hitSlop={8}>
          <Row style={{ gap: 5 }}>
            <Icon name="link" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{sharing ? 'Working…' : 'Client link'}</Text>
          </Row>
        </Pressable>
      </Between>

      {isLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : phases.length === 0 ? (
        <Card pad style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>No phases yet. Add the first one to start tracking the work — your client follows it through the shared link.</Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {phases.map((p, i) => {
            const [c, bg, lab] = PHASE_STAT[p.status];
            return (
              <Card key={p.id} pad>
                <Between>
                  <Row style={{ gap: 11, flex: 1 }}>
                    <Pressable onPress={() => cycleStatus(p)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                      {p.status === 'completed' ? <Icon name="check" size={17} sw={3} color={c} /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: c }}>{i + 1}</Text>}
                    </Pressable>
                    <Pressable onPress={() => cycleStatus(p)} style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{p.name}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: c }}>{lab} · tap to advance</Text>
                    </Pressable>
                  </Row>
                  <Pressable onPress={() => removePhase(p)} hitSlop={8}><Icon name="trash" size={16} color={colors.faint} /></Pressable>
                </Between>
                {p.notes ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 19 }}>{p.notes}</Text> : null}
                {p.photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
                    {p.photos.map((ph) => <Image key={ph.id} source={{ uri: ph.url }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.chipBg }} />)}
                  </ScrollView>
                ) : null}
                <Btn variant="ghost" sm icon="camera" title={p.photos.length ? 'Add more photos' : 'Add progress photos'} onPress={() => addPhotos(p)} style={{ marginTop: 12 }} />
              </Card>
            );
          })}
        </View>
      )}

      <Btn icon="plus" title="Add phase" variant="soft" onPress={() => setSheet(true)} style={{ marginTop: 14 }} />

      <Sheet open={sheet} onClose={() => setSheet(false)} title="New phase" sub="e.g. Prep & masking, Priming, Top coat, Final walkthrough.">
        <Field label="Phase name"><Input value={newName} onChangeText={setNewName} placeholder="Phase name" autoFocus /></Field>
        <Btn title={busy ? 'Adding…' : 'Add phase'} disabled={busy} onPress={addPhase} />
      </Sheet>
    </View>
  );
}
