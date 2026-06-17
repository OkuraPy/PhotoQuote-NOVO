// PhotoQuote v2 — Job screen: timeline + Quote / Invoice / Contract / Progress tabs
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow, Stage } from '../theme';
import { calcTotals, fmt, LineItem, split, STAGES } from '../data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addPhaseComment, addPhasePhotos, agreementLink, createAgreement, createInvoice, createPhase, deletePhase, deriveStage, ensureShareToken, fetchCompanyProfile, fetchJobDetail, fetchPhases, JobDetail, progressLink, ProgressPhase, PhaseStatus, updateEstimateStatus, updateInvoiceStatus, updatePhase } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sendDoc } from '../lib/send';
import { registerStrings, useT } from '../lib/i18n';
import { Between, Btn, Card, CatChip, Divider, Empty, Field, Input, Nav, NavBtn, Row, SectionTitle, SendSheet, Sheet, StageChip, useStore } from '../ui';

registerStrings({
  // NEXT STEP labels (keyed by stage action; Stage values themselves are not translated)
  'job.nextStep': { en: 'NEXT STEP', es: 'SIGUIENTE PASO', pt: 'PRÓXIMO PASSO' },
  'job.next.send': { en: 'Send quote', es: 'Enviar cotización', pt: 'Enviar orçamento' },
  'job.next.approve': { en: 'Mark approved', es: 'Marcar aprobada', pt: 'Marcar aprovado' },
  'job.next.invoice': { en: 'Generate invoice', es: 'Generar factura', pt: 'Gerar fatura' },
  'job.next.paid': { en: 'Mark paid', es: 'Marcar pagada', pt: 'Marcar pago' },
  'job.next.done': { en: 'Paid in full', es: 'Pagada por completo', pt: 'Pago integralmente' },
  // header / labels
  'job.noClient': { en: 'No client', es: 'Sin cliente', pt: 'Sem cliente' },
  'job.newEstimate': { en: 'New estimate', es: 'Nueva cotización', pt: 'Novo orçamento' },
  'job.jobSuffix': { en: '{svc} job', es: 'Trabajo de {svc}', pt: 'Trabalho de {svc}' },
  'job.noAddress': { en: 'No address yet', es: 'Aún sin dirección', pt: 'Sem endereço ainda' },
  // tabs
  'job.tab.quote': { en: 'Quote', es: 'Cotización', pt: 'Orçamento' },
  'job.tab.invoice': { en: 'Invoice', es: 'Factura', pt: 'Fatura' },
  'job.tab.contract': { en: 'Contract', es: 'Contrato', pt: 'Contrato' },
  'job.tab.progress': { en: 'Progress', es: 'Progreso', pt: 'Progresso' },
  // alerts
  'job.alert.estimateNeeded': { en: 'Estimate needed', es: 'Se necesita la cotización', pt: 'Orçamento necessário' },
  'job.alert.saveEstimateFirst': { en: 'Save the estimate first, then generate the invoice.', es: 'Guarda primero la cotización y luego genera la factura.', pt: 'Salve o orçamento primeiro e depois gere a fatura.' },
  'job.alert.couldNotCreateInvoice': { en: 'Could not create the invoice', es: 'No se pudo crear la factura', pt: 'Não foi possível criar a fatura' },
  'job.alert.invoiceNeeded': { en: 'Invoice needed', es: 'Se necesita la factura', pt: 'Fatura necessária' },
  'job.alert.generateInvoiceFirst': { en: 'Generate the invoice first, then the contract.', es: 'Genera primero la factura y luego el contrato.', pt: 'Gere a fatura primeiro e depois o contrato.' },
  'job.alert.couldNotCreateContract': { en: 'Could not create the contract', es: 'No se pudo crear el contrato', pt: 'Não foi possível criar o contrato' },
  'job.alert.couldNotUpdate': { en: 'Could not update', es: 'No se pudo actualizar', pt: 'Não foi possível atualizar' },
  'job.alert.tryAgain': { en: 'Try again.', es: 'Inténtalo de nuevo.', pt: 'Tente novamente.' },
  // share messages
  'job.share.contract': { en: 'Please review and sign your service agreement:\n{link}', es: 'Por favor revisa y firma tu contrato de servicio:\n{link}', pt: 'Por favor, revise e assine seu contrato de serviço:\n{link}' },
  'job.share.progress': { en: "Track your project's progress here:\n{link}", es: 'Sigue el progreso de tu proyecto aquí:\n{link}', pt: 'Acompanhe o progresso do seu projeto aqui:\n{link}' },
  // send doc labels
  'job.doc.invoice': { en: 'Invoice', es: 'Factura', pt: 'Fatura' },
  'job.doc.agreement': { en: 'Agreement', es: 'Contrato', pt: 'Contrato' },
  'job.doc.quote': { en: 'Quote', es: 'Cotización', pt: 'Orçamento' },
  'job.yourCompany': { en: 'Your company', es: 'Tu empresa', pt: 'Sua empresa' },
  // QuoteTab
  'job.photos': { en: 'Photos · {n}', es: 'Fotos · {n}', pt: 'Fotos · {n}' },
  'job.lineItems': { en: 'Line items', es: 'Conceptos', pt: 'Itens' },
  'job.edit': { en: 'Edit', es: 'Editar', pt: 'Editar' },
  'job.taxable': { en: 'Taxable', es: 'Gravable', pt: 'Tributável' },
  'job.noTax': { en: 'No tax', es: 'Sin impuesto', pt: 'Sem imposto' },
  'job.subtotal': { en: 'Subtotal', es: 'Subtotal', pt: 'Subtotal' },
  'job.tax': { en: 'Tax ({rate}% on {amount})', es: 'Impuesto ({rate}% sobre {amount})', pt: 'Imposto ({rate}% sobre {amount})' },
  'job.total': { en: 'Total', es: 'Total', pt: 'Total' },
  // InvoiceTab
  'job.noInvoiceYet': { en: 'No invoice yet', es: 'Aún no hay factura', pt: 'Nenhuma fatura ainda' },
  'job.invoiceFromQuote': { en: 'Generate a professional invoice from this quote. Totals stay in sync automatically.', es: 'Genera una factura profesional a partir de esta cotización. Los totales se mantienen sincronizados automáticamente.', pt: 'Gere uma fatura profissional a partir deste orçamento. Os totais permanecem sincronizados automaticamente.' },
  'job.generating': { en: 'Generating…', es: 'Generando…', pt: 'Gerando…' },
  'job.generateInvoice': { en: 'Generate invoice', es: 'Generar factura', pt: 'Gerar fatura' },
  'job.paidBadge': { en: 'PAID', es: 'PAGADA', pt: 'PAGA' },
  'job.dueBadge': { en: 'DUE', es: 'POR PAGAR', pt: 'A VENCER' },
  'job.invoiceLabel': { en: 'Invoice', es: 'Factura', pt: 'Fatura' },
  'job.issuedDue': { en: 'Issued · Due', es: 'Emitida · Vence', pt: 'Emitida · Vence' },
  'job.from': { en: 'From', es: 'De', pt: 'De' },
  'job.billTo': { en: 'Bill to', es: 'Facturar a', pt: 'Faturar para' },
  'job.totalDue': { en: 'Total due', es: 'Total a pagar', pt: 'Total a pagar' },
  'job.deposit': { en: 'Deposit ({pct}%)', es: 'Depósito ({pct}%)', pt: 'Entrada ({pct}%)' },
  'job.paid': { en: 'Paid', es: 'Pagado', pt: 'Pago' },
  'job.balanceDue': { en: 'Balance due', es: 'Saldo pendiente', pt: 'Saldo devedor' },
  'job.payTerms': { en: 'Pay by card, ACH or check. Terms: Net 15 from issue date.', es: 'Paga con tarjeta, ACH o cheque. Plazo: Neto 15 desde la fecha de emisión.', pt: 'Pague com cartão, ACH ou cheque. Prazo: 15 dias da emissão.' },
  'job.pdf': { en: 'PDF', es: 'PDF', pt: 'PDF' },
  'job.sendInvoice': { en: 'Send invoice', es: 'Enviar factura', pt: 'Enviar fatura' },
  // ContractTab
  'job.invoiceNeededFirst': { en: 'Invoice needed first', es: 'Primero se necesita la factura', pt: 'Fatura necessária primeiro' },
  'job.contractIntro': { en: 'Generate the invoice, then create a service agreement for the client to sign.', es: 'Genera la factura y luego crea un contrato de servicio para que el cliente lo firme.', pt: 'Gere a fatura e depois crie um contrato de serviço para o cliente assinar.' },
  'job.serviceAgreement': { en: 'Service agreement', es: 'Contrato de servicio', pt: 'Contrato de serviço' },
  'job.statusSigned': { en: 'SIGNED', es: 'FIRMADO', pt: 'ASSINADO' },
  'job.statusSent': { en: 'SENT', es: 'ENVIADO', pt: 'ENVIADO' },
  'job.statusDraft': { en: 'DRAFT', es: 'BORRADOR', pt: 'RASCUNHO' },
  'job.requiredDeposit': { en: 'Required deposit ({pct}%)', es: 'Depósito requerido ({pct}%)', pt: 'Entrada obrigatória ({pct}%)' },
  'job.signature': { en: 'Signature', es: 'Firma', pt: 'Assinatura' },
  'job.signedBy': { en: 'Signed by {name}', es: 'Firmado por {name}', pt: 'Assinado por {name}' },
  'job.client': { en: 'client', es: 'cliente', pt: 'cliente' },
  'job.awaitingClient': { en: 'Awaiting client', es: 'Esperando al cliente', pt: 'Aguardando o cliente' },
  'job.notSentYet': { en: 'Not sent yet', es: 'Aún no enviado', pt: 'Ainda não enviado' },
  'job.signedOn': { en: 'Signed on', es: 'Firmado el', pt: 'Assinado em' },
  'job.secureEsignature': { en: 'Secure e-signature', es: 'Firma electrónica segura', pt: 'Assinatura eletrônica segura' },
  'job.esignSigned': { en: 'The client signed the agreement online — recorded with date and IP.', es: 'El cliente firmó el contrato en línea, registrado con fecha e IP.', pt: 'O cliente assinou o contrato online — registrado com data e IP.' },
  'job.esignPending': { en: 'The client gets a secure link to review and sign on their phone — legally binding under the ESIGN Act.', es: 'El cliente recibe un enlace seguro para revisar y firmar desde su teléfono, con validez legal bajo la Ley ESIGN.', pt: 'O cliente recebe um link seguro para revisar e assinar pelo celular — com validade legal sob a Lei ESIGN.' },
  'job.working': { en: 'Working…', es: 'Procesando…', pt: 'Processando…' },
  'job.resendSigningLink': { en: 'Resend signing link', es: 'Reenviar enlace de firma', pt: 'Reenviar link de assinatura' },
  'job.generateSendContract': { en: 'Generate & send contract', es: 'Generar y enviar contrato', pt: 'Gerar e enviar contrato' },
  'job.shareSignedLink': { en: 'Share signed link', es: 'Compartir enlace firmado', pt: 'Compartilhar link assinado' },
  // ProgressTab — phase statuses
  'job.phase.done': { en: 'Done', es: 'Hecho', pt: 'Concluído' },
  'job.phase.inProgress': { en: 'In progress', es: 'En curso', pt: 'Em andamento' },
  'job.phase.notStarted': { en: 'Not started', es: 'No iniciado', pt: 'Não iniciado' },
  // ProgressTab — alerts & empties
  'job.alert.couldNotSend': { en: 'Could not send', es: 'No se pudo enviar', pt: 'Não foi possível enviar' },
  'job.empty.saveJobTitle': { en: 'Save the job first', es: 'Guarda primero el trabajo', pt: 'Salve o trabalho primeiro' },
  'job.empty.saveJobBody': { en: 'Create the estimate, then track the work in phases the client can follow.', es: 'Crea la cotización y luego haz seguimiento del trabajo en fases que el cliente pueda seguir.', pt: 'Crie o orçamento e depois acompanhe o trabalho em fases que o cliente pode seguir.' },
  'job.alert.generateEstimateFirst': { en: 'Generate the estimate first, then add phases.', es: 'Genera primero la cotización y luego agrega fases.', pt: 'Gere o orçamento primeiro e depois adicione fases.' },
  'job.alert.couldNotAddPhase': { en: 'Could not add phase', es: 'No se pudo agregar la fase', pt: 'Não foi possível adicionar a fase' },
  'job.alert.deletePhaseTitle': { en: 'Delete phase?', es: '¿Eliminar fase?', pt: 'Excluir fase?' },
  'job.alert.deletePhaseBody': { en: 'Remove "{name}" and its photos? This can\'t be undone.', es: '¿Eliminar "{name}" y sus fotos? Esto no se puede deshacer.', pt: 'Remover "{name}" e suas fotos? Isso não pode ser desfeito.' },
  'job.cancel': { en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' },
  'job.delete': { en: 'Delete', es: 'Eliminar', pt: 'Excluir' },
  'job.error': { en: 'Error', es: 'Error', pt: 'Erro' },
  'job.couldNotDelete': { en: 'Could not delete.', es: 'No se pudo eliminar.', pt: 'Não foi possível excluir.' },
  'job.alert.uploadFailed': { en: 'Upload failed', es: 'Error al subir', pt: 'Falha no envio' },
  'job.alert.noPhotosAdded': { en: 'No photos were added. Try again.', es: 'No se agregaron fotos. Inténtalo de nuevo.', pt: 'Nenhuma foto foi adicionada. Tente novamente.' },
  'job.alert.couldNotAddPhotos': { en: 'Could not add photos', es: 'No se pudieron agregar las fotos', pt: 'Não foi possível adicionar as fotos' },
  'job.alert.couldNotCreateLink': { en: 'Could not create the link', es: 'No se pudo crear el enlace', pt: 'Não foi possível criar o link' },
  // ProgressTab — UI
  'job.phasesCount': { en: '{done} of {total} phases', es: '{done} de {total} fases', pt: '{done} de {total} fases' },
  'job.workPhases': { en: 'Work phases', es: 'Fases del trabajo', pt: 'Fases do trabalho' },
  'job.clientLink': { en: 'Client link', es: 'Enlace del cliente', pt: 'Link do cliente' },
  'job.noPhasesYet': { en: 'No phases yet. Add the first one to start tracking the work — your client follows it through the shared link.', es: 'Aún no hay fases. Agrega la primera para empezar a hacer seguimiento del trabajo; tu cliente la sigue a través del enlace compartido.', pt: 'Nenhuma fase ainda. Adicione a primeira para começar a acompanhar o trabalho — seu cliente acompanha pelo link compartilhado.' },
  'job.tapToAdvance': { en: '{label} · tap to advance', es: '{label} · toca para avanzar', pt: '{label} · toque para avançar' },
  'job.addMorePhotos': { en: 'Add more photos', es: 'Agregar más fotos', pt: 'Adicionar mais fotos' },
  'job.addProgressPhotos': { en: 'Add progress photos', es: 'Agregar fotos de progreso', pt: 'Adicionar fotos de progresso' },
  'job.commentsCount': { en: 'Comments · {n}', es: 'Comentarios · {n}', pt: 'Comentários · {n}' },
  'job.comments': { en: 'Comments', es: 'Comentarios', pt: 'Comentários' },
  'job.adding': { en: 'Adding…', es: 'Agregando…', pt: 'Adicionando…' },
  'job.addPhase': { en: 'Add phase', es: 'Agregar fase', pt: 'Adicionar fase' },
  'job.newPhase': { en: 'New phase', es: 'Nueva fase', pt: 'Nova fase' },
  'job.newPhaseSub': { en: 'e.g. Prep & masking, Priming, Top coat, Final walkthrough.', es: 'p. ej. Preparación y enmascarado, Imprimación, Capa final, Revisión final.', pt: 'ex.: Preparação e mascaramento, Primer, Demão final, Vistoria final.' },
  'job.phaseName': { en: 'Phase name', es: 'Nombre de la fase', pt: 'Nome da fase' },
  'job.commentClient': { en: 'CLIENT', es: 'CLIENTE', pt: 'CLIENTE' },
  'job.commentYou': { en: 'YOU', es: 'TÚ', pt: 'VOCÊ' },
  'job.noCommentsYet': { en: 'No comments yet. Your client can comment from the shared progress link.', es: 'Aún no hay comentarios. Tu cliente puede comentar desde el enlace de progreso compartido.', pt: 'Nenhum comentário ainda. Seu cliente pode comentar pelo link de progresso compartilhado.' },
  'job.writeReply': { en: 'Write a reply…', es: 'Escribe una respuesta…', pt: 'Escreva uma resposta…' },
  'job.send': { en: 'Send', es: 'Enviar', pt: 'Enviar' },
  'job.companyFallback': { en: 'You', es: 'Tú', pt: 'Você' },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
type Totals = { subtotal: number; taxableSubtotal: number; tax: number; total: number; taxRate: number };

// NEXT maps each stage to its action + icon; the label is resolved at render via t('job.next.<act>').
const NEXT: Record<Stage, { ico: string; act: string }> = {
  Draft: { ico: 'send', act: 'send' },
  Quoted: { ico: 'send', act: 'send' },
  Sent: { ico: 'check', act: 'approve' },
  Approved: { ico: 'receipt', act: 'invoice' },
  Invoiced: { ico: 'wallet', act: 'paid' },
  Paid: { ico: 'checkCircle', act: 'done' },
};

function Timeline({ stage }: { stage: Stage }) {
  const t = useT();
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
            <Text style={{ fontFamily: fonts.bold, fontSize: 9.5, color: current ? colors.primary : colors.muted, textAlign: 'center' }}>{t('stage.' + s)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function JobScreen({ go, back, params }: NavProp) {
  const t = useT();
  const { store, up } = useStore();
  const job = params?.job || null;
  const client = job ? null : store.aSel || null; // existing job uses realClient (from detail); new job uses the picked client
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
  const name = job ? job.title : store.svcs[0] ? t('job.jobSuffix', { svc: store.svcs[0] }) : t('job.newEstimate');
  const cName = job ? job.client || t('job.noClient') : client?.name || t('job.noClient');
  const addr = job ? job.addr : client?.addr || store.aLoc?.city || t('job.noAddress');
  const next = NEXT[stage];
  const queryClient = useQueryClient();
  const [genningInv, setGenningInv] = useState(false);

  // generate a real invoice from the saved estimate (copies its totals; sequential number)
  const generateInvoice = async () => {
    if (inv) { clearStage(); setTab('invoice'); return; }
    if (!user?.id || !est?.id || !projectId) { Alert.alert(t('job.alert.estimateNeeded'), t('job.alert.saveEstimateFirst')); return; }
    setGenningInv(true);
    try {
      await createInvoice(user.id, est.id, projectId);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      clearStage(); // invoice now exists → DB-derived stage becomes "Invoiced"
      setTab('invoice');
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotCreateInvoice'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setGenningInv(false);
    }
  };

  // contract / service agreement → generate (from the invoice) and share the signing link
  const [genningContract, setGenningContract] = useState(false);
  const shareContract = async (token: string) => {
    try {
      await Share.share({ message: t('job.share.contract', { link: agreementLink(token) }) });
    } catch {
      /* user dismissed the share sheet */
    }
  };
  const generateContract = async () => {
    if (detail?.agreement) return shareContract(detail.agreement.token);
    if (!inv) { Alert.alert(t('job.alert.invoiceNeeded'), t('job.alert.generateInvoiceFirst')); return; }
    if (!user?.id || !projectId) return;
    setGenningContract(true);
    try {
      const { token } = await createAgreement(user.id, projectId, inv.id);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await shareContract(token);
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotCreateContract'), e?.message || t('job.alert.tryAgain'));
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
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
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
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
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
      <Nav title={cName || t('job.noClient')} sub={name} center onBack={back} right={<NavBtn icon="more" size={18} />} />
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
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.primary }}>{t('job.nextStep')}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 2 }}>{t('job.next.' + next.act)}</Text>
            </View>
            <Btn title={t('job.next.' + next.act)} sm onPress={doNext} />
          </View>
        ) : null}

        {/* internal tabs */}
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#EEF1F4', borderRadius: 14, marginTop: 16 }}>
          {['quote', 'invoice', 'contract', 'progress'].map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[{ flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tab === k && { backgroundColor: colors.card, ...shadow.sm }]}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: tab === k ? colors.ink : colors.muted }}>{t('job.tab.' + k)}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'quote' && <QuoteTab items={items} totals={quoteTotals} go={go} photos={detail?.photoUrls || []} />}
        {tab === 'invoice' && <InvoiceTab stage={stage} items={items} totals={invoiceTotals} client={realClient} company={company} invoice={inv} genning={genningInv} onGen={generateInvoice} setSheet={(b: boolean) => up({ sheet: b })} />}
        {tab === 'contract' && <ContractTab agreement={detail?.agreement || null} hasInvoice={!!inv} totals={invoiceTotals} depositPercent={inv?.depositPercent ?? 25} company={company} genning={genningContract} onGenerate={generateContract} />}
        {tab === 'progress' && <ProgressTab projectId={projectId} estimateId={est?.id || null} userId={user?.id || null} companyName={(company as any)?.company_name || t('job.companyFallback')} />}
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
            docLabel: kind === 'invoice' ? t('job.doc.invoice') : kind === 'contract' ? t('job.doc.agreement') : t('job.doc.quote'),
            number: kind === 'invoice' ? inv?.number : undefined,
            company: { name: co.company_name || t('job.yourCompany'), license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email },
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
  const t = useT();
  return (
    <View style={{ marginTop: 16 }}>
      {photos.length ? (
        <>
          <SectionTitle title={t('job.photos', { n: photos.length })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
            {photos.map((u, i) => (
              <Image key={i} source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: colors.chipBg }} />
            ))}
          </ScrollView>
        </>
      ) : null}
      <SectionTitle title={t('job.lineItems')} link={t('job.edit')} onLink={() => go('estimate', {})} />
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
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: it.taxable ? colors.primary : colors.faint }}>{it.taxable ? t('job.taxable') : t('job.noTax')}</Text>
              </View>
            </Between>
          </Card>
        ))}
      </View>
      <Card style={{ padding: 16, marginTop: 16 }}>
        <TotRow label={t('job.subtotal')} value={fmt(totals.subtotal)} />
        <TotRow label={t('job.tax', { rate: totals.taxRate, amount: fmt(totals.taxableSubtotal) })} value={fmt(totals.tax)} />
        <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.total')}</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
        </Between>
      </Card>
    </View>
  );
}

