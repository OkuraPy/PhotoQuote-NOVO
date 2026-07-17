// PhotoQuote v2 — Job screen: timeline + Quote / Invoice / Contract / Progress tabs
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow, Stage } from '../theme';
import { addDaysISO, applyMarkup, balanceAfterPayment, calcTotals, ClosedKind, daysFromToday, DOC_PHOTO_CAP, fmt, initials, invoiceBalance, jobSiteLine, LineItem, needsPhaseSync, parseDateOnly, PaymentMode, PaymentPlan, PaymentRecord, planFromInvoice, planRows, resizeDraftRows, round2, split, splitInstallments, STAGES, statusFromPayments, toDateOnly, toggleDocPhoto, unallocated } from '../data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addPhaseComment, addPhasePhotos, agreementLink, assignMember, countProjectPhases, createAgreement, createInvoice, createPhase, deletePhase, deriveStage, ensureReceiptNumber, ensureShareToken, fetchCompanyProfile, fetchJobDetail, fetchPhases, fetchProjectAssignments, fetchTeam, JobDetail, progressLink, ProgressPhase, PhaseStatus, recordInvoicePayment, seedPhasesFromEstimate, syncPhasesWithEstimate, TeamMember, unassignMember, updateDocPhotos, updateEstimateStatus, updateInvoicePlan, updateInvoiceStatus, updatePhase, updateProjectStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sendDoc } from '../lib/send';
import { registerStrings, useT } from '../lib/i18n';
import { Avatar, Between, Btn, Card, CatChip, Chip, DecimalInput, Divider, Empty, Field, Input, LinkBtn, Nav, NavBtn, Row, SectionTitle, SendSheet, Sheet, StageChip, Stepper, Switch, useStore } from '../ui';
import { ClosedChip } from './Tabs';

registerStrings({
  // NEXT STEP labels (keyed by stage action; Stage values themselves are not translated)
  'job.nextStep': { en: 'NEXT STEP', es: 'SIGUIENTE PASO', pt: 'PRÓXIMO PASSO' },
  'job.next.send': { en: 'Send quote', es: 'Enviar cotización', pt: 'Enviar orçamento' },
  'job.next.approve': { en: 'Mark approved', es: 'Marcar aprobada', pt: 'Marcar aprovado' },
  'job.next.invoice': { en: 'Generate invoice', es: 'Generar factura', pt: 'Gerar fatura' },
  'job.next.paid': { en: 'Record payment', es: 'Registrar pago', pt: 'Registrar pagamento' },
  'job.next.done': { en: 'Paid in full', es: 'Pagada por completo', pt: 'Pago integralmente' },
  // header / labels
  'job.noClient': { en: 'No client', es: 'Sin cliente', pt: 'Sem cliente' },
  'job.newEstimate': { en: 'New quote', es: 'Nueva cotización', pt: 'Novo orçamento' },
  'job.jobSuffix': { en: '{svc} job', es: 'Trabajo de {svc}', pt: 'Trabalho de {svc}' },
  'job.noAddress': { en: 'No address yet', es: 'Aún sin dirección', pt: 'Sem endereço ainda' },
  // tabs
  'job.tab.quote': { en: 'Quote', es: 'Cotización', pt: 'Orçamento' },
  'job.tab.invoice': { en: 'Invoice', es: 'Factura', pt: 'Fatura' },
  'job.tab.contract': { en: 'Contract', es: 'Contrato', pt: 'Contrato' },
  'job.tab.progress': { en: 'Progress', es: 'Progreso', pt: 'Progresso' },
  // alerts
  'job.alert.estimateNeeded': { en: 'Quote needed', es: 'Se necesita la cotización', pt: 'Orçamento necessário' },
  'job.alert.saveEstimateFirst': { en: 'Save the quote first, then generate the invoice.', es: 'Guarda primero la cotización y luego genera la factura.', pt: 'Salve o orçamento primeiro e depois gere a fatura.' },
  'job.alert.couldNotCreateInvoice': { en: 'Could not create the invoice', es: 'No se pudo crear la factura', pt: 'Não foi possível criar a fatura' },
  'job.alert.invoiceNeeded': { en: 'Invoice needed', es: 'Se necesita la factura', pt: 'Fatura necessária' },
  'job.alert.generateInvoiceFirst': { en: 'Generate the invoice first, then the contract.', es: 'Genera primero la factura y luego el contrato.', pt: 'Gere a fatura primeiro e depois o contrato.' },
  'job.alert.clientNeeded': { en: 'Client needed', es: 'Se necesita un cliente', pt: 'Cliente necessário' },
  'job.alert.clientNeededBody': { en: 'Add a client to this job before creating a contract.', es: 'Agrega un cliente a este trabajo antes de crear un contrato.', pt: 'Adicione um cliente a este trabalho antes de criar um contrato.' },
  'job.alert.couldNotCreateContract': { en: 'Could not create the contract', es: 'No se pudo crear el contrato', pt: 'Não foi possível criar o contrato' },
  'job.alert.couldNotUpdate': { en: 'Could not update', es: 'No se pudo actualizar', pt: 'Não foi possível atualizar' },
  'job.alert.tryAgain': { en: 'Try again.', es: 'Inténtalo de nuevo.', pt: 'Tente novamente.' },
  // NOTE: share messages and PDF doc labels are NOT registered here on purpose — they reach the
  // CLIENT, and client-facing output is always English (owner's rule). See CLIENT_SHARE below.
  'job.yourCompany': { en: 'Your company', es: 'Tu empresa', pt: 'Sua empresa' },
  'job.zeroRow': { en: 'Every payment needs an amount above $0.', es: 'Cada pago necesita un monto mayor a $0.', pt: 'Cada pagamento precisa de um valor acima de $0.' },
  'job.sendQuote': { en: 'Send quote', es: 'Enviar cotización', pt: 'Enviar orçamento' },
  // QuoteTab
  'job.photos': { en: 'Photos · {n}', es: 'Fotos · {n}', pt: 'Fotos · {n}' },
  'job.onDocument': { en: 'On document · {n}/{cap} — tap a photo to include it', es: 'En el documento · {n}/{cap} — toca una foto para incluirla', pt: 'No documento · {n}/{cap} — toque numa foto para incluí-la' },
  'job.lineItems': { en: 'Line items', es: 'Conceptos', pt: 'Itens' },
  'job.edit': { en: 'Edit', es: 'Editar', pt: 'Editar' },
  'job.taxable': { en: 'Taxable', es: 'Gravable', pt: 'Tributável' },
  'job.noTax': { en: 'No tax', es: 'Sin impuesto', pt: 'Sem imposto' },
  'job.subtotal': { en: 'Subtotal', es: 'Subtotal', pt: 'Subtotal' },
  'job.markupIncluded': { en: 'Markup ({pct}%) included', es: 'Margen ({pct}%) incluido', pt: 'Margem ({pct}%) incluída' },
  'job.tax': { en: 'Tax ({rate}% on {amount})', es: 'Impuesto ({rate}% sobre {amount})', pt: 'Imposto ({rate}% sobre {amount})' },
  'job.total': { en: 'Total', es: 'Total', pt: 'Total' },
  // InvoiceTab
  'job.noInvoiceYet': { en: 'No invoice yet', es: 'Aún no hay factura', pt: 'Nenhuma fatura ainda' },
  'job.invoiceFromQuote': { en: 'Generate a professional invoice from this quote. Totals stay in sync automatically.', es: 'Genera una factura profesional a partir de esta cotización. Los totales se mantienen sincronizados automáticamente.', pt: 'Gere uma fatura profissional a partir deste orçamento. Os totais permanecem sincronizados automaticamente.' },
  'job.generating': { en: 'Generating…', es: 'Generando…', pt: 'Gerando…' },
  'job.generateInvoice': { en: 'Generate invoice', es: 'Generar factura', pt: 'Gerar fatura' },
  'job.paidBadge': { en: 'PAID', es: 'PAGADA', pt: 'PAGA' },
  'job.partialBadge': { en: 'PARTIAL', es: 'PARCIAL', pt: 'PARCIAL' },
  'job.dueBadge': { en: 'DUE', es: 'POR PAGAR', pt: 'A VENCER' },
  'job.invoiceLabel': { en: 'Invoice', es: 'Factura', pt: 'Fatura' },
  'job.issuedDue': { en: 'Issued · Due', es: 'Emitida · Vence', pt: 'Emitida · Vence' },
  'job.issuedOnly': { en: 'Issued', es: 'Emitida', pt: 'Emitida' },
  'job.from': { en: 'From', es: 'De', pt: 'De' },
  'job.billTo': { en: 'Bill to', es: 'Facturar a', pt: 'Faturar para' },
  'job.jobSite': { en: 'Job site', es: 'Obra', pt: 'Obra' },
  'job.notes': { en: 'Notes', es: 'Notas', pt: 'Observações' },
  'job.totalDue': { en: 'Total due', es: 'Total a pagar', pt: 'Total a pagar' },
  'job.paid': { en: 'Paid', es: 'Pagado', pt: 'Pago' },
  'job.balanceDue': { en: 'Balance due', es: 'Saldo pendiente', pt: 'Saldo devedor' },
  'job.paymentsReceived': { en: 'Payments received', es: 'Pagos recibidos', pt: 'Pagamentos recebidos' },
  'job.quoteChanged': { en: 'The quote changed after this invoice was created. Payments are already recorded, so the invoice keeps its original amounts.', es: 'La cotización cambió después de crear esta factura. Ya hay pagos registrados, así que la factura mantiene sus montos originales.', pt: 'O orçamento mudou depois desta fatura ser criada. Já há pagamentos registrados, então a fatura mantém os valores originais.' },
  'job.pdf': { en: 'PDF', es: 'PDF', pt: 'PDF' },
  'job.sendInvoice': { en: 'Send invoice', es: 'Enviar factura', pt: 'Enviar fatura' },
  // payment plan sheet (leigo-proof: no "Net 15" jargon — real dates and plain words)
  'job.paymentPlan': { en: 'Payment plan', es: 'Plan de pago', pt: 'Plano de pagamento' },
  'job.planTotal': { en: 'Total: {amount}', es: 'Total: {amount}', pt: 'Total: {amount}' },
  'job.plan.full': { en: 'Pay in full', es: 'Pago único', pt: 'Pagamento único' },
  'job.plan.fullDesc': { en: 'One payment for the whole amount', es: 'Un solo pago por el monto total', pt: 'Um pagamento único do valor total' },
  'job.plan.deposit': { en: 'Deposit + balance', es: 'Anticipo + saldo', pt: 'Entrada + saldo' },
  'job.plan.depositDesc': { en: 'Part up front, the rest at the end', es: 'Una parte por adelantado y el resto al final', pt: 'Uma parte adiantada e o resto no final' },
  'job.plan.installments': { en: 'Installments', es: 'Cuotas', pt: 'Parcelas' },
  'job.plan.installmentsDesc': { en: 'Split into 2–12 payments', es: 'Divide en 2–12 pagos', pt: 'Divida em 2–12 pagamentos' },
  'job.dueInDays': { en: 'Due in {n} days', es: 'Vence en {n} días', pt: 'Vence em {n} dias' },
  'job.uponCompletion': { en: 'Upon completion', es: 'Al finalizar', pt: 'Na conclusão' },
  'job.splitInto': { en: 'Split into', es: 'Dividir en', pt: 'Dividir em' },
  'job.depositPreview': { en: 'Deposit {dep} · Balance {bal}', es: 'Anticipo {dep} · Saldo {bal}', pt: 'Entrada {dep} · Saldo {bal}' },
  'job.depositTooBig': { en: 'The deposit can’t exceed the total.', es: 'El anticipo no puede superar el total.', pt: 'A entrada não pode passar do total.' },
  'job.unallocated': { en: 'Unallocated: {amount}', es: 'Sin asignar: {amount}', pt: 'Falta alocar: {amount}' },
  'job.rowDeposit': { en: 'Deposit', es: 'Anticipo', pt: 'Entrada' },
  'job.rowBalance': { en: 'Balance', es: 'Saldo', pt: 'Saldo' },
  'job.rowFullPayment': { en: 'Full payment', es: 'Pago total', pt: 'Pagamento total' },
  'job.paymentN': { en: 'Payment {n}', es: 'Pago {n}', pt: 'Pagamento {n}' },
  'job.savePlan': { en: 'Save plan', es: 'Guardar plan', pt: 'Salvar plano' },
  'job.editPaymentPlan': { en: 'Edit payment plan', es: 'Editar plan de pago', pt: 'Editar plano de pagamento' },
  'job.editPlanKeepsPayments': { en: 'Payments already recorded won’t change.', es: 'Los pagos ya registrados no cambian.', pt: 'Pagamentos já registrados não mudam.' },
  'job.couldNotSavePlan': { en: 'Could not save the plan', es: 'No se pudo guardar el plan', pt: 'Não foi possível salvar o plano' },
  // record payment sheet
  'job.recordPayment': { en: 'Record payment', es: 'Registrar pago', pt: 'Registrar pagamento' },
  'job.recordPaymentSub': { en: 'Log what the client paid you.', es: 'Registra lo que el cliente te pagó.', pt: 'Registre o que o cliente pagou.' },
  'job.amountLabel': { en: 'Amount', es: 'Monto', pt: 'Valor' },
  'job.methodLabel': { en: 'Payment method', es: 'Método de pago', pt: 'Forma de pagamento' },
  'job.method.cash': { en: 'Cash', es: 'Efectivo', pt: 'Dinheiro' },
  'job.method.check': { en: 'Check', es: 'Cheque', pt: 'Cheque' },
  'job.method.card': { en: 'Card', es: 'Tarjeta', pt: 'Cartão' },
  'job.method.ach': { en: 'Bank transfer', es: 'Transferencia', pt: 'Transferência' },
  'job.method.other': { en: 'Other', es: 'Otro', pt: 'Outro' },
  'job.receivedToday': { en: 'Received today · {date}', es: 'Recibido hoy · {date}', pt: 'Recebido hoje · {date}' },
  'job.couldNotRecordPayment': { en: 'Could not record the payment', es: 'No se pudo registrar el pago', pt: 'Não foi possível registrar o pagamento' },
  // receipt (G3) — the document itself is English; only this app copy is translated
  'job.paymentRecordedTitle': { en: 'Payment recorded', es: 'Pago registrado', pt: 'Pagamento registrado' },
  'job.overpayTitle': { en: 'Amount over balance', es: 'Monto mayor al saldo', pt: 'Valor acima do saldo' },
  'job.overpayBody': { en: '{amount} is more than the {balance} balance due. Record it anyway?', es: '{amount} es más que el saldo de {balance}. ¿Registrar de todos modos?', pt: '{amount} é mais que o saldo de {balance}. Registrar mesmo assim?' },
  'job.overpayConfirm': { en: 'Record anyway', es: 'Registrar igual', pt: 'Registrar mesmo assim' },
  'job.sendReceiptBody': { en: 'Send the client a receipt for {amount}?', es: '¿Enviar al cliente un recibo por {amount}?', pt: 'Enviar ao cliente um recibo de {amount}?' },
  'job.notNow': { en: 'Not now', es: 'Ahora no', pt: 'Agora não' },
  'job.sendReceipt': { en: 'Send receipt', es: 'Enviar recibo', pt: 'Enviar recibo' },
  'job.receiptLink': { en: 'Receipt', es: 'Recibo', pt: 'Recibo' },
  'job.couldNotCreateReceipt': { en: 'Could not create the receipt', es: 'No se pudo crear el recibo', pt: 'Não foi possível criar o recibo' },
  // ContractTab
  'job.invoiceNeededFirst': { en: 'Invoice needed first', es: 'Primero se necesita la factura', pt: 'Fatura necessária primeiro' },
  'job.contractIntro': { en: 'Generate the invoice, then create a service agreement for the client to sign.', es: 'Genera la factura y luego crea un contrato de servicio para que el cliente lo firme.', pt: 'Gere a fatura e depois crie um contrato de serviço para o cliente assinar.' },
  'job.serviceAgreement': { en: 'Service agreement', es: 'Contrato de servicio', pt: 'Contrato de serviço' },
  'job.statusSigned': { en: 'SIGNED', es: 'FIRMADO', pt: 'ASSINADO' },
  'job.statusSent': { en: 'SENT', es: 'ENVIADO', pt: 'ENVIADO' },
  'job.statusDraft': { en: 'DRAFT', es: 'BORRADOR', pt: 'RASCUNHO' },
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
  'job.empty.saveJobBody': { en: 'Create the quote, then track the work in phases the client can follow.', es: 'Crea la cotización y luego haz seguimiento del trabajo en fases que el cliente pueda seguir.', pt: 'Crie o orçamento e depois acompanhe o trabalho em fases que o cliente pode seguir.' },
  'job.alert.generateEstimateFirst': { en: 'Generate the quote first, then add phases.', es: 'Genera primero la cotización y luego agrega fases.', pt: 'Gere o orçamento primeiro e depois adicione fases.' },
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
  // phases from the quote (G4)
  'job.createPhasesFromQuote': { en: 'Create phases from quote ({n} items)', es: 'Crear fases desde la cotización ({n} conceptos)', pt: 'Criar fases do orçamento ({n} itens)' },
  'job.createPhasesTitle': { en: 'Track the work in phases?', es: '¿Seguir el trabajo por fases?', pt: 'Acompanhar o trabalho em fases?' },
  'job.createPhasesBody': { en: 'Create {n} work phases from the quote? Your client can follow them through the shared link.', es: '¿Crear {n} fases de trabajo desde la cotización? Tu cliente puede seguirlas por el enlace compartido.', pt: 'Criar {n} fases de trabalho a partir do orçamento? Seu cliente pode acompanhá-las pelo link compartilhado.' },
  'job.create': { en: 'Create', es: 'Crear', pt: 'Criar' },
  'job.syncWithQuote': { en: 'Sync with quote', es: 'Sincronizar con la cotización', pt: 'Sincronizar com o orçamento' },
  'job.commentClient': { en: 'CLIENT', es: 'CLIENTE', pt: 'CLIENTE' },
  'job.commentYou': { en: 'YOU', es: 'TÚ', pt: 'VOCÊ' },
  'job.noCommentsYet': { en: 'No comments yet. Your client can comment from the shared progress link.', es: 'Aún no hay comentarios. Tu cliente puede comentar desde el enlace de progreso compartido.', pt: 'Nenhum comentário ainda. Seu cliente pode comentar pelo link de progresso compartilhado.' },
  'job.writeReply': { en: 'Write a reply…', es: 'Escribe una respuesta…', pt: 'Escreva uma resposta…' },
  'job.send': { en: 'Send', es: 'Enviar', pt: 'Enviar' },
  'job.companyFallback': { en: 'You', es: 'Tú', pt: 'Você' },
  // job menu — close (lost/archive) & reopen; "closed" lives on projects.status, orthogonal to the stage
  'job.menu.title': { en: 'Job options', es: 'Opciones del trabajo', pt: 'Opções do trabalho' },
  'job.menu.markLost': { en: 'Mark as lost', es: 'Marcar como perdida', pt: 'Marcar como perdido' },
  'job.menu.markLostConfirmTitle': { en: 'Mark as lost?', es: '¿Marcar como perdida?', pt: 'Marcar como perdido?' },
  'job.menu.markLostConfirmBody': {
    en: 'It leaves your pipeline and stops counting in your numbers. You can reopen it anytime.',
    es: 'Saldrá de tu lista activa y dejará de contar en tus números. Puedes reabrirla cuando quieras.',
    pt: 'Ele sai da sua lista ativa e deixa de contar nos seus números. Você pode reabrir quando quiser.',
  },
  'job.menu.archive': { en: 'Archive job', es: 'Archivar trabajo', pt: 'Arquivar trabalho' },
  'job.menu.reopen': { en: 'Reopen job', es: 'Reabrir trabajo', pt: 'Reabrir trabalho' },
  'job.reopen': { en: 'Reopen', es: 'Reabrir', pt: 'Reabrir' },
  'job.closedBanner.lost': {
    en: 'This job is marked as lost — it no longer counts in your numbers.',
    es: 'Este trabajo está marcado como perdido; ya no cuenta en tus números.',
    pt: 'Este trabalho está marcado como perdido — não conta mais nos seus números.',
  },
  'job.closedBanner.archived': {
    en: 'This job is archived — hidden from your active jobs.',
    es: 'Este trabajo está archivado; no aparece entre tus trabajos activos.',
    pt: 'Este trabalho está arquivado — fora dos seus trabalhos ativos.',
  },
  // approve without the send round-trip (client said yes on the phone / in person)
  'job.approveDirectly': { en: 'Client already approved? Mark approved', es: '¿El cliente ya aprobó? Marcar aprobada', pt: 'Cliente já aprovou? Marcar aprovado' },
  // company guard — a document must never go out saying "Your company"
  'job.companyMissingTitle': { en: 'Add your company info first', es: 'Primero agrega los datos de tu empresa', pt: 'Adicione os dados da sua empresa primeiro' },
  'job.companyMissingBody': {
    en: 'This document would go out saying "Your company". Add your business name so clients see who it\'s from.',
    es: 'Este documento saldría a nombre de "Tu empresa". Agrega el nombre de tu negocio para que los clientes vean de quién viene.',
    pt: 'Este documento sairia como "Sua empresa". Adicione o nome do seu negócio para que os clientes vejam de quem ele é.',
  },
  'job.companyMissingCta': { en: 'Add company info', es: 'Agregar datos de la empresa', pt: 'Adicionar dados da empresa' },
  'job.companyMissingMember': { en: 'Ask the account owner to add the company name in their profile before sending documents.', es: 'Pide al dueño de la cuenta que agregue el nombre de la empresa en su perfil antes de enviar documentos.', pt: 'Peça ao dono da conta para adicionar o nome da empresa no perfil antes de enviar documentos.' },
  // payment plan hardening: silent installment downgrade, overdue dues, $0 quote
  'job.planDowngradedTitle': { en: 'Installments not saved', es: 'Las cuotas no se guardaron', pt: 'As parcelas não foram salvas' },
  'job.planDowngradedBody': {
    en: 'The invoice was saved as a single payment. Open "Edit payment plan" to set the installments again.',
    es: 'La factura se guardó como pago único. Abre "Editar plan de pago" para configurar las cuotas de nuevo.',
    pt: 'A fatura foi salva como pagamento único. Abra "Editar plano de pagamento" para configurar as parcelas novamente.',
  },
  'job.overdueDays': { en: '{n} days overdue', es: '{n} días de retraso', pt: '{n} dias em atraso' },
  'job.zeroTotalTitle': { en: 'Quote total is $0', es: 'El total de la cotización es $0', pt: 'O total do orçamento é $0' },
  'job.zeroTotalBody': {
    en: 'Add line items with prices before generating the invoice.',
    es: 'Agrega conceptos con precios antes de generar la factura.',
    pt: 'Adicione itens com preços antes de gerar a fatura.',
  },
  // team assignment (Onda B) — the owner picks which members see this job
  'job.menu.assignTeam': { en: 'Assign team', es: 'Asignar equipo', pt: 'Atribuir equipe' },
  'job.assign.title': { en: 'Assign team', es: 'Asignar equipo', pt: 'Atribuir equipe' },
  'job.assign.sub': {
    en: 'Members only see the jobs assigned to them.',
    es: 'Los miembros solo ven los trabajos que se les asignan.',
    pt: 'Os membros só veem os trabalhos atribuídos a eles.',
  },
  'job.assign.none': {
    en: 'No team members yet. Add your crew first.',
    es: 'Aún no hay miembros en el equipo. Agrega primero a tu personal.',
    pt: 'Ainda não há membros na equipe. Adicione seu pessoal primeiro.',
  },
  'job.assign.goTeam': { en: 'Add members', es: 'Agregar miembros', pt: 'Adicionar membros' },
});