function InvoiceTab({ stage, items, totals, client, company, invoice, genning, onGen, setSheet }: { stage: Stage; items: LineItem[]; totals: Totals; client: JobDetail['client']; company?: any; invoice?: JobDetail['invoice']; genning: boolean; onGen: () => void; setSheet: (b: boolean) => void }) {
  const t = useT();
  const has = !!invoice || ['Invoiced', 'Paid'].includes(stage);
  const deposit = invoice?.depositPercent ?? 25;
  const co = company || {};
  const coName = co.company_name || t('job.yourCompany');
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
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>{t('job.noInvoiceYet')}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{t('job.invoiceFromQuote')}</Text>
        <Btn title={genning ? t('job.generating') : t('job.generateInvoice')} icon={genning ? undefined : 'receipt'} disabled={genning} onPress={onGen} style={{ marginTop: 20, maxWidth: 240 }} />
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
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: paid ? colors.success : colors.warning }}>{paid ? t('job.paidBadge') : t('job.dueBadge')}</Text>
            </View>
          </Between>
          <Between style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <View><DpLab text={t('job.invoiceLabel')} /><Text style={{ fontFamily: fonts.num, fontSize: 14, color: colors.muted, marginTop: 3 }}>{invoice?.number || 'INV-2026-0001'}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><DpLab text={t('job.issuedDue')} /><Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink, marginTop: 3 }}>{md(issued)} · {md(due)}</Text></View>
          </Between>
        </View>
        {/* parties */}
        <View style={{ flexDirection: 'row', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <DpLab text={t('job.from')} />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{coName}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{[co.company_address, [co.default_city, co.default_state].filter(Boolean).join(', '), co.company_phone].filter(Boolean).join('\n')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <DpLab text={t('job.billTo')} />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 5 }}>{client?.name || t('job.noClient')}</Text>
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
          <TotRow label={t('job.subtotal')} value={fmt(totals.subtotal)} />
          <TotRow label={t('job.tax', { rate: totals.taxRate, amount: fmt(totals.taxableSubtotal) })} value={fmt(totals.tax)} />
          <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.totalDue')}</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
          </Between>
          <View style={{ marginTop: 10 }}>
            <TotRow label={t('job.deposit', { pct: deposit })} value={fmt(depAmt)} />
            <TotRow label={paid ? t('job.paid') : t('job.balanceDue')} value={paid ? fmt(totals.total) : fmt(balance)} color={paid ? colors.success : colors.ink} />
          </View>
        </View>
      </Card>
      <Row style={{ gap: 6, marginTop: 12, paddingHorizontal: 4 }}>
        <Icon name="card" size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, flex: 1, lineHeight: 18 }}>{t('job.payTerms')}</Text>
      </Row>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" icon="pdf" title={t('job.pdf')} onPress={() => setSheet(true)} style={{ flex: 0.4 }} />
        <Btn title={t('job.sendInvoice')} icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
const DpLab = ({ text }: { text: string }) => <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1, color: colors.faint }}>{text.toUpperCase()}</Text>;

function ContractTab({ agreement, hasInvoice, totals, depositPercent, company, genning, onGenerate }: { agreement: JobDetail['agreement']; hasInvoice: boolean; totals: Totals; depositPercent: number; company?: any; genning: boolean; onGenerate: () => void }) {
  const t = useT();
  const coName = company?.company_name || t('job.yourCompany');
  const signed = agreement?.status === 'signed';
  const sent = !!agreement && !signed;
  const deposit = totals.total * (depositPercent / 100);
  const statusLabel = signed ? t('job.statusSigned') : sent ? t('job.statusSent') : t('job.statusDraft');
  const statusColor = signed ? colors.success : sent ? colors.accentInk : '#8A93A3';
  const statusBg = signed ? colors.successTint : sent ? colors.accentTint : '#EEF0F3';

  if (!hasInvoice) {
    return (
      <View style={{ marginTop: 16, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="signature" size={30} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>{t('job.invoiceNeededFirst')}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{t('job.contractIntro')}</Text>
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
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{t('job.serviceAgreement')}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{coName}</Text>
            </View>
          </Row>
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: statusBg }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: statusColor }}>{statusLabel}</Text>
          </View>
        </Between>
        <Divider />
        <Between>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('job.requiredDeposit', { pct: depositPercent })}</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>{fmt(deposit)}</Text>
        </Between>
        <Between style={{ marginTop: 12 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('job.signature')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: signed ? colors.success : colors.ink }}>
            {signed ? t('job.signedBy', { name: agreement?.signedName || t('job.client') }) : sent ? t('job.awaitingClient') : t('job.notSentYet')}
          </Text>
        </Between>
        {signed && agreement?.signedDate ? (
          <Between style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('job.signedOn')}</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>{new Date(agreement.signedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          </Between>
        ) : null}
      </Card>

      <Card pad style={{ marginTop: 12, backgroundColor: colors.card2 }}>
        <Row style={{ gap: 6 }}>
          <Icon name="shield" size={14} color={colors.accentInk} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{t('job.secureEsignature')}</Text>
        </Row>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 19 }}>
          {signed
            ? t('job.esignSigned')
            : t('job.esignPending')}
        </Text>
      </Card>

      {!signed ? (
        <Btn title={genning ? t('job.working') : sent ? t('job.resendSigningLink') : t('job.generateSendContract')} icon={genning ? undefined : 'send'} disabled={genning} onPress={onGenerate} style={{ marginTop: 16 }} />
      ) : (
        <Btn variant="ghost" title={t('job.shareSignedLink')} icon="share" onPress={onGenerate} style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

// [color, background, label-key] — the label is resolved at render via t(labelKey)
const PHASE_STAT: Record<PhaseStatus, [string, string, string]> = {
  completed: [colors.success, colors.successTint, 'job.phase.done'],
  in_progress: [colors.info, colors.infoTint, 'job.phase.inProgress'],
  not_started: [colors.faint, colors.bg, 'job.phase.notStarted'],
};
const NEXT_PHASE_STATUS: Record<PhaseStatus, PhaseStatus> = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' };

function ProgressTab({ projectId, estimateId, userId, companyName }: { projectId: string | null; estimateId: string | null; userId: string | null; companyName: string }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: phases = [], isLoading } = useQuery({ queryKey: ['phases', projectId], queryFn: () => fetchPhases(projectId!), enabled: !!projectId });
  const [sheet, setSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cmPhaseId, setCmPhaseId] = useState<string | null>(null);
  const [cmText, setCmText] = useState('');
  const [cmBusy, setCmBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['phases', projectId] });
  const cmPhase = phases.find((p) => p.id === cmPhaseId) || null;

  const addComment = async () => {
    if (!projectId || !cmPhase || !cmText.trim()) return;
    setCmBusy(true);
    try {
      await addPhaseComment(projectId, cmPhase.id, companyName, cmText.trim());
      setCmText('');
      refresh();
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotSend'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setCmBusy(false);
    }
  };

  if (!projectId) {
    return <View style={{ marginTop: 16 }}><Empty icon="layers" title={t('job.empty.saveJobTitle')} body={t('job.empty.saveJobBody')} /></View>;
  }

  const addPhase = async () => {
    if (!userId || !estimateId) { Alert.alert(t('job.alert.estimateNeeded'), t('job.alert.generateEstimateFirst')); return; }
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const nextOrder = phases.length ? Math.max(...phases.map((p) => p.order)) + 1 : 0;
      await createPhase(userId, projectId, estimateId, newName.trim(), nextOrder);
      setNewName('');
      setSheet(false);
      refresh();
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotAddPhase'), e?.message || t('job.alert.tryAgain'));
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
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
    }
  };

  const removePhase = (p: ProgressPhase) => {
    Alert.alert(t('job.alert.deletePhaseTitle'), t('job.alert.deletePhaseBody', { name: p.name }), [
      { text: t('job.cancel'), style: 'cancel' },
      { text: t('job.delete'), style: 'destructive', onPress: async () => { try { await deletePhase(p.id); refresh(); } catch (e: any) { Alert.alert(t('job.error'), e?.message || t('job.couldNotDelete')); } } },
    ]);
  };

  const addPhotos = async (p: ProgressPhase) => {
    if (!userId) return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8, selectionLimit: 10 });
    if (res.canceled || !res.assets?.length) return;
    try {
      const n = await addPhasePhotos(userId, projectId, p.id, res.assets.map((a) => ({ uri: a.uri })));
      refresh();
      if (!n) Alert.alert(t('job.alert.uploadFailed'), t('job.alert.noPhotosAdded'));
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotAddPhotos'), e?.message || t('job.alert.tryAgain'));
    }
  };

  const shareWithClient = async () => {
    if (!userId) return;
    setSharing(true);
    try {
      const token = await ensureShareToken(userId, projectId);
      await Share.share({ message: t('job.share.progress', { link: progressLink(token) }) });
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotCreateLink'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setSharing(false);
    }
  };

  const done = phases.filter((p) => p.status === 'completed').length;

  return (
    <View style={{ marginTop: 16 }}>
      <Between style={{ marginBottom: 14 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{phases.length ? t('job.phasesCount', { done, total: phases.length }) : t('job.workPhases')}</Text>
        <Pressable onPress={shareWithClient} disabled={sharing} hitSlop={8}>
          <Row style={{ gap: 5 }}>
            <Icon name="link" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{sharing ? t('job.working') : t('job.clientLink')}</Text>
          </Row>
        </Pressable>
      </Between>

      {isLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : phases.length === 0 ? (
        <Card pad style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>{t('job.noPhasesYet')}</Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {phases.map((p, i) => {
            const [c, bg, labKey] = PHASE_STAT[p.status];
            return (
              <Card key={p.id} pad>
                <Between>
                  <Row style={{ gap: 11, flex: 1 }}>
                    <Pressable onPress={() => cycleStatus(p)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                      {p.status === 'completed' ? <Icon name="check" size={17} sw={3} color={c} /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: c }}>{i + 1}</Text>}
                    </Pressable>
                    <Pressable onPress={() => cycleStatus(p)} style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{p.name}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: c }}>{t('job.tapToAdvance', { label: t(labKey) })}</Text>
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
                <Btn variant="ghost" sm icon="camera" title={p.photos.length ? t('job.addMorePhotos') : t('job.addProgressPhotos')} onPress={() => addPhotos(p)} style={{ marginTop: 12 }} />
                <Pressable onPress={() => setCmPhaseId(p.id)} style={{ marginTop: 10 }} hitSlop={6}>
                  <Row style={{ gap: 6 }}>
                    <Icon name="msg" size={14} color={colors.muted} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.muted }}>{p.comments.length ? t('job.commentsCount', { n: p.comments.length }) : t('job.comments')}</Text>
                    {p.comments.some((c) => c.authorType === 'client') ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.info }} /> : null}
                  </Row>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}

      <Btn icon="plus" title={t('job.addPhase')} variant="soft" onPress={() => setSheet(true)} style={{ marginTop: 14 }} />

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t('job.newPhase')} sub={t('job.newPhaseSub')}>
        <Field label={t('job.phaseName')}><Input value={newName} onChangeText={setNewName} placeholder={t('job.phaseName')} autoFocus /></Field>
        <Btn title={busy ? t('job.adding') : t('job.addPhase')} disabled={busy} onPress={addPhase} />
      </Sheet>

      <Sheet open={!!cmPhaseId} onClose={() => { setCmPhaseId(null); setCmText(''); }} title={t('job.comments')} sub={cmPhase?.name}>
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {cmPhase && cmPhase.comments.length ? (
            cmPhase.comments.map((c) => (
              <View key={c.id} style={{ backgroundColor: c.authorType === 'client' ? colors.bg : colors.primaryTint, borderRadius: 12, padding: 12 }}>
                <Row style={{ gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 12.5, color: c.authorType === 'client' ? colors.ink : colors.primary }}>{c.authorName}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, color: colors.faint }}>{c.authorType === 'client' ? t('job.commentClient') : t('job.commentYou')}</Text>
                </Row>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{c.content}</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16, lineHeight: 19 }}>{t('job.noCommentsYet')}</Text>
          )}
        </ScrollView>
        <Row style={{ gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><Input value={cmText} onChangeText={setCmText} placeholder={t('job.writeReply')} multiline style={{ minHeight: 50, paddingTop: 13 }} /></View>
          <Btn sm title={cmBusy ? '…' : t('job.send')} disabled={cmBusy} onPress={addComment} />
        </Row>
      </Sheet>
    </View>
  );
}