// Client-facing copy is ALWAYS English (owner's rule) — never run these through t().
const CLIENT_SHARE = {
  contract: (link: string) => `Please review and sign your service agreement:\n${link}`,
  progress: (link: string) => `Track your project's progress here:\n${link}`,
};

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
  // Onda B: ownerId keys the data (owner's id even for a member); role gates the UI. Field mode
  // = progress only: the money/pipeline surfaces hide (the RLS wouldn't feed them anyway).
  const { user, ownerId, role, canSeeFinancials, memberName } = useAuth();
  const fieldMode = role === 'field';
  const tab = fieldMode ? 'progress' : store.jobTab || 'quote';
  const setStage = (s: Stage) => up((st) => ({ stageOverride: { ...st.stageOverride, [id]: s } }));
  const clearStage = () => up((st) => { const o = { ...st.stageOverride }; delete o[id]; return { stageOverride: o }; });
  const setTab = (k: string) => up({ jobTab: k });
  const { data: company } = useQuery({ queryKey: ['company', ownerId], queryFn: () => fetchCompanyProfile(ownerId!), enabled: !!ownerId });
  const projectId: string | null = job?.projectId || job?.id || (params?.id && params.id !== 'new' ? params.id : null);
  const { data: detail } = useQuery({ queryKey: ['jobDetail', projectId], queryFn: () => fetchJobDetail(projectId!), enabled: !!projectId });
  const est = detail?.estimate;
  const inv = detail?.invoice;
  // stage derived from the DB (estimate/invoice status) once detail loads; falls back to the list value
  const baseStage: Stage = detail ? deriveStage(est?.status, inv?.status) : job ? job.stage : 'Quoted';
  const stage = store.stageOverride[id] || baseStage;
  // closed (lost/archived) is orthogonal to the stage — detail (fresh) wins over the list params
  const closed: ClosedKind | null = detail ? detail.closed : job?.closed ?? null;
  const realClient = detail?.client || null;
  // new job (not yet persisted): show the AI estimate the user just generated, held in the store
  const items = detail?.items?.length ? detail.items : job ? [] : store.items;
  const taxRate = est?.taxRate ?? store.taxRate ?? 8.25;
  // margin always 0: new scheme embeds it in prices; legacy display trusts the SAVED totals below
  const computed = calcTotals(items, taxRate, 0);
  // stored DB totals are the source of truth (trigger); fall back to computed for mock/no-estimate
  const quoteTotals: Totals = est
    ? { subtotal: est.subtotal, taxableSubtotal: computed.taxableSubtotal, tax: est.tax, total: est.total, taxRate }
    : { ...computed, taxRate };
  const invoiceTotals: Totals = inv
    ? { subtotal: inv.subtotal, taxableSubtotal: computed.taxableSubtotal, tax: inv.tax, total: inv.total, taxRate: inv.taxRate }
    : quoteTotals;
  // header total mirrors fetchJobs (invoice total wins over the estimate's) so the list and this
  // header never diverge; the stale params value only bridges the gap while detail is loading.
  const headerTotal = detail ? (inv ? inv.total : quoteTotals.total) : job ? job.value : quoteTotals.total;
  const [vd, vc] = split(headerTotal);
  const name = job ? job.title : params?.title || (store.svcs[0] ? t('job.jobSuffix', { svc: store.svcs[0] }) : t('job.newEstimate'));
  // header prefers the REAL client from the DB — right after save the flow store is already
  // reset (aSel/aLoc cleared), so deriving from the store showed "No client" on a fresh job
  const cName = realClient?.name || (job ? job.client : client?.name) || t('job.noClient');
  // job-site line for documents (G5) + the header address, which now prefers the WORK address
  const jobSite = jobSiteLine(detail?.jobSite);
  const addr = detail?.jobSite.address || realClient?.addr || (job ? job.addr : client?.addr || store.aLoc?.city) || t('job.noAddress');
  const next = NEXT[stage];
  const queryClient = useQueryClient();

  /* ----- F12 payment plan + received payments ----- */
  // local state on purpose (never the global store) — nothing leaks between jobs
  const [planSheet, setPlanSheet] = useState<null | 'generate' | 'edit'>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [paySheet, setPaySheet] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const invoicePlan = inv ? planFromInvoice(inv) : null;
  const balance = inv ? invoiceBalance(inv.total, inv.amountPaid) : 0;

  /* ----- document photos (G2): which job photos print on the quote PDF ----- */
  const docPhotos = detail?.docPhotoUrls || [];
  const onToggleDocPhoto = async (url: string) => {
    if (!projectId || !detail) return;
    const next = toggleDocPhoto(docPhotos, detail.photoUrls, url);
    if (!next) return; // cap reached / unknown url — the tap is a no-op
    // optimistic: the strip reflects the tap instantly; the server result re-syncs it after
    queryClient.setQueryData(['jobDetail', projectId], (old?: JobDetail) => (old ? { ...old, docPhotoUrls: next } : old));
    try {
      await updateDocPhotos(projectId, next);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
    } catch {
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] }); // revert to the DB truth
    }
  };

  /* ----- close (lost / archive) & reopen — the "more" menu on the nav ----- */
  const [menuOpen, setMenuOpen] = useState(false);
  const [closingBusy, setClosingBusy] = useState(false);
  // team assignment sheet (owner only). The small delay lets the menu Modal finish dismissing —
  // presenting a second Modal while the first animates out can wedge it on iOS.
  const [assignOpen, setAssignOpen] = useState(false);
  const openAssign = () => {
    setMenuOpen(false);
    setTimeout(() => setAssignOpen(true), 380);
  };
  const setProjectStatus = async (status: 'Lost' | 'Archived' | 'Active') => {
    if (!projectId || closingBusy) return;
    setClosingBusy(true);
    try {
      await updateProjectStatus(projectId, status);
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setMenuOpen(false);
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setClosingBusy(false);
    }
  };
  // losing a job pulls it out of the numbers — confirm first (archive/reopen are one tap, both undoable)
  const confirmMarkLost = () => {
    Alert.alert(t('job.menu.markLostConfirmTitle'), t('job.menu.markLostConfirmBody'), [
      { text: t('job.cancel'), style: 'cancel' },
      { text: t('job.menu.markLost'), style: 'destructive', onPress: () => { void setProjectStatus('Lost'); } },
    ]);
  };

  /* ----- company guard: no document goes out saying "Your company" ----- */
  // undefined = profile still loading (don't block on a race); a loaded row without a name = block
  const companyReady = company === undefined ? true : !!String((company as any)?.company_name || '').trim();
  const requireCompany = (proceed: () => void) => {
    if (companyReady) return proceed();
    // only the OWNER can fill the company profile (users row is own-only) — offering an office
    // member the "Add company info" button led to a silent dead end (final-review M1): the save
    // wrote 0 rows without error and the guard blocked forever. Members just get told to ask.
    if (role === 'owner') {
      Alert.alert(t('job.companyMissingTitle'), t('job.companyMissingBody'), [
        { text: t('job.cancel'), style: 'cancel' },
        { text: t('job.companyMissingCta'), onPress: () => go('profileCompany') },
      ]);
    } else {
      Alert.alert(t('job.companyMissingTitle'), t('job.companyMissingMember'));
    }
  };

  // generating is now 2 steps: pick the plan in the sheet, THEN create the invoice on confirm.
  // Deposit % pre-fills from the company default; installments start as an even 2-way split.
  const defaultPlan: PaymentPlan = {
    mode: 'full',
    dueDate: addDaysISO(15),
    depositPercent: (company as any)?.default_deposit_percent ?? 25,
    depositAmount: 0,
    installments: [],
  };
  const openGenerateInvoice = () => {
    if (inv) { clearStage(); setTab('invoice'); return; }
    if (!ownerId || !est?.id || !projectId) { Alert.alert(t('job.alert.estimateNeeded'), t('job.alert.saveEstimateFirst')); return; }
    // a $0 invoice can never be settled (payments must be > 0) — send them back to the items
    if (!(quoteTotals.total > 0)) { Alert.alert(t('job.zeroTotalTitle'), t('job.zeroTotalBody')); return; }
    setPlanSheet('generate');
  };
  const confirmPlan = async (plan: PaymentPlan) => {
    if (!ownerId) return;
    const editing = planSheet === 'edit';
    // freeze for the post-invoice phases prompt below — invalidate refreshes `est` under us
    const [uid, estId, pid, nItems] = [ownerId, est?.id, projectId, items.length];
    setSavingPlan(true);
    try {
      let downgraded = false;
      if (editing && inv) ({ downgraded } = await updateInvoicePlan(ownerId, inv.id, plan));
      else if (est?.id && projectId) ({ downgraded } = await createInvoice(ownerId, est.id, projectId, plan));
      else return;
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPlanSheet(null);
      clearStage(); // invoice now exists → DB-derived stage becomes "Invoiced"
      setTab('invoice');
      // the schedule insert failed and the plan fell back to a single payment — say so, never silently
      // (380ms: an Alert presented while the sheet Modal is still dismissing dies with it on iOS)
      if (downgraded) setTimeout(() => Alert.alert(t('job.planDowngradedTitle'), t('job.planDowngradedBody')), 380);
      else if (!editing && estId && pid && nItems > 0) {
        // G4: fresh invoice = the work is about to start — offer to seed the progress phases.
        // Best-effort and only when there are none yet; a failure just leaves the tab's button.
        try {
          if ((await countProjectPhases(pid)) === 0) {
            setTimeout(() => Alert.alert(t('job.createPhasesTitle'), t('job.createPhasesBody', { n: nItems }), [
              { text: t('job.notNow'), style: 'cancel' },
              {
                text: t('job.create'),
                onPress: () => {
                  void (async () => {
                    try {
                      await seedPhasesFromEstimate(uid, pid, estId);
                      await queryClient.invalidateQueries({ queryKey: ['phases', pid] });
                    } catch {
                      /* the "Create phases from quote" button on the Progress tab still covers it */
                    }
                  })();
                },
              },
            ]), 380);
          }
        } catch {
          /* never block the invoice flow over the phases nicety */
        }
      }
    } catch (e: any) {
      Alert.alert(editing ? t('job.couldNotSavePlan') : t('job.alert.couldNotCreateInvoice'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setSavingPlan(false);
    }
  };

  // "Mark paid" became "Record payment": money received goes to the ledger and the status
  // (Unpaid / Partially Paid / Paid) is derived server-side from Σ(payments) vs total.
  // After a successful record the contractor is offered a receipt for it (G3).
  const confirmPayment = async (amount: number, method: string | null) => {
    if (!ownerId || !inv?.id) return;
    // guard a fat-finger overpayment ($9409 for a $940.90 balance): the ledger is append-only,
    // there's no in-app refund, and the receipt would print a wrong "Paid in full" (final-review M1)
    const balanceNow = invoiceBalance(inv.total, inv.amountPaid);
    if (amount > balanceNow + 0.005) {
      Alert.alert(
        t('job.overpayTitle'),
        t('job.overpayBody', { amount: fmt(amount), balance: fmt(balanceNow) }),
        [
          { text: t('job.notNow'), style: 'cancel' },
          { text: t('job.overpayConfirm'), onPress: () => void doRecordPayment(amount, method) },
        ]
      );
      return;
    }
    void doRecordPayment(amount, method);
  };
  const doRecordPayment = async (amount: number, method: string | null) => {
    if (!ownerId || !inv?.id) return;
    const invoice = inv; // freeze — detail refetches under the alert below
    setSavingPay(true);
    try {
      const { id: paymentId } = await recordInvoicePayment(ownerId, invoice.id, { amount, method });
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPaySheet(false);
      clearStage();
      const balanceAfter = invoiceBalance(invoice.total, invoice.amountPaid + amount);
      // 380ms: the receipt offer (G3) was racing the sheet's dismiss animation and could vanish
      setTimeout(() => Alert.alert(t('job.paymentRecordedTitle'), t('job.sendReceiptBody', { amount: fmt(amount) }), [
        { text: t('job.notNow'), style: 'cancel' },
        {
          text: t('job.sendReceipt'),
          onPress: () => requireCompany(() => { void sendReceipt(paymentId, { amount, method, date: toDateOnly(new Date()), balanceAfter }, invoice.number); }),
        },
      ]), 380);
    } catch (e: any) {
      Alert.alert(t('job.couldNotRecordPayment'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setSavingPay(false);
    }
  };

  // Receipt (G3): mint the number once (re-issues reuse it) and go straight to the PDF share
  // sheet — a receipt is always a PDF, so the SendSheet chooser is skipped on purpose.
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const sendReceipt = async (paymentId: string, p: { amount: number; method: string | null; date: string; balanceAfter: number }, invoiceNumber?: string) => {
    if (receiptBusy) return;
    setReceiptBusy(paymentId);
    try {
      const number = await ensureReceiptNumber(paymentId);
      const co = (company as any) || {};
      await sendDoc('Save PDF', {
        kind: 'receipt',
        docLabel: 'Receipt', // client-facing, English by design
        number,
        company: { name: co.company_name || t('job.yourCompany'), license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email },
        client: realClient,
        items: [],
        totals: { subtotal: 0, tax: 0, total: p.amount, taxRate: 0 }, // unused by the receipt branch
        receipt: { number, date: p.date, method: p.method, amount: p.amount, invoiceNumber, balanceAfter: p.balanceAfter },
      });
    } catch (e: any) {
      Alert.alert(t('job.couldNotCreateReceipt'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setReceiptBusy(null);
    }
  };
  // re-issue from a ledger row: the balance shown is the one AS OF that payment
  const onReceiptRow = (p: PaymentRecord) => {
    if (!inv) return;
    requireCompany(() => { void sendReceipt(p.id, { amount: p.amount, method: p.method, date: p.paidAt, balanceAfter: balanceAfterPayment(inv.total, inv.payments, p.id) }, inv.number); });
  };

  // contract / service agreement → generate (from the invoice) and share the signing link
  const [genningContract, setGenningContract] = useState(false);
  const shareContract = async (token: string) => {
    try {
      await Share.share({ message: CLIENT_SHARE.contract(agreementLink(token)) });
    } catch {
      /* user dismissed the share sheet */
    }
  };
  const generateContract = async () => {
    if (detail?.agreement) return shareContract(detail.agreement.token); // existing doc — resharing is safe
    if (!inv) { Alert.alert(t('job.alert.invoiceNeeded'), t('job.alert.generateInvoiceFirst')); return; }
    // a client is optional on a job/invoice but REQUIRED for a contract — pre-check with a localized
    // message (createAgreement would otherwise throw its English string into a pt/es alert; L2)
    if (!realClient) { Alert.alert(t('job.alert.clientNeeded'), t('job.alert.clientNeededBody')); return; }
    if (!ownerId || !projectId) return;
    const [uid, pid, invId] = [ownerId, projectId, inv.id];
    // company guard before GENERATING: createAgreement freezes the company name into the contract HTML
    requireCompany(async () => {
      setGenningContract(true);
      try {
        const { token } = await createAgreement(uid, pid, invId);
        await queryClient.invalidateQueries({ queryKey: ['jobDetail', pid] });
        await shareContract(token);
      } catch (e: any) {
        Alert.alert(t('job.alert.couldNotCreateContract'), e?.message || t('job.alert.tryAgain'));
      } finally {
        setGenningContract(false);
      }
    });
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
    // NEXT's send is ALWAYS the quote — force the tab too, or the sheet inherits whatever tab is
    // open and the PDF goes out labeled "Invoice" (no number) / "Agreement" (no terms).
    if (next.act === 'send') return requireCompany(() => up({ sheet: true, jobTab: 'quote' }));
    if (next.act === 'approve') return setEstimateStatus('Approved', 'Approved');
    if (next.act === 'invoice') return openGenerateInvoice();
    if (next.act === 'paid') return setPaySheet(true); // record what was received (pre-filled with the balance)
  };
  // "already approved on the phone" shortcut — visible while the next step is still "send"
  const canApproveDirectly = !closed && next.act === 'send' && !!est?.id;
  // field: value only with the per-member flag; the stage chip follows it (without financials
  // the RLS starves deriveStage and it would show a fake "Draft" — hiding beats lying)
  const showMoney = !fieldMode || canSeeFinancials;

  return (
    <>
      <Nav
        // field members usually can't read the client (RLS) — the job title beats "No client"
        title={fieldMode ? name : cName || t('job.noClient')}
        sub={fieldMode ? undefined : name}
        center
        onBack={back}
        // the menu writes projects.status / assignments — owner & office only, once the job exists
        right={projectId && !fieldMode ? <NavBtn icon="more" onPress={() => setMenuOpen(true)} /> : undefined}
      />
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
            {/* stage chip hidden for ANY field member — invoices are RLS-hidden from them, so the
                derived stage would lie (Invoiced/Paid reads as Approved) even with the money flag */}
            {closed ? <ClosedChip kind={closed} lg /> : !fieldMode ? <StageChip stage={stage} lg /> : null}
          </Between>
          {showMoney ? (
            <Text style={{ fontFamily: fonts.num, fontSize: 32, color: colors.ink, marginTop: 14, letterSpacing: -0.6 }}>
              {vd}<Text style={{ color: colors.muted }}>{vc}</Text>
            </Text>
          ) : null}
          {fieldMode ? null : (
            <>
              <Divider />
              <Timeline stage={stage} />
            </>
          )}
        </View>

        {fieldMode ? null : closed ? (
          // a closed job has no "next step" — a thin banner with the way back replaces it
          <Row style={{ gap: 10, backgroundColor: closed === 'lost' ? colors.errorTint : '#EEF0F3', borderRadius: radii.lg, paddingVertical: 11, paddingHorizontal: 13, marginTop: 16 }}>
            <Icon name={closed === 'lost' ? 'flag' : 'layers'} size={15} color={closed === 'lost' ? colors.error : '#8A93A3'} />
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, lineHeight: 18 }}>{t('job.closedBanner.' + closed)}</Text>
            <LinkBtn icon="trend" title={t('job.reopen')} onPress={() => { void setProjectStatus('Active'); }} />
          </Row>
        ) : stage !== 'Paid' ? (
          <>
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
            {canApproveDirectly ? (
              // client already said yes (phone / in person) — skip the send round-trip
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <LinkBtn icon="check" title={t('job.approveDirectly')} onPress={() => setEstimateStatus('Approved', 'Approved')} />
              </View>
            ) : null}
          </>
        ) : null}

        {/* internal tabs — field members live on Progress only (Quote/Invoice/Contract are
            financial surfaces the RLS returns empty anyway) */}
        {fieldMode ? null : (
          <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#EEF1F4', borderRadius: 14, marginTop: 16 }}>
            {['quote', 'invoice', 'contract', 'progress'].map((k) => (
              <Pressable key={k} onPress={() => setTab(k)} style={[{ flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tab === k && { backgroundColor: colors.card, ...shadow.sm }]}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: tab === k ? colors.ink : colors.muted }}>{t('job.tab.' + k)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {tab === 'quote' && (
          <QuoteTab
            items={items}
            totals={quoteTotals}
            markupPercent={est?.markupPercent ?? 0}
            customerNote={est?.customerNote || null}
            go={go}
            photos={detail?.photoUrls || []}
            docPhotos={docPhotos}
            onToggleDocPhoto={detail ? onToggleDocPhoto : undefined}
            onEdit={
              est && projectId
                ? () => {
                    // hydrate the flow store with THIS job's items — the editor must never show a stale capture.
                    // Legacy estimate (margin summed on top): FOLD the margin into the prices so the editor
                    // and every future document reconcile; saving rewrites it as embedded markup.
                    // New scheme: detail.items already carry basePrice (derived from markup_percent).
                    const legacy = est.legacyMarginRate > 0;
                    // legacy items carry no basePrice, so applyMarkup folds from the current price
                    const items = legacy ? applyMarkup(detail!.items, est.legacyMarginRate) : detail!.items;
                    up({ items, taxRate: quoteTotals.taxRate, marginRate: legacy ? est.legacyMarginRate : est.markupPercent, editing: null, custNote: est.customerNote || '', custNoteSrc: est.customerNoteSrc || '' });
                    go('estimate', { editJob: { projectId, estimateId: est.id } });
                  }
                : undefined
            }
            onSend={est && projectId && !closed ? () => requireCompany(() => up({ sheet: true })) : undefined}
          />
        )}
        {tab === 'invoice' && <InvoiceTab stage={stage} items={items} totals={invoiceTotals} client={realClient} jobSite={jobSite} company={company} invoice={inv} quoteTotal={est?.total} genning={savingPlan} onGen={openGenerateInvoice} onRecordPayment={() => setPaySheet(true)} onEditPlan={() => setPlanSheet('edit')} onReceipt={onReceiptRow} receiptBusyId={receiptBusy} setSheet={(b: boolean) => (b ? requireCompany(() => up({ sheet: true })) : up({ sheet: false }))} />}
        {tab === 'contract' && <ContractTab agreement={detail?.agreement || null} hasInvoice={!!inv} totals={invoiceTotals} plan={invoicePlan} company={company} genning={genningContract} onGenerate={generateContract} />}
        {tab === 'progress' && (
          <ProgressTab
            projectId={projectId}
            estimateId={est?.id || null}
            // storage paths & row user_id stay keyed by the OWNER — a member's photos land in the
            // owner's folders so the whole team (and the client portal) sees one project album
            userId={ownerId || null}
            items={items}
            // comments sign with the member's own name; the owner keeps signing as the company
            authorName={role !== 'owner' && memberName ? memberName : (company as any)?.company_name || t('job.companyFallback')}
          />
        )}
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
            // English on purpose: docLabel prints on the PDF header and the email subject (client-facing)
            docLabel: kind === 'invoice' ? 'Invoice' : kind === 'contract' ? 'Agreement' : 'Quote',
            number: kind === 'invoice' ? inv?.number : undefined,
            company: { name: co.company_name || t('job.yourCompany'), license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email },
            client: realClient,
            jobSite: jobSite || undefined, // English job-site line on quote & invoice (G5)
            customerNote: (kind !== 'contract' && est?.customerNote) || undefined, // "Notes" section (G1)
            photos: kind === 'quote' && docPhotos.length ? docPhotos : undefined, // curated photos (G2)
            items,
            totals: tt,
            // invoice PDF/text: the payment plan + what's already paid (English by design)
            payment:
              kind === 'invoice' && inv && invoicePlan
                ? {
                    rows: planRows(invoicePlan, inv.total).map((r) => ({ label: r.label, amount: r.amount, due: r.dueDate })),
                    paid: inv.amountPaid,
                    balance,
                    // itemized ledger (field feedback 07/07): the doc should show WHAT was received
                    received: inv.payments.map((p) => ({ date: p.paidAt, method: p.method, amount: p.amount })),
                  }
                : undefined,
          });
          // stamp 'Sent' only while the quote is still pre-approval — re-sending a copy of an
          // Approved (or further) quote must not regress the pipeline (api guards this too)
          if (kind === 'quote' && (stage === 'Draft' || stage === 'Quoted')) setEstimateStatus('Sent', 'Sent');
          else if (kind === 'invoice') setInvoiceStatus('Sent'); // api ignores it unless still 'Unpaid'
        }}
      />

      <PaymentPlanSheet
        open={!!planSheet}
        onClose={() => setPlanSheet(null)}
        total={planSheet === 'edit' && inv ? inv.total : quoteTotals.total}
        initial={planSheet === 'edit' && invoicePlan ? invoicePlan : defaultPlan}
        hasPayments={planSheet === 'edit' && !!inv?.payments.length}
        busy={savingPlan}
        confirmLabel={planSheet === 'edit' ? t('job.savePlan') : t('job.generateInvoice')}
        onConfirm={confirmPlan}
      />
      <RecordPaymentSheet open={paySheet} onClose={() => setPaySheet(false)} balance={balance} busy={savingPay} onConfirm={confirmPayment} />
      <JobMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        closed={closed}
        busy={closingBusy}
        canApprove={canApproveDirectly}
        canAssign={role === 'owner' && !!projectId}
        onAssign={openAssign}
        onApprove={() => { setMenuOpen(false); void setEstimateStatus('Approved', 'Approved'); }}
        onMarkLost={confirmMarkLost}
        onArchive={() => { void setProjectStatus('Archived'); }}
        onReopen={() => { void setProjectStatus('Active'); }}
      />
      {role === 'owner' && projectId && user?.id ? (
        <AssignSheet open={assignOpen} onClose={() => setAssignOpen(false)} projectId={projectId} ownerId={ownerId} assignedBy={user.id} goTeam={() => { setAssignOpen(false); go('team'); }} />
      ) : null}
    </>
  );
}

/* ---------------- Job menu sheet: assign team / mark lost / archive / reopen (+ approve) ---------------- */
// Same local-state pattern as the payment sheets. "Closed" is projects.status — the underlying
// quote/invoice keep their statuses, so reopening restores the exact pipeline stage.
function JobMenuSheet({ open, onClose, closed, busy, canApprove, canAssign, onAssign, onApprove, onMarkLost, onArchive, onReopen }: { open: boolean; onClose: () => void; closed: ClosedKind | null; busy: boolean; canApprove: boolean; canAssign: boolean; onAssign: () => void; onApprove: () => void; onMarkLost: () => void; onArchive: () => void; onReopen: () => void }) {
  const t = useT();
  const rows: { key: string; ico: string; col: string; bg: string; label: string; onPress: () => void }[] = closed
    ? [{ key: 'reopen', ico: 'trend', col: colors.primary, bg: colors.primaryTint, label: t('job.menu.reopen'), onPress: onReopen }]
    : [
        ...(canAssign ? [{ key: 'assign', ico: 'users', col: colors.primary, bg: colors.primaryTint, label: t('job.menu.assignTeam'), onPress: onAssign }] : []),
        ...(canApprove ? [{ key: 'approve', ico: 'check', col: colors.success, bg: colors.successTint, label: t('job.approveDirectly'), onPress: onApprove }] : []),
        { key: 'lost', ico: 'flag', col: colors.error, bg: colors.errorTint, label: t('job.menu.markLost'), onPress: onMarkLost },
        { key: 'archive', ico: 'layers', col: colors.muted, bg: colors.chipBg, label: t('job.menu.archive'), onPress: onArchive },
      ];
  return (
    <Sheet open={open} onClose={onClose} title={t('job.menu.title')}>
      {rows.map((r) => (
        <Pressable key={r.key} disabled={busy} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: r.bg }}>
            <Icon name={r.ico} size={20} color={r.col} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: r.key === 'lost' ? colors.error : colors.ink }}>{r.label}</Text>
          {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Icon name="chevR" size={18} color="#C2C9D2" />}
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ---------------- Assign team sheet (Onda B, owner only) ---------------- */
// One switch per active member: on = the member sees this job (project_members row). Optimistic
// toggle + invalidate, same pattern as the doc-photo selection; a duplicate insert is a no-op
// server-side, so a raced double-tap can't corrupt anything.
function AssignSheet({ open, onClose, projectId, ownerId, assignedBy, goTeam }: { open: boolean; onClose: () => void; projectId: string; ownerId: string | null; assignedBy: string; goTeam: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({ queryKey: ['team', ownerId], queryFn: () => fetchTeam(ownerId!), enabled: open && !!ownerId });
  const { data: assigned = [] } = useQuery({ queryKey: ['assignments', projectId], queryFn: () => fetchProjectAssignments(projectId), enabled: open });
  const [busyId, setBusyId] = useState<string | null>(null);
  const isOn = (memberId: string) => assigned.some((a) => a.memberId === memberId);

  const toggle = async (m: TeamMember) => {
    if (busyId) return;
    const on = isOn(m.id);
    setBusyId(m.id);
    qc.setQueryData(['assignments', projectId], (old?: { memberId: string }[]) =>
      on ? (old || []).filter((a) => a.memberId !== m.id) : [...(old || []), { memberId: m.id }]
    );
    try {
      if (on) await unassignMember(projectId, m.id);
      else await assignMember(projectId, m.id, assignedBy);
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
    } finally {
      await qc.invalidateQueries({ queryKey: ['assignments', projectId] }); // re-sync with the DB truth
      setBusyId(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('job.assign.title')} sub={t('job.assign.sub')}>
      {isLoading ? (
        <View style={{ paddingVertical: 22, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : members.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>{t('job.assign.none')}</Text>
          <Btn variant="soft" sm icon="users" title={t('job.assign.goTeam')} onPress={goTeam} style={{ marginTop: 14, paddingHorizontal: 18 }} />
        </View>
      ) : (
        members.map((m) => (
          <Pressable key={m.id} onPress={() => toggle(m)} disabled={!!busyId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, opacity: busyId && busyId !== m.id ? 0.6 : 1 }}>
            <Avatar text={initials(m.name)} size={40} radius={12} fontSize={14} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>{m.name}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 1 }}>{m.email}</Text>
            </View>
            {busyId === m.id ? <ActivityIndicator size="small" color={colors.muted} /> : <Switch on={isOn(m.id)} onPress={() => toggle(m)} />}
          </Pressable>
        ))
      )}
    </Sheet>
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

function QuoteTab({ items, totals, markupPercent = 0, customerNote, go, photos, docPhotos = [], onToggleDocPhoto, onEdit, onSend }: { items: LineItem[]; totals: Totals; markupPercent?: number; customerNote?: string | null; go: NavProp['go']; photos: string[]; docPhotos?: string[]; onToggleDocPhoto?: (url: string) => void; onEdit?: () => void; onSend?: () => void }) {
  const t = useT();
  return (
    <View style={{ marginTop: 16 }}>
      {photos.length ? (
        <>
          <SectionTitle title={t('job.photos', { n: photos.length })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
            {photos.map((u, i) => {
              const onDoc = docPhotos.includes(u);
              return (
                // tap = toggle "prints on the quote PDF" (G2) — green check marks the selected ones
                <Pressable key={i} onPress={onToggleDocPhoto ? () => onToggleDocPhoto(u) : undefined}>
                  <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: colors.chipBg, borderWidth: onDoc ? 2 : 0, borderColor: colors.success }} />
                  {onDoc ? (
                    <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' }}>
                      <Icon name="check" size={12} sw={3} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {onToggleDocPhoto ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 8 }}>
              {t('job.onDocument', { n: docPhotos.length, cap: DOC_PHOTO_CAP })}
            </Text>
          ) : null}
        </>
      ) : null}
      {/* no onEdit = legacy job without an estimate row — the bare go('estimate') fallback
          started a FRESH flow and could duplicate the job on save; hide the link instead */}
      <SectionTitle title={t('job.lineItems')} link={onEdit ? t('job.edit') : undefined} onLink={onEdit} />
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
        {markupPercent > 0 ? (
          // internal-only info: the markup is already inside the prices — it adds nothing here
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.faint, paddingVertical: 2 }}>{t('job.markupIncluded', { pct: markupPercent })}</Text>
        ) : null}
        <TotRow label={t('job.tax', { rate: totals.taxRate, amount: fmt(totals.taxableSubtotal) })} value={fmt(totals.tax)} />
        <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.total')}</Text>
          <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
        </Between>
      </Card>
      {customerNote ? (
        // client-facing note (G1) — the same text the PDF/contract prints in its "Notes" section
        <Card pad style={{ marginTop: 12 }}>
          <Row style={{ gap: 7 }}>
            <Icon name="msg" size={14} color={colors.muted} />
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.notes')}</Text>
          </Row>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2, marginTop: 8, lineHeight: 19 }}>{customerNote}</Text>
        </Card>
      ) : null}
      {onSend ? (
        // always available: the quote can be re-sent after the first send or after an edit
        // (field feedback 07/07 — the NEXT card moves on and used to strand the send action)
        <Btn title={t('job.sendQuote')} icon="send" variant="ghost" onPress={onSend} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
}

// planRows labels are English (they feed the client documents) — the app screens translate
// their own display copies here. Custom/unknown labels pass through untouched.
const ROW_LABEL_KEY: Record<string, string> = { Deposit: 'job.rowDeposit', Balance: 'job.rowBalance', 'Full payment': 'job.rowFullPayment' };
function rowLabel(t: (k: string, v?: Record<string, string | number>) => string, label: string): string {
  if (ROW_LABEL_KEY[label]) return t(ROW_LABEL_KEY[label]);
  const m = /^Payment (\d+)$/.exec(label);
  return m ? t('job.paymentN', { n: m[1] }) : label;
}
// method keys are stored in English (Cash/Check/Card/ACH/Other) — translate for display
const METHOD_KEY: Record<string, string> = { Cash: 'job.method.cash', Check: 'job.method.check', Card: 'job.method.card', ACH: 'job.method.ach', Other: 'job.method.other' };
const methodLabel = (t: (k: string) => string, m: string) => (METHOD_KEY[m] ? t(METHOD_KEY[m]) : m);
const mdDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function InvoiceTab({ stage, items, totals, client, jobSite, company, invoice, quoteTotal, genning, onGen, onRecordPayment, onEditPlan, onReceipt, receiptBusyId, setSheet }: { stage: Stage; items: LineItem[]; totals: Totals; client: JobDetail['client']; jobSite?: string; company?: any; invoice?: JobDetail['invoice']; quoteTotal?: number; genning: boolean; onGen: () => void; onRecordPayment: () => void; onEditPlan: () => void; onReceipt?: (p: PaymentRecord) => void; receiptBusyId?: string | null; setSheet: (b: boolean) => void }) {
  const t = useT();
  const has = !!invoice || ['Invoiced', 'Paid'].includes(stage);
  const co = company || {};
  const coName = co.company_name || t('job.yourCompany');
  // real issued / due dates — due comes from the payment plan (no more hardcoded Net-15)
  const issued = invoice?.created ? new Date(invoice.created) : new Date();
  const due = invoice?.dueDate ? parseDateOnly(invoice.dueDate) : null;
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
  // plan rows + ledger-derived amounts (a legacy Paid invoice maps amountPaid = total upstream)
  const amountPaid = invoice?.amountPaid ?? 0;
  const balance = invoice ? invoiceBalance(invoice.total, amountPaid) : totals.total;
  const rows = invoice ? planRows(planFromInvoice(invoice), invoice.total) : [];
  const payStatus = invoice ? statusFromPayments(invoice.total, amountPaid) : 'Unpaid';
  const paid = payStatus === 'Paid' || stage === 'Paid';
  const partial = !paid && payStatus === 'Partially Paid';
  const badge: [string, string, string] = paid
    ? [t('job.paidBadge'), colors.success, colors.successTint]
    : partial
      ? [t('job.partialBadge'), colors.info, colors.infoTint]
      : [t('job.dueBadge'), colors.warning, colors.warningTint];
  // the quote was edited after invoicing and the invoice couldn't be re-synced (payments exist)
  const outOfSync = quoteTotal != null && !!invoice && Math.abs(quoteTotal - invoice.total) > 0.005;
  return (
    <View style={{ marginTop: 16 }}>
      {outOfSync ? (
        <Row style={{ gap: 8, alignItems: 'flex-start', backgroundColor: colors.warningTint, borderRadius: radii.lg, padding: 12, marginBottom: 12 }}>
          <Icon name="flag" size={15} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, lineHeight: 18 }}>{t('job.quoteChanged')}</Text>
        </Row>
      ) : null}
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
            <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: badge[2] }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: badge[1] }}>{badge[0]}</Text>
            </View>
          </Between>
          <Between style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <View><DpLab text={t('job.invoiceLabel')} /><Text style={{ fontFamily: fonts.num, fontSize: 14, color: colors.muted, marginTop: 3 }}>{invoice?.number || '—'}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><DpLab text={due ? t('job.issuedDue') : t('job.issuedOnly')} /><Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink, marginTop: 3 }}>{mdDate(issued)}{due ? ` · ${mdDate(due)}` : ''}</Text></View>
          </Between>
        </View>
        {/* parties */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
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
          {jobSite ? (
            // work address (G5) — full-width row: two columns above stay readable on narrow phones
            <View style={{ marginTop: 12 }}>
              <DpLab text={t('job.jobSite')} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{jobSite}</Text>
            </View>
          ) : null}
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
        {/* totals + payment plan + ledger */}
        <View style={{ padding: 20, backgroundColor: colors.card2, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TotRow label={t('job.subtotal')} value={fmt(totals.subtotal)} />
          <TotRow label={t('job.tax', { rate: totals.taxRate, amount: fmt(totals.taxableSubtotal) })} value={fmt(totals.tax)} />
          <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.totalDue')}</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(totals.total)}</Text>
          </Between>
          <View style={{ marginTop: 10 }}>
            {rows.length > 1
              ? rows.map((r, i) => <TotRow key={i} label={`${rowLabel(t, r.label)}${r.dueDate ? ` · ${mdDate(parseDateOnly(r.dueDate))}` : ''}`} value={fmt(r.amount)} />)
              : null}
            {amountPaid > 0 ? <TotRow label={t('job.paid')} value={fmt(amountPaid)} color={colors.success} /> : null}
            <TotRow label={t('job.balanceDue')} value={fmt(balance)} color={paid ? colors.success : colors.ink} />
          </View>
        </View>
        {/* received payments (ledger) */}
        {invoice?.payments.length ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <DpLab text={t('job.paymentsReceived')} />
            {invoice.payments.map((p) => (
              <Between key={p.id} style={{ marginTop: 8 }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{mdDate(parseDateOnly(p.paidAt))}{p.method ? ` · ${methodLabel(t, p.method)}` : ''}</Text>
                {onReceipt ? (
                  // (re)issue the receipt for this payment — reuses its number once minted (G3)
                  <Pressable onPress={() => onReceipt(p)} disabled={!!receiptBusyId} hitSlop={8}>
                    <Row style={{ gap: 4 }}>
                      <Icon name="receipt" size={13} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>{receiptBusyId === p.id ? t('job.working') : t('job.receiptLink')}</Text>
                    </Row>
                  </Pressable>
                ) : null}
                <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.success }}>{fmt(p.amount)}</Text>
              </Between>
            ))}
          </View>
        ) : null}
      </Card>
      {invoice && balance > 0.005 ? <Btn title={t('job.recordPayment')} icon="wallet" onPress={onRecordPayment} style={{ marginTop: 16 }} /> : null}
      <Row style={{ gap: 10, marginTop: invoice && balance > 0.005 ? 10 : 16 }}>
        <Btn variant="ghost" icon="pdf" title={t('job.pdf')} onPress={() => setSheet(true)} style={{ flex: 0.4 }} />
        <Btn variant={invoice && balance > 0.005 ? 'ghost' : 'primary'} title={t('job.sendInvoice')} icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
      {invoice ? (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <LinkBtn icon="edit" title={t('job.editPaymentPlan')} onPress={onEditPlan} />
        </View>
      ) : null}
    </View>
  );
}
const DpLab = ({ text }: { text: string }) => <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1, color: colors.faint }}>{text.toUpperCase()}</Text>;

function ContractTab({ agreement, hasInvoice, totals, plan, company, genning, onGenerate }: { agreement: JobDetail['agreement']; hasInvoice: boolean; totals: Totals; plan: PaymentPlan | null; company?: any; genning: boolean; onGenerate: () => void }) {
  const t = useT();
  const coName = company?.company_name || t('job.yourCompany');
  const signed = agreement?.status === 'signed';
  const sent = !!agreement && !signed;
  // the same payment plan the contract's "3. PAYMENT TERMS" table is generated from
  const rows = plan ? planRows(plan, totals.total) : [];
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
        {rows.map((r, i) => (
          <Between key={i} style={i ? { marginTop: 12 } : undefined}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
              {rowLabel(t, r.label)}{r.dueDate ? ` · ${mdDate(parseDateOnly(r.dueDate))}` : ` · ${t('job.uponCompletion')}`}
            </Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.ink }}>{fmt(r.amount)}</Text>
          </Between>
        ))}
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

/* ---------------- Payment plan sheet (F12): full / deposit / installments ---------------- */
// daysFromToday moved to ../data (pure, unit-tested). It returns NEGATIVE for an overdue due —
// shown as "N days overdue" instead of the old clamp-to-0, which silently re-dated past dues
// to today whenever a plan was re-saved.
type DraftRow = { label: string; amount: number; days: number };
// due-in / overdue caption + the real date it resolves to (addDaysISO handles negatives)
const dueDays = (t: (k: string, v?: Record<string, string | number>) => string, days: number) =>
  days < 0 ? t('job.overdueDays', { n: -days }) : t('job.dueInDays', { n: days });
// even N-way split; first due in 15 days, then monthly-ish (+30) — all editable per row
const draftRows = (total: number, n: number): DraftRow[] =>
  splitInstallments(total, n).map((a, i) => ({ label: `Payment ${i + 1}`, amount: a, days: 15 + 30 * i }));

function PaymentPlanSheet({ open, onClose, total, initial, hasPayments, busy, confirmLabel, onConfirm }: { open: boolean; onClose: () => void; total: number; initial: PaymentPlan; hasPayments: boolean; busy: boolean; confirmLabel: string; onConfirm: (plan: PaymentPlan) => void }) {
  const t = useT();
  // LOCAL state on purpose (not the global store): closing/reopening or switching jobs can
  // never leak a half-edited plan anywhere else.
  const [mode, setMode] = useState<PaymentMode>('full');
  const [fullDays, setFullDays] = useState(15);
  const [depMode, setDepMode] = useState<'pct' | 'amt'>('pct');
  const [depPct, setDepPct] = useState(25);
  const [depAmt, setDepAmt] = useState(0);
  const [rows, setRows] = useState<DraftRow[]>([]);
  // once the rows carry stored/hand-edited amounts, the N× stepper must PRESERVE them
  // (resizeDraftRows) instead of re-splitting evenly and wiping the edits
  const [rowsDirty, setRowsDirty] = useState(false);

  // re-seed from the defaults/invoice every time the sheet opens (the Modal stays mounted closed)
  useEffect(() => {
    if (!open) return;
    setMode(initial.mode);
    setFullDays(initial.mode === 'full' ? daysFromToday(initial.dueDate) : 15);
    const pct = initial.depositPercent ?? 25;
    setDepMode(initial.mode === 'deposit' && initial.depositPercent == null && initial.depositAmount > 0 ? 'amt' : 'pct');
    setDepPct(Math.min(100, Math.max(0, Math.round(pct))));
    setDepAmt(initial.depositAmount > 0 ? round2(initial.depositAmount) : round2((total * pct) / 100));
    setRows(
      initial.installments.length
        ? initial.installments.map((r, i) => ({ label: r.label || `Payment ${i + 1}`, amount: round2(r.amount), days: daysFromToday(r.dueDate) }))
        : draftRows(total, 2)
    );
    setRowsDirty(initial.installments.length > 0); // stored rows are an agreement — never re-split them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const depValue = depMode === 'pct' ? round2((total * depPct) / 100) : round2(depAmt);
  const depTooBig = depMode === 'amt' && depValue > total + 0.005;
  const missing = unallocated(total, rows); // installments must cover the total exactly
  const missingOk = Math.abs(missing) < 0.005;
  // a $0 installment would print "Payment N · $0.00" on the invoice AND the contract — never savable
  const hasZeroRow = rows.some((r) => !(r.amount > 0));
  const rowsOk = missingOk && !hasZeroRow;
  // deposit must be a real amount — $0 saved a 'deposit' plan that rendered as a confusing
  // "Full payment · Upon completion" with a "due today" header
  const canConfirm = !busy && (mode === 'full' || (mode === 'deposit' && !depTooBig && depValue > 0) || (mode === 'installments' && rowsOk));

  const buildPlan = (): PaymentPlan => {
    if (mode === 'deposit') {
      // deposit due on receipt (today); the balance is due upon completion (null)
      return { mode, dueDate: addDaysISO(0), depositPercent: depMode === 'pct' ? depPct : null, depositAmount: depValue, installments: [] };
    }
    if (mode === 'installments') {
      return { mode, dueDate: null, depositPercent: null, depositAmount: 0, installments: rows.map((r, i) => ({ label: r.label, amount: round2(r.amount), dueDate: addDaysISO(r.days), sort: i })) };
    }
    return { mode: 'full', dueDate: addDaysISO(fullDays), depositPercent: null, depositAmount: 0, installments: [] };
  };

  const cards: { key: PaymentMode; ico: string; k: string }[] = [
    { key: 'full', ico: 'receipt', k: 'full' },
    { key: 'deposit', ico: 'wallet', k: 'deposit' },
    { key: 'installments', ico: 'calendar', k: 'installments' },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={t('job.paymentPlan')} sub={t('job.planTotal', { amount: fmt(total) })}>
      {cards.map((c) => {
        const on = mode === c.key;
        return (
          <Pressable key={c.key} onPress={() => setMode(c.key)} style={{ borderRadius: 14, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryTint : colors.card, padding: 14, marginBottom: 10 }}>
            <Row style={{ gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.chipBg }}>
                <Icon name={c.ico} size={18} color={on ? '#fff' : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>{t('job.plan.' + c.k)}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 1 }}>{t('job.plan.' + c.k + 'Desc')}</Text>
              </View>
              {on ? <Icon name="checkCircle" size={19} color={colors.primary} /> : null}
            </Row>

            {on && c.key === 'full' ? (
              <Between style={{ marginTop: 12 }}>
                <View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: fullDays < 0 ? colors.warning : colors.ink }}>{dueDays(t, fullDays)}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{mdDate(parseDateOnly(addDaysISO(fullDays)))}</Text>
                </View>
                <Stepper value={String(fullDays)} width={44} onMinus={() => setFullDays((d) => Math.max(-365, d - 5))} onPlus={() => setFullDays((d) => Math.min(365, d + 5))} />
              </Between>
            ) : null}

            {on && c.key === 'deposit' ? (
              <View style={{ marginTop: 12 }}>
                <Between>
                  <Row style={{ gap: 8 }}>
                    <Chip label="%" selected={depMode === 'pct'} onPress={() => setDepMode('pct')} />
                    <Chip label="$" selected={depMode === 'amt'} onPress={() => { setDepAmt(round2((total * depPct) / 100)); setDepMode('amt'); }} />
                  </Row>
                  {depMode === 'pct' ? (
                    <Stepper value={`${depPct}%`} onMinus={() => setDepPct((p) => Math.max(0, p - 5))} onPlus={() => setDepPct((p) => Math.min(100, p + 5))} />
                  ) : null}
                </Between>
                {depMode === 'amt' ? <DecimalInput value={depAmt} onChangeValue={setDepAmt} style={{ marginTop: 10 }} /> : null}
                {depTooBig ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.error, marginTop: 8 }}>{t('job.depositTooBig')}</Text> : null}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink2, marginTop: 10 }}>
                  {t('job.depositPreview', { dep: fmt(Math.min(depValue, total)), bal: fmt(invoiceBalance(total, Math.min(depValue, total))) })}
                </Text>
              </View>
            ) : null}

            {on && c.key === 'installments' ? (
              <View style={{ marginTop: 12 }}>
                <Between>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{t('job.splitInto')}</Text>
                  {/* pristine rows re-split evenly; edited/stored rows are RESIZED, edits preserved */}
                  <Stepper
                    value={`${rows.length}×`}
                    width={44}
                    onMinus={() => setRows((r) => (rowsDirty ? resizeDraftRows(r, Math.max(2, r.length - 1), total) : draftRows(total, Math.max(2, r.length - 1))))}
                    onPlus={() => setRows((r) => (rowsDirty ? resizeDraftRows(r, Math.min(12, r.length + 1), total) : draftRows(total, Math.min(12, r.length + 1))))}
                  />
                </Between>
                <ScrollView style={{ maxHeight: 250, marginTop: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {rows.map((r, i) => (
                    <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: colors.card }}>
                      <Between>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{rowLabel(t, r.label)}</Text>
                        <View style={{ width: 112 }}>
                          <DecimalInput value={r.amount} onChangeValue={(v) => { setRowsDirty(true); setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, amount: v } : x))); }} style={{ height: 42 }} />
                        </View>
                      </Between>
                      <Between style={{ marginTop: 8 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: r.days < 0 ? colors.warning : colors.muted }}>
                          {dueDays(t, r.days)} · {mdDate(parseDateOnly(addDaysISO(r.days)))}
                        </Text>
                        <Stepper
                          value={String(r.days)}
                          width={44}
                          onMinus={() => { setRowsDirty(true); setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, days: Math.max(-365, x.days - 5) } : x))); }}
                          onPlus={() => { setRowsDirty(true); setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, days: Math.min(365, x.days + 5) } : x))); }}
                        />
                      </Between>
                    </View>
                  ))}
                </ScrollView>
                {!rowsOk ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.warning, marginTop: 2 }}>
                    {!missingOk ? t('job.unallocated', { amount: missing >= 0 ? fmt(missing) : `-${fmt(Math.abs(missing))}` }) : t('job.zeroRow')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {hasPayments ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 10 }}>{t('job.editPlanKeepsPayments')}</Text> : null}
      <Btn title={busy ? t('job.working') : confirmLabel} icon={busy ? undefined : 'check'} disabled={!canConfirm} onPress={() => onConfirm(buildPlan())} style={{ marginTop: 4 }} />
    </Sheet>
  );
}

/* ---------------- Record payment sheet (F12): money received → ledger ---------------- */
function RecordPaymentSheet({ open, onClose, balance, busy, onConfirm }: { open: boolean; onClose: () => void; balance: number; busy: boolean; onConfirm: (amount: number, method: string | null) => void }) {
  const t = useT();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string | null>(null);
  // pre-fill with the outstanding balance on every open (fresh per job/press — local state)
  useEffect(() => {
    if (open) { setAmount(round2(balance)); setMethod(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // method KEYS stay English in the DB; only the chip labels are translated
  const methods: [string, string][] = [['Cash', 'cash'], ['Check', 'check'], ['Card', 'card'], ['ACH', 'ach'], ['Other', 'other']];
  return (
    <Sheet open={open} onClose={onClose} title={t('job.recordPayment')} sub={t('job.recordPaymentSub')}>
      <Field label={t('job.amountLabel')}><DecimalInput value={amount} onChangeValue={setAmount} /></Field>
      <Field label={t('job.methodLabel')} opt>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {methods.map(([key, k]) => (
            <Chip key={key} label={t('job.method.' + k)} selected={method === key} onPress={() => setMethod((m) => (m === key ? null : key))} />
          ))}
        </Row>
      </Field>
      <Row style={{ gap: 6 }}>
        <Icon name="calendar" size={14} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('job.receivedToday', { date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}</Text>
      </Row>
      <Btn title={busy ? t('job.working') : t('job.recordPayment')} icon={busy ? undefined : 'check'} disabled={busy || !(amount > 0)} onPress={() => onConfirm(round2(amount), method)} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

// [color, background, label-key] — the label is resolved at render via t(labelKey)
const PHASE_STAT: Record<PhaseStatus, [string, string, string]> = {
  completed: [colors.success, colors.successTint, 'job.phase.done'],
  in_progress: [colors.info, colors.infoTint, 'job.phase.inProgress'],
  not_started: [colors.faint, colors.bg, 'job.phase.notStarted'],
};
const NEXT_PHASE_STATUS: Record<PhaseStatus, PhaseStatus> = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' };

function ProgressTab({ projectId, estimateId, userId, items, authorName }: { projectId: string | null; estimateId: string | null; userId: string | null; items: LineItem[]; authorName: string }) {
  const t = useT();
  const qc = useQueryClient();
  // Field members work the phases (status/photos/comments) but don't reshape the plan or share
  // the client link — those stay with the owner (and the RLS agrees).
  const { role } = useAuth();
  const fieldMode = role === 'field';
  const { data: phases = [], isLoading } = useQuery({ queryKey: ['phases', projectId], queryFn: () => fetchPhases(projectId!), enabled: !!projectId });
  const [sheet, setSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cmPhaseId, setCmPhaseId] = useState<string | null>(null);
  const [cmText, setCmText] = useState('');
  const [cmBusy, setCmBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false); // shared by seed & sync — both rewrite phases
  const refresh = () => qc.invalidateQueries({ queryKey: ['phases', projectId] });
  const cmPhase = phases.find((p) => p.id === cmPhaseId) || null;

  // G4: seed one phase per quote item (empty tab), and re-align after the quote was edited.
  // The plan logic is pure (data.ts); only auto-seeded, untouched phases are ever removed.
  const canSeed = !fieldMode && !!userId && !!estimateId && items.length > 0;
  const seedFromQuote = async () => {
    if (!canSeed || !projectId || seedBusy) return;
    setSeedBusy(true);
    try {
      await seedPhasesFromEstimate(userId!, projectId, estimateId!);
      refresh();
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotAddPhase'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setSeedBusy(false);
    }
  };
  const showSync =
    canSeed &&
    phases.length > 0 &&
    needsPhaseSync(
      phases.map((p) => ({ id: p.id, name: p.name, autoSeeded: p.autoSeeded, status: p.status, hasContent: p.photos.length > 0 || p.comments.length > 0 })),
      items.map((it) => ({ desc: it.desc }))
    );
  const syncWithQuote = async () => {
    if (!canSeed || !projectId || seedBusy) return;
    setSeedBusy(true);
    try {
      await syncPhasesWithEstimate(userId!, projectId, estimateId!);
      refresh();
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotUpdate'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setSeedBusy(false);
    }
  };

  const addComment = async () => {
    if (!projectId || !cmPhase || !cmText.trim()) return;
    setCmBusy(true);
    try {
      await addPhaseComment(projectId, cmPhase.id, authorName, cmText.trim());
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
      await Share.share({ message: CLIENT_SHARE.progress(progressLink(token)) });
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
        {fieldMode ? null : (
          // sharing the client link is the owner's move (it can mint a share token)
          <Pressable onPress={shareWithClient} disabled={sharing} hitSlop={8}>
            <Row style={{ gap: 5 }}>
              <Icon name="link" size={14} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{sharing ? t('job.working') : t('job.clientLink')}</Text>
            </Row>
          </Pressable>
        )}
      </Between>

      {isLoading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
      ) : phases.length === 0 ? (
        <Card pad style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>{t('job.noPhasesYet')}</Text>
          {canSeed ? (
            // one tap turns the quote's line items into the work phases (G4)
            <Btn
              icon={seedBusy ? undefined : 'layers'}
              title={seedBusy ? t('job.working') : t('job.createPhasesFromQuote', { n: items.length })}
              disabled={seedBusy}
              onPress={seedFromQuote}
              style={{ marginTop: 16, alignSelf: 'stretch' }}
            />
          ) : null}
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
                  {fieldMode ? null : <Pressable onPress={() => removePhase(p)} hitSlop={8}><Icon name="trash" size={16} color={colors.faint} /></Pressable>}
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

      {showSync ? (
        // the quote was edited after the seeding — offer to re-align the untouched seeded phases
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <LinkBtn icon="trend" title={seedBusy ? t('job.working') : t('job.syncWithQuote')} onPress={syncWithQuote} />
        </View>
      ) : null}

      {/* creating phases needs the estimate id (NOT NULL) — a no-financials member can't have it */}
      {fieldMode ? null : <Btn icon="plus" title={t('job.addPhase')} variant="soft" onPress={() => setSheet(true)} style={{ marginTop: 14 }} />}

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
