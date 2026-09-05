// PhotoQuote v2 — Job screen: timeline + Quote / Invoice / Contract / Progress tabs
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, Share, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow, Stage } from '../theme';
import { addDaysISO, applyCreditToRows, applyMarkup, balanceAfterNewPayment, balanceAfterPayment, calcTotals, creditRoom, creditTotalUpTo, invoiceDue, overbilled, pickCreditTarget, ClosedKind, daysFromToday, DOC_PHOTO_CAP, fmt, invoiceRollup, NO_DISCOUNT, resolveDiscount, splitChangeOrder, uninvoiced, initials, invoiceBalance, jobSiteLine, LineItem, needsPhaseSync, parseDateOnly, PaymentMode, PaymentPlan, PaymentRecord, planFromInvoice, planRows, resizeDraftRows, round2, split, splitInstallments, STAGES, statusFromPayments, toDateOnly, toggleDocPhoto, unallocated } from '../data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteInvoiceCredit, addInvoiceCredit, addPhaseComment, addPhasePhotos, addProjectPhotos, agreementLink, assignMember, BEFORE_PHASE_NAME, countProjectPhases, createAgreement, createInvoice, createPhase, deletePhase, deletePhasePhoto, deleteProject, deleteProjectPhoto, deriveStage, ensureBookendPhases, ensureReceiptNumber, ensureShareToken, fetchCompanyProfile, fetchJobDetail, fetchPhases, fetchProjectAssignments, fetchTeam, FINAL_PHASE_NAME, JobDetail, progressLink, ProgressPhase, PhaseStatus, projectDeleteFacts, recordInvoicePayment, seedPhasesFromEstimate, syncPhasesWithEstimate, TeamMember, unassignMember, updateDocPhotos, updateEstimateStatus, updateInvoicePlan, updateInvoiceStatus, updatePhase, updateProjectStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sendDoc, SendData } from '../lib/send';
import { registerStrings, useT } from '../lib/i18n';
import { Avatar, Between, Btn, Card, CatChip, Chip, DateSheet, DecimalInput, Divider, Empty, Field, Input, LinkBtn, localeTag, Nav, NavBtn, Row, SectionTitle, SendSheet, Sheet, StageChip, Stepper, Switch, useStore } from '../ui';
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
  'job.alert.couldNotOpenLink': { en: 'Could not open the link', es: 'No se pudo abrir el enlace', pt: 'Não foi possível abrir o link' },
  // G-3 / G-4: see the client's own pages without texting yourself the link
  'job.clientView': { en: 'Client view', es: 'Vista del cliente', pt: 'Ver como cliente' },
  // unsigned: that URL is the SIGNING page (the portal only serves the read-only view once it is
  // signed) — the label says so, so nobody signs their own client's contract by accident
  'job.viewContract': { en: 'Preview the signing page', es: 'Ver la página de firma', pt: 'Ver a página de assinatura' },
  'job.viewSignedContract': { en: 'Open the signed contract', es: 'Abrir el contrato firmado', pt: 'Abrir o contrato assinado' },
  // G-2: uploading photos used to be a silent 20-30s
  'job.uploadingCount': { en: 'Sending {done} of {total}…', es: 'Enviando {done} de {total}…', pt: 'Enviando {done} de {total}…' },
  // G-6: check number / bank on the payment — prints on the client's receipt
  'job.referenceLabel': { en: 'Reference (check #, bank)', es: 'Referencia (n.º de cheque, banco)', pt: 'Referência (nº do cheque, banco)' },
  // the hint is the CONTRACTOR's UI (only the value he types reaches the client's receipt)
  'job.referenceHint': { en: 'Check #1234 · Chase', es: 'Cheque n.º 1234 · Chase', pt: 'Cheque nº 1234 · Chase' },
  // G-5: the money that already landed, said out loud on the job header
  'job.paidOfTotal': { en: 'Paid {paid} of {total}', es: 'Pagado {paid} de {total}', pt: 'Pago {paid} de {total}' },
  'job.balanceLeft': { en: '{amount} left', es: 'Faltan {amount}', pt: 'Faltam {amount}' },
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
  'job.discount': { en: 'Discount', es: 'Descuento', pt: 'Desconto' },
  // G-9: more than one invoice on the same job
  'job.createExtraInvoice': { en: 'Bill {amount} more', es: 'Cobrar {amount} más', pt: 'Cobrar mais {amount}' },
  // Os dois cartões dizem NÚMERO + AÇÃO, nunca o conceito ("fatura complementar", "crédito"): o
  // contratante não precisa saber que existem dois mecanismos, só que a obra mudou de tamanho.
  'job.addInvoiceTitle': { en: 'The job grew {amount}', es: 'El trabajo creció {amount}', pt: 'O trabalho aumentou {amount}' },
  // the mirror of the complementary invoice: the scope shrank after billing (material returned)
  'job.creditCardTitle': { en: 'The job shrank {amount}', es: 'El trabajo bajó {amount}', pt: 'O trabalho diminuiu {amount}' },
  'job.creditCardBody': {
    en: 'The balance drops. The invoice keeps what was billed, with the discount shown.',
    es: 'El saldo baja. La factura conserva lo facturado, con el descuento a la vista.',
    pt: 'O saldo cai. A fatura mantém o que foi cobrado, com o desconto à vista.',
  },
  'job.applyCredit': { en: 'Take {amount} off the invoice', es: 'Quitar {amount} de la factura', pt: 'Tirar {amount} da fatura' },
  // sem valor: o link permanente do rodapé, que existe mesmo sem diferença no orçamento
  'job.applyCreditPlain': { en: 'Take money off the invoice', es: 'Quitar de la factura', pt: 'Tirar da fatura' },
  'job.creditsApplied': { en: 'Discounts', es: 'Descuentos', pt: 'Descontos' },
  'job.billedTotal': { en: 'Billed to client', es: 'Cobrado al cliente', pt: 'Cobrado do cliente' },
  'job.creditTitle': { en: 'Take money off the invoice', es: 'Quitar de la factura', pt: 'Tirar da fatura' },
  'job.creditSub': {
    en: 'Reduces what the client owes. No money changes hands.',
    es: 'Reduce lo que el cliente debe. No hay dinero de por medio.',
    pt: 'Reduz o que o cliente deve. Nenhum dinheiro troca de mãos.',
  },
  'job.creditAmount': { en: 'How much to take off', es: 'Cuánto quitar', pt: 'Quanto tirar' },
  'job.creditReason': { en: 'Reason (client sees this)', es: 'Motivo (lo ve el cliente)', pt: 'Motivo (o cliente vê)' },
  // client-facing: it prints on the invoice, so the hint is English like every other printed string
  'job.creditReasonHint': { en: 'Returned material — 1 smoke detector', es: 'Returned material — 1 smoke detector', pt: 'Returned material — 1 smoke detector' },
  'job.creditMax': { en: 'At most {amount} — the balance still open.', es: 'Como máximo {amount} — el saldo abierto.', pt: 'No máximo {amount} — o saldo em aberto.' },
  // dead-end message the owner WILL hit: says why, and what to do instead
  'job.creditNoRoom': {
    en: 'Nothing left to credit — this invoice is fully paid. If you owe the client money back, refund it outside the app.',
    es: 'No queda nada por acreditar: esta factura está pagada. Si le debes dinero al cliente, devuélvelo fuera de la app.',
    pt: 'Não há o que creditar — esta fatura está paga. Se você tem que devolver dinheiro ao cliente, a devolução acontece fora do app.',
  },
  // client-facing: o texto vai IMPRESSO na fatura, então o exemplo é em inglês como o resto do doc
  'job.whatChanged': { en: 'What is the extra? (client sees this)', es: '¿Qué es el extra? (lo ve el cliente)', pt: 'O que é o extra? (o cliente vê)' },
  'job.whatChangedHint': { en: 'Extra drywall patch and paint', es: 'Extra drywall patch and paint', pt: 'Extra drywall patch and paint' },
  'job.extraInvoiceDone': { en: 'Invoice created', es: 'Factura creada', pt: 'Fatura criada' },
  'job.extraInvoiceDoneBody': {
    en: 'A new invoice for {amount} is ready. Send it to the client?',
    es: 'La factura nueva de {amount} está lista. ¿Enviarla al cliente?',
    pt: 'A fatura nova de {amount} está pronta. Mandar pro cliente?',
  },
  'job.creditDone': { en: 'Taken off the invoice', es: 'Quitado de la factura', pt: 'Tirado da fatura' },
  'job.creditDoneBody': {
    en: 'The balance is now {balance}. Send the client the updated invoice?',
    es: 'El saldo ahora es {balance}. ¿Enviar al cliente la factura actualizada?',
    pt: 'O saldo agora é {balance}. Mandar a fatura atualizada pro cliente?',
  },
  // o que sobra além do saldo não vira crédito (não há reembolso na app) — mas ele tem que saber
  'job.creditOverflow': {
    en: 'The other {amount} is past the balance — you owe the client that back outside the app.',
    es: 'Los otros {amount} pasan del saldo — eso le debes al cliente fuera de la app.',
    pt: 'Os outros {amount} passam do saldo — isso você devolve pro cliente fora do app.',
  },
  'job.couldNotCredit': { en: 'Could not apply the credit', es: 'No se pudo aplicar el crédito', pt: 'Não deu para lançar o crédito' },
  'job.removeCreditTitle': { en: 'Remove this credit?', es: '¿Quitar este crédito?', pt: 'Tirar este crédito?' },
  'job.removeCreditBody': {
    en: 'The {amount} goes back onto the balance. Use this to fix a credit typed by mistake.',
    es: 'Los {amount} vuelven al saldo. Úsalo para corregir un crédito escrito por error.',
    pt: 'Os {amount} voltam para o saldo. Use para corrigir um crédito digitado errado.',
  },
  'job.removeCredit': { en: 'Remove', es: 'Quitar', pt: 'Tirar' },
  // o valor sugerido sai da diferença entre TOTAIS, que já trazem imposto dentro. O texto anterior
  // mandava somar o imposto de novo — dobrava a conta de quem seguisse a instrução.
  'job.creditTaxHint': {
    en: 'Amount includes the {rate}% tax, like the invoice total. Typing your own? Include the tax in it.',
    es: 'El monto incluye el {rate}% de impuesto, como el total. ¿Escribes el tuyo? Inclúyelo también.',
    pt: 'O valor já é com o imposto de {rate}%, como o total. Se digitar o seu, inclua o imposto nele.',
  },
  'job.addInvoiceBody': { en: 'A new invoice goes out for the extra. The one the client already paid stays as it is.', es: 'Sale una factura nueva por el extra. La que el cliente ya pagó queda como está.', pt: 'Sai uma fatura nova só do extra. A que o cliente já pagou fica como está.' },
  'job.invoicesCount': { en: 'Invoices · {n}', es: 'Facturas · {n}', pt: 'Faturas · {n}' },
  'job.jobTotalRoll': { en: 'Job total {total} · Paid {paid} · Balance {balance}', es: 'Total del trabajo {total} · Pagado {paid} · Saldo {balance}', pt: 'Total do trabalho {total} · Pago {paid} · Saldo {balance}' },
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
  'job.splitEvenly': { en: 'Split evenly', es: 'Dividir en partes iguales', pt: 'Dividir igualmente' },
  'job.docPhotoCapTitle': { en: 'Up to {cap} photos on the document', es: 'Hasta {cap} fotos en el documento', pt: 'Até {cap} fotos no documento' },
  'job.docPhotoCapBody': { en: 'Tap a selected photo to take it off, then pick this one.', es: 'Toca una foto seleccionada para quitarla y luego elige esta.', pt: 'Toque numa foto já marcada para tirá-la e então escolha esta.' },
  // phase names are stored in ENGLISH (the client portal reads them) — only the display translates
  'job.phase.beforeName': { en: 'Before photos', es: 'Fotos del antes', pt: 'Fotos do antes' },
  'job.phase.finalName': { en: 'Final photos', es: 'Fotos finales', pt: 'Fotos finais' },
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
  // Zelle is a brand, so it stays Zelle in every language (the US equivalent of Pix)
  'job.method.zelle': { en: 'Zelle', es: 'Zelle', pt: 'Zelle' },
  'job.paidOnLabel': { en: 'Payment date', es: 'Fecha de pago', pt: 'Data do pagamento' },
  'job.paidOnSub': {
    en: 'The day the client paid — a post-dated check keeps its own date.',
    es: 'El día en que el cliente pagó — un cheque posfechado conserva su fecha.',
    pt: 'O dia em que o cliente pagou — cheque pré-datado mantém a data dele.',
  },
  'job.today': { en: 'today', es: 'hoy', pt: 'hoje' },
  'job.postDatedWarn': {
    en: 'Post-dated: this counts as received now, and a payment cannot be undone in the app.',
    es: 'Posfechado: cuenta como recibido ahora, y un pago no se puede deshacer en la app.',
    pt: 'Pré-datado: conta como recebido agora, e a app não desfaz um pagamento.',
  },
  'job.postDatedTitle': { en: 'Post-dated payment', es: 'Pago posfechado', pt: 'Pagamento pré-datado' },
  'job.postDatedBody': {
    en: 'You picked {date}, which is in the future. The invoice will count this money as received today — and payments cannot be deleted in the app. Record it anyway?',
    es: 'Elegiste {date}, una fecha futura. La factura contará este dinero como recibido hoy — y los pagos no se pueden borrar en la app. ¿Registrar igual?',
    pt: 'Você escolheu {date}, uma data futura. A fatura vai contar esse dinheiro como recebido hoje — e a app não apaga pagamentos. Registrar mesmo assim?',
  },
  'job.postDatedConfirm': { en: 'Record it', es: 'Registrar', pt: 'Registrar' },
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
  'job.addPhotoTitle': { en: 'Add a photo', es: 'Agregar una foto', pt: 'Adicionar uma foto' },
  'job.takePhoto': { en: 'Take a photo', es: 'Tomar una foto', pt: 'Tirar uma foto' },
  'job.chooseFromGallery': { en: 'Choose from gallery', es: 'Elegir de la galería', pt: 'Escolher da galeria' },
  'job.cameraDeniedTitle': { en: 'Camera access needed', es: 'Se necesita acceso a la cámara', pt: 'Precisa de acesso à câmera' },
  'job.cameraDeniedBody': { en: 'Enable camera access in Settings to take a photo.', es: 'Activa el acceso a la cámara en Ajustes para tomar una foto.', pt: 'Ative o acesso à câmera nas Configurações para tirar uma foto.' },
  'job.deletePhotoTitle': { en: 'Delete photo?', es: '¿Eliminar foto?', pt: 'Excluir foto?' },
  'job.deletePhotoBody': { en: 'This removes the photo from the job and the client portal.', es: 'Esto quita la foto del trabajo y del portal del cliente.', pt: 'Isso remove a foto do trabalho e do portal do cliente.' },
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
  // delete for good (field request 19+26/07) — owner only, two confirms, honest about what dies
  'job.menu.delete': { en: 'Delete job', es: 'Eliminar trabajo', pt: 'Excluir trabalho' },
  'job.deleteTitle': { en: 'Delete this job?', es: '¿Eliminar este trabajo?', pt: 'Excluir este trabalho?' },
  'job.deleteBody': {
    en: 'Everything goes with it: quote, invoice, contract, payments, photos and progress. This cannot be undone — archiving keeps it out of your list without erasing anything.',
    es: 'Se va todo con él: cotización, factura, contrato, pagos, fotos y progreso. No se puede deshacer; archivarlo lo saca de tu lista sin borrar nada.',
    pt: 'Vai tudo junto: orçamento, fatura, contrato, pagamentos, fotos e progresso. Não dá para desfazer — arquivar tira da sua lista sem apagar nada.',
  },
  'job.deleteWarnPaid': { en: 'This job has {amount} in received payments.', es: 'Este trabajo tiene {amount} en pagos recibidos.', pt: 'Este trabalho tem {amount} em pagamentos recebidos.' },
  'job.deleteWarnSigned': { en: 'The client already SIGNED the contract — that signed copy is erased too.', es: 'El cliente ya FIRMÓ el contrato: esa copia firmada también se borra.', pt: 'O cliente já ASSINOU o contrato — essa cópia assinada também é apagada.' },
  'job.deleteWarnUnknown': {
    en: 'Could not check whether this job has payments or a signed contract — check your connection first.',
    es: 'No se pudo verificar si este trabajo tiene pagos o un contrato firmado; revisa tu conexión antes.',
    pt: 'Não deu para verificar se este trabalho tem pagamentos ou contrato assinado — confira sua conexão antes.',
  },
  'job.deleteFinalTitle': { en: 'Are you sure?', es: '¿Estás seguro?', pt: 'Tem certeza?' },
  'job.deleteFinalBody': { en: 'Last chance — this job is gone for good.', es: 'Última oportunidad: este trabajo desaparece para siempre.', pt: 'Última chance — este trabalho some para sempre.' },
  'job.deleteForever': { en: 'Delete forever', es: 'Eliminar para siempre', pt: 'Excluir para sempre' },
  'job.deleteFailed': { en: 'Could not delete the job', es: 'No se pudo eliminar el trabajo', pt: 'Não foi possível excluir o trabalho' },
  // job photos on the quote: add more / remove one
  'job.addPhotos': { en: 'Add photos', es: 'Agregar fotos', pt: 'Adicionar fotos' },
  'job.photosFailed': { en: '{n} photo(s) could not be uploaded. Try adding them again.', es: 'No se pudieron subir {n} foto(s). Intenta agregarlas de nuevo.', pt: 'Não foi possível enviar {n} foto(s). Tente adicionar de novo.' },
  'job.removePhotoTitle': { en: 'Remove photo?', es: '¿Quitar la foto?', pt: 'Remover a foto?' },
  'job.removePhotoBody': { en: 'It leaves this job and the documents it prints on.', es: 'Sale de este trabajo y de los documentos donde aparece.', pt: 'Ela sai deste trabalho e dos documentos onde aparece.' },
  'job.longPressToRemove': { en: 'Press and hold a photo to remove it.', es: 'Mantén presionada una foto para quitarla.', pt: 'Segure numa foto para removê-la.' },
  // due dates: pick the real day the client agreed to (field request 21/07)
  'job.pickDueDate': { en: 'Due date', es: 'Fecha de pago', pt: 'Data do pagamento' },
  // before / after bookend phases (field request 22/07)
  'job.addBookends': { en: 'Add before & final photo phases', es: 'Agregar fases de fotos inicial y final', pt: 'Adicionar fases de fotos inicial e final' },
  'job.bookendsAddedTitle': { en: 'Before & final photos added', es: 'Fotos inicial y final agregadas', pt: 'Fotos inicial e final adicionadas' },
  'job.bookendsAddedBody': {
    en: 'The job photos went into the before phase. The final one is waiting for the finished work.',
    es: 'Las fotos del trabajo entraron en la fase inicial. La final espera el trabajo terminado.',
    pt: 'As fotos do trabalho entraram na fase inicial. A final está esperando a obra pronta.',
  },
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
type Totals = { subtotal: number; taxableSubtotal: number; tax: number; total: number; taxRate: number; discount: number };
type Tr = (k: string, v?: Record<string, string | number>) => string;

/* ----- opening a client-facing page from inside the app (G-3 / G-4) ----- */
// Until now the ONLY way to reach the progress portal or the contract was to share the link and
// tap it somewhere else — the owner was texting himself on WhatsApp to see his own job. RN's
// Linking hands the URL to the phone's browser: no new native module (expo-web-browser would be
// an in-app sheet, but a new dependency in a build that already lost a week to a phantom one).
async function openClientPage(t: Tr, url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('job.alert.couldNotOpenLink'), t('job.alert.tryAgain'));
  }
}

/* ----- shooting or picking photos: the same two-way choice for job photos and phase photos ----- */
function askPhotoSource(t: Tr, onPick: (mode: 'camera' | 'gallery') => void) {
  Alert.alert(t('job.addPhotoTitle'), undefined, [
    { text: t('job.takePhoto'), onPress: () => onPick('camera') },
    { text: t('job.chooseFromGallery'), onPress: () => onPick('gallery') },
    { text: t('job.cancel'), style: 'cancel' },
  ]);
}
async function choosePhotos(t: Tr, mode: 'camera' | 'gallery'): Promise<{ uri: string }[]> {
  try {
    if (mode === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('job.cameraDeniedTitle'), t('job.cameraDeniedBody'));
        return [];
      }
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      return shot.canceled ? [] : (shot.assets || []).map((a) => ({ uri: a.uri }));
    }
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8, selectionLimit: 10 });
    return res.canceled ? [] : (res.assets || []).map((a) => ({ uri: a.uri }));
  } catch (e: any) {
    Alert.alert(t('job.error'), e?.message || t('job.alert.tryAgain'));
    return [];
  }
}

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
  // G-9: the job can hold more than one invoice. `invSel` is the one the screen acts on (payments,
  // plan, PDF, receipts); it defaults to the newest, which is exactly what a one-invoice job had.
  const invoices = detail?.invoices || [];
  const [invSel, setInvSel] = useState<string | null>(null);
  // default selection = the first invoice that still owes money (that is the one the owner is
  // about to act on); everything paid → the newest, which is what a one-invoice job always showed
  // an invoice closed BY a credit is not "the one still owing" — it would keep being the selected
  // one and the screen would act on a settled document
  const firstOwing = invoices.find((i) => invoiceBalance(invoiceDue(i.total, i.creditTotal), i.amountPaid) > 0.005);
  const inv = (invSel ? invoices.find((i) => i.id === invSel) : undefined) || firstOwing || detail?.invoice || undefined;
  // every number the HEADER shows is the roll-up of all of them — a $10,400 job must never read
  // as $2,400 just because that is the newest invoice
  const roll = invoiceRollup(invoices);
  // stage derived from the DB (estimate/invoice status) once detail loads; falls back to the list value
  // stage from the WHOLE set: a complementary invoice pulls a "Paid" job back to "Invoiced",
  // which is the truth — there is money still to come in. Single source: the roll-up.
  const invAggStatus = roll.count ? (roll.status === 'Paid' ? 'Paid' : 'Unpaid') : undefined;
  const baseStage: Stage = detail ? deriveStage(est?.status, invAggStatus) : job ? job.stage : 'Quoted';
  const stage = store.stageOverride[id] || baseStage;
  // closed (lost/archived) is orthogonal to the stage — detail (fresh) wins over the list params
  const closed: ClosedKind | null = detail ? detail.closed : job?.closed ?? null;
  const realClient = detail?.client || null;
  // new job (not yet persisted): show the AI estimate the user just generated, held in the store
  const items = detail?.items?.length ? detail.items : job ? [] : store.items;
  const taxRate = est?.taxRate ?? store.taxRate ?? 8.25;
  // margin always 0: new scheme embeds it in prices; legacy display trusts the SAVED totals below
  // G-1: the saved discount rides along so the live recompute matches what the DB trigger stored
  const grossComputed = calcTotals(items, taxRate, 0);
  const computed = calcTotals(items, taxRate, 0, resolveDiscount(grossComputed.subtotal, est?.discount ?? NO_DISCOUNT));
  // stored DB totals are the source of truth (trigger); fall back to computed for mock/no-estimate
  const quoteTotals: Totals = est
    ? // every line of a saved document comes from the DB — subtotal, tax and total always did, and
      // the DISCOUNT has to as well. Recomputing it in JS made the four printed lines disagree by a
      // cent whenever the two round a half-cent tie differently (Math.round is float, numeric(12,2)
      // is exact): the PDF said "8.746,71 − 4.373,35 + 218,18 = 4.591,53" and the contract, which
      // reads the DB, printed 4.373,36. resolveDiscount is for the PREVIEW of what is not saved yet.
      { subtotal: est.subtotal, taxableSubtotal: computed.taxableSubtotal, tax: est.tax, total: est.total, taxRate, discount: est.discount.amount }
    : { ...computed, taxRate };
  const invoiceTotals: Totals = inv
    ? {
        subtotal: inv.subtotal,
        // a change order's taxable slice is not the quote's — recover the one that produced its
        // frozen tax, so the printed "Tax (7% on $X)" is arithmetically true on that document too
        taxableSubtotal: inv.isChangeOrder ? (inv.taxRate > 0 ? round2(inv.tax / (inv.taxRate / 100)) : 0) : computed.taxableSubtotal,
        tax: inv.tax,
        total: inv.total,
        taxRate: inv.taxRate,
        discount: inv.discount,
      }
    : quoteTotals;
  // header total mirrors fetchJobs (invoice total wins over the estimate's) so the list and this
  // header never diverge; the stale params value only bridges the gap while detail is loading.
  const headerTotal = detail ? (roll.count ? roll.total : quoteTotals.total) : job ? job.value : quoteTotals.total;
  const [vd, vc] = split(headerTotal);
  const name = job ? job.title : params?.title || (store.svcs[0] ? t('job.jobSuffix', { svc: store.svcs[0] }) : t('job.newEstimate'));
  // header prefers the REAL client from the DB — right after save the flow store is already
  // reset (aSel/aLoc cleared), so deriving from the store showed "No client" on a fresh job
  const cName = realClient?.name || (job ? job.client : client?.name) || t('job.noClient');
  // job-site line for documents (G5) + the header address, which now prefers the WORK address
  const jobSite = jobSiteLine(detail?.jobSite);
  const addr = detail?.jobSite.address || realClient?.addr || (job ? job.addr : client?.addr || store.aLoc?.city) || t('job.noAddress');
  const next = NEXT[stage];
  // G-9: a change order bills an AGREED AMOUNT, so its document shows one line for that amount —
  // printing the quote's items under a partial total handed the client a $2,400 invoice listing
  // $10,000 of work. English by the client-facing rule, like every other string on a document.
  // a linha única da complementar: o que o contratante escreveu ("Extra drywall patch and paint"),
  // caindo no genérico só quando a fatura é antiga e não tem descrição gravada
  const changeOrderItems = (i: JobDetail['invoice']): LineItem[] =>
    i ? [{ id: -1, cat: 'Change order', desc: i.changeNote || 'Additional work per change order', qty: 1, unit: 'job', price: i.subtotal, taxable: i.tax > 0.005 }] : [];
  const docItems = inv?.isChangeOrder ? changeOrderItems(inv) : items;
  // G-5: a payment landed but the invoice is not closed. The pipeline Stage has no room for it
  // (a half-paid invoice is still "Invoiced"), so the header said nothing and the owner read the
  // job as "he hasn't paid anything" — the PARTIAL badge lived only inside the Invoice tab.
  const paidSoFar = roll.paid;
  const jobBalance = roll.balance;
  const partiallyPaid = roll.count > 0 && paidSoFar > 0.005 && jobBalance > 0.005;
  const queryClient = useQueryClient();

  /* ----- F12 payment plan + received payments ----- */
  // local state on purpose (never the global store) — nothing leaks between jobs
  const [planSheet, setPlanSheet] = useState<null | 'generate' | 'edit' | 'extra'>(null); // 'extra' = G-9 complementary invoice
  const [savingPlan, setSavingPlan] = useState(false);
  const [paySheet, setPaySheet] = useState(false);
  const [creditSheet, setCreditSheet] = useState(false);
  const [savingCredit, setSavingCredit] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const invoicePlan = inv ? planFromInvoice(inv) : null;
  // D6: the agreement is frozen against invoice #1. Showing the SELECTED invoice's plan under a
  // green "Signed" chip told the owner the client had signed a $2,400 change order he never saw.
  const contractInv = invoices[0] || inv;
  // o plano exibido na aba Contract segue o mesmo abatimento do valor: sem isso as parcelas somavam
  // o bruto embaixo de um total líquido, e a tela discordava do papel que o cliente assina
  const contractPlan = contractInv ? planFromInvoice(contractInv) : null;
  // Com contrato JÁ gerado a tela mostra o RETRATO dele (agreements.total_amount); sem contrato,
  // mostra o valor de hoje — que é o que será congelado quando ele gerar. Sob um chip "Assinado",
  // exibir o número de hoje seria dizer que o cliente assinou outra coisa.
  const frozenTotal = detail?.agreement?.totalAmount ?? null;
  // quanto do abatimento o CONTRATO já refletia: se foi gerado depois do abatimento, o retrato já é
  // líquido e as parcelas não podem descontar de novo
  const contractCredited = frozenTotal != null ? round2(Math.max(0, (contractInv?.total || 0) - frozenTotal)) : contractInv?.creditTotal || 0;
  const contractTotals: Totals = contractInv
    ? { subtotal: contractInv.subtotal, taxableSubtotal: 0, tax: contractInv.tax, total: frozenTotal != null ? frozenTotal : invoiceDue(contractInv.total, contractInv.creditTotal), taxRate: contractInv.taxRate, discount: contractInv.discount }
    : quoteTotals;
  // credits come off before the balance: what the client owes is the DUE amount, not the billed one
  const balance = inv ? invoiceBalance(invoiceDue(inv.total, inv.creditTotal), inv.amountPaid) : 0;

  /* ----- document photos (G2): which job photos print on the quote PDF ----- */
  const docPhotos = detail?.docPhotoUrls || [];
  const onToggleDocPhoto = async (url: string) => {
    if (!projectId || !detail) return;
    const next = toggleDocPhoto(docPhotos, detail.photoUrls, url);
    if (!next) {
      // a silent no-op at the cap is what "the app eats my photos" feels like — say the limit out loud
      if (!docPhotos.includes(url) && docPhotos.length >= DOC_PHOTO_CAP) {
        Alert.alert(t('job.docPhotoCapTitle', { cap: DOC_PHOTO_CAP }), t('job.docPhotoCapBody'));
      }
      return;
    }
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
  /* ----- delete the job for good (owner only — the RLS has no office DELETE on projects) ----- */
  const [deletingJob, setDeletingJob] = useState(false);
  const doDeleteJob = async () => {
    if (!projectId || !ownerId || deletingJob) return;
    setDeletingJob(true);
    try {
      await deleteProject(ownerId, projectId);
      queryClient.removeQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] }); // the client's job count changed
      go('jobs', {}, 'tab'); // the screen we're on no longer exists — never `back()` into it
    } catch (e: any) {
      Alert.alert(t('job.deleteFailed'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setDeletingJob(false);
    }
  };
  // two confirms, and the first one SAYS what is about to die (money received / signed contract)
  const confirmDeleteJob = () => {
    if (!projectId) return;
    setMenuOpen(false);
    // 380ms: an Alert presented while the menu Modal is still dismissing dies with it on iOS
    setTimeout(() => {
      void (async () => {
        const facts = await projectDeleteFacts(projectId);
        const warn = [
          facts.unknown ? t('job.deleteWarnUnknown') : '',
          facts.paid > 0 ? t('job.deleteWarnPaid', { amount: fmt(facts.paid) }) : '',
          facts.signed ? t('job.deleteWarnSigned') : '',
        ]
          .filter(Boolean)
          .join('\n');
        Alert.alert(t('job.deleteTitle'), warn ? `${warn}\n\n${t('job.deleteBody')}` : t('job.deleteBody'), [
          { text: t('job.cancel'), style: 'cancel' },
          {
            text: t('job.delete'),
            style: 'destructive',
            onPress: () =>
              setTimeout(
                () =>
                  Alert.alert(t('job.deleteFinalTitle'), t('job.deleteFinalBody'), [
                    { text: t('job.cancel'), style: 'cancel' },
                    { text: t('job.deleteForever'), style: 'destructive', onPress: () => { void doDeleteJob(); } },
                  ]),
                380
              ),
          },
        ]);
      })();
    }, 380);
  };

  /* ----- job photos: add more after the capture / drop one (field report 26/07) ----- */
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProg, setPhotoProg] = useState<{ done: number; total: number } | null>(null); // G-2
  // the PDF now embeds its photos before printing — long enough that a second tap would race
  const [sendBusy, setSendBusy] = useState(false);
  const addJobPhotos = () => {
    if (!projectId || !ownerId || photoBusy) return;
    askPhotoSource(t, (mode) => {
      void (async () => {
        const assets = await choosePhotos(t, mode);
        if (!assets.length) return;
        setPhotoBusy(true);
        setPhotoProg({ done: 0, total: assets.length });
        try {
          const { added, failed } = await addProjectPhotos(ownerId, projectId, assets, (done, total) => setPhotoProg({ done, total }));
          await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
          await queryClient.invalidateQueries({ queryKey: ['jobs'] }); // the card thumbnail/count
          // never silent: a photo that didn't make it is said out loud (that's how 8 became 3)
          if (failed) Alert.alert(t('job.alert.uploadFailed'), t('job.photosFailed', { n: failed }));
          else if (!added) Alert.alert(t('job.alert.uploadFailed'), t('job.alert.noPhotosAdded'));
        } catch (e: any) {
          Alert.alert(t('job.alert.couldNotAddPhotos'), e?.message || t('job.alert.tryAgain'));
        } finally {
          setPhotoBusy(false);
          setPhotoProg(null);
        }
      })();
    });
  };
  const removeJobPhoto = (url: string) => {
    if (!projectId) return;
    Alert.alert(t('job.removePhotoTitle'), t('job.removePhotoBody'), [
      { text: t('job.cancel'), style: 'cancel' },
      {
        text: t('job.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteProjectPhoto(projectId, url);
              await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
              await queryClient.invalidateQueries({ queryKey: ['jobs'] });
            } catch (e: any) {
              Alert.alert(t('job.error'), e?.message || t('job.couldNotDelete'));
            }
          })();
        },
      },
    ]);
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
  // G-9: the quote grew past what is already invoiced (typically after the client paid a deposit
  // and the work expanded). The difference becomes a SECOND invoice with its own plan — the first
  // one keeps the money that already landed, untouched.
  // contra o BRUTO faturado, nunca contra o líquido: senão perdoar um saldo faz o app pedir para
  // cobrá-lo de novo, num laço (achado da verificação de fluxo, com job real de produção)
  const extraToInvoice = uninvoiced(quoteTotals.total, roll.billed);
  const canAddInvoice = !closed && role !== 'field' && roll.count > 0 && extraToInvoice > 0.005 && !!est?.id && !!projectId;
  // the mirror (05/09): the quote fell BELOW what was billed — material returned after the client
  // already paid part. The invoice stopped following the quote then, so the gap becomes a credit.
  const creditToApply = overbilled(quoteTotals.total, roll.total);
  // ...e ele tem que sair de uma fatura que AINDA tenha saldo. As duas metades do par precisam olhar
  // a mesma coisa: "cobrar" nasce do job inteiro, então "tirar" também — escolhendo a fatura que
  // consegue absorver o valor, senão num job com 2 faturas (a #1 quitada) o cartão oferecia $0.
  const creditTarget = pickCreditTarget(invoices) || inv;
  // the door is open whenever there IS an invoice: the sheet itself explains when there is no room
  // (client already paid in full), which is a real case the owner has to see, not a dead end
  const canAddCredit = !closed && !!creditTarget && role !== 'field';
  // O VÃO ENTRE OS DOIS LADOS era a trava de verdade (mapa da jornada, 05/09): ao salvar o
  // orçamento de um job já faturado, o app voltava na aba Orçamento, nada dizia que a fatura do
  // cliente tinha ficado velha, e o cartão "PRÓXIMO PASSO" ainda apontava para "Registrar
  // pagamento". O recurso inteiro dependia de o contratante trocar de aba por conta própria, sem
  // motivo nenhum para isso. Agora o app fala primeiro. Pergunta uma vez por job e por valor
  // ENQUANTO O APP ESTIVER ABERTO (o store não é persistido); alternar entre dois jobs com
  // diferença não faz nenhum dos dois repetir.
  useEffect(() => {
    if (closed || !projectId || !roll.count || role === 'field') return;
    const grew = extraToInvoice > 0.005 && canAddInvoice;
    // só oferece TIRAR se alguma fatura consegue absorver: numa fatura já quitada o aviso levava a
    // uma folha que respondia "não há o que tirar" — beco sem saída oferecido pelo próprio app
    const room = creditTarget ? creditRoom(creditTarget.total, creditTarget.creditTotal, creditTarget.amountPaid) : 0;
    const shrank = creditToApply > 0.005 && canAddCredit && room > 0.005;
    if (!grew && !shrank) return;
    // o valor anunciado é o mesmo que a folha vai abrir — o aviso dizia "$200" e a folha abria "$40"
    const amount = grew ? extraToInvoice : Math.min(creditToApply, room);
    const key = `${projectId}:${grew ? 'up' : 'down'}:${amount.toFixed(2)}`;
    if (store.diffAsked.includes(key)) return;
    up((st) => ({ diffAsked: [...st.diffAsked.slice(-19), key] }));
    Alert.alert(
      grew ? t('job.addInvoiceTitle', { amount: fmt(amount) }) : t('job.creditCardTitle', { amount: fmt(amount) }),
      grew ? t('job.addInvoiceBody') : t('job.creditCardBody'),
      [
        { text: t('job.notNow'), style: 'cancel' },
        {
          text: grew ? t('job.createExtraInvoice', { amount: fmt(amount) }) : t('job.applyCredit', { amount: fmt(amount) }),
          onPress: () => {
            setTab('invoice');
            if (grew) openExtraInvoice();
            else setCreditSheet(true);
          },
        },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, extraToInvoice, creditToApply, roll.count, closed, canAddInvoice, canAddCredit, role, creditTarget, store.diffAsked]);
  const openExtraInvoice = () => {
    if (!canAddInvoice) return;
    setPlanSheet('extra');
  };
  const confirmPlan = async (plan: PaymentPlan, what?: string) => {
    if (!ownerId) return;
    const editing = planSheet === 'edit';
    // freeze for the post-invoice phases prompt below — invalidate refreshes `est` under us
    const [uid, estId, pid, nItems] = [ownerId, est?.id, projectId, items.length];
    setSavingPlan(true);
    try {
      let downgraded = false;
      if (editing && inv) ({ downgraded } = await updateInvoicePlan(ownerId, inv.id, plan));
      else if (planSheet === 'extra' && est?.id && projectId) {
        // the extra invoice bills an AMOUNT broken down at the quote's real tax rate, so its own
        // document adds up line by line (subtotal + tax on the taxable slice = amount)
        const split = splitChangeOrder(extraToInvoice, quoteTotals.subtotal, quoteTotals.taxableSubtotal, quoteTotals.taxRate);
        const created = await createInvoice(ownerId, est.id, projectId, plan, { subtotal: split.subtotal, tax: split.tax, total: split.total }, what);
        downgraded = created.downgraded;
        // select the invoice that was just created: the default ("first one still owing") would
        // land back on #1, and the very next tap — Send invoice / PDF — would send the wrong one
        setInvSel(created.id);
      } else if (est?.id && projectId) ({ downgraded } = await createInvoice(ownerId, est.id, projectId, plan));
      else return;
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPlanSheet(null);
      clearStage(); // invoice now exists → DB-derived stage becomes "Invoiced"
      setTab('invoice');
      // the schedule insert failed and the plan fell back to a single payment — say so, never silently
      // (380ms: an Alert presented while the sheet Modal is still dismissing dies with it on iOS)
      if (downgraded) setTimeout(() => Alert.alert(t('job.planDowngradedTitle'), t('job.planDowngradedBody')), 380);
      else if (planSheet === 'extra') {
        // a complementar nascia e nunca saía: o botão gordo da aba é "Registrar pagamento" e o
        // "PRÓXIMO PASSO" também aponta para lá, então o documento do extra ficava parado
        setTimeout(() => Alert.alert(t('job.extraInvoiceDone'), t('job.extraInvoiceDoneBody', { amount: fmt(extraToInvoice) }), [
          { text: t('job.notNow'), style: 'cancel' },
          { text: t('job.sendInvoice'), onPress: () => requireCompany(() => up({ sheet: true, jobTab: 'invoice' })) },
        ]), 380);
      }
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
  const confirmCredit = async (amount: number, reason: string) => {
    if (!ownerId || !creditTarget?.id) return;
    setSavingCredit(true);
    try {
      await addInvoiceCredit(ownerId, creditTarget.id, { amount, reason });
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCreditSheet(false);
      clearStage();
      // sem isso o abatimento era silencioso e o cliente ficava com o PDF do valor velho — o
      // documento é a razão de existir do recurso, não o número na tela do contratante
      const novoSaldo = invoiceBalance(invoiceDue(creditTarget.total, round2(creditTarget.creditTotal + amount)), creditTarget.amountPaid);
      setInvSel(creditTarget.id);
      setTimeout(() => Alert.alert(t('job.creditDone'), t('job.creditDoneBody', { balance: fmt(novoSaldo) }), [
        { text: t('job.notNow'), style: 'cancel' },
        { text: t('job.sendInvoice'), onPress: () => requireCompany(() => up({ sheet: true, jobTab: 'invoice' })) },
      ]), 380);
    } catch (e: any) {
      const msg =
        e?.code === 'CREDIT_OVER_ROOM'
          ? e.room > 0
            ? t('job.creditMax', { amount: fmt(e.room) })
            : t('job.creditNoRoom')
          : e?.message || t('job.alert.tryAgain');
      Alert.alert(t('job.couldNotCredit'), msg);
    } finally {
      setSavingCredit(false);
    }
  };
  const removeCredit = (c: { id: string; amount: number }) => {
    if (!inv?.id) return;
    Alert.alert(t('job.removeCreditTitle'), t('job.removeCreditBody', { amount: fmt(c.amount) }), [
      { text: t('job.notNow'), style: 'cancel' },
      {
        text: t('job.removeCredit'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteInvoiceCredit(inv.id, c.id);
              await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
              await queryClient.invalidateQueries({ queryKey: ['jobs'] });
              clearStage();
            } catch (e: any) {
              Alert.alert(t('job.couldNotCredit'), e?.message || t('job.alert.tryAgain'));
            }
          })();
        },
      },
    ]);
  };
  const confirmPayment = async (amount: number, method: string | null, note: string, paidAt: string) => {
    if (!ownerId || !inv?.id) return;
    // a future date is allowed on purpose (the post-dated check the owner asked for), but it closes
    // the invoice with money that has not cleared and there is no void in the app — so it asks
    if (paidAt > toDateOnly(new Date())) {
      const pretty = parseDateOnly(paidAt).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric', year: 'numeric' });
      Alert.alert(t('job.postDatedTitle'), t('job.postDatedBody', { date: pretty }), [
        { text: t('job.notNow'), style: 'cancel' },
        { text: t('job.postDatedConfirm'), onPress: () => void confirmPaymentChecked(amount, method, note, paidAt) },
      ]);
      return;
    }
    void confirmPaymentChecked(amount, method, note, paidAt);
  };
  const confirmPaymentChecked = async (amount: number, method: string | null, note: string, paidAt: string) => {
    if (!ownerId || !inv?.id) return;
    // guard a fat-finger overpayment ($9409 for a $940.90 balance): the ledger is append-only,
    // there's no in-app refund, and the receipt would print a wrong "Paid in full" (final-review M1)
    // com abatimento na fatura, o saldo real é o líquido: usando o bruto, uma fatura de $580.55
    // abatida em $40 aceitava calado um pagamento de $290.28 que já é a maior
    const balanceNow = invoiceBalance(invoiceDue(inv.total, inv.creditTotal), inv.amountPaid);
    if (amount > balanceNow + 0.005) {
      Alert.alert(
        t('job.overpayTitle'),
        t('job.overpayBody', { amount: fmt(amount), balance: fmt(balanceNow) }),
        [
          { text: t('job.notNow'), style: 'cancel' },
          { text: t('job.overpayConfirm'), onPress: () => void doRecordPayment(amount, method, note, paidAt) },
        ]
      );
      return;
    }
    void doRecordPayment(amount, method, note, paidAt);
  };
  const doRecordPayment = async (amount: number, method: string | null, note: string, paidAt: string) => {
    if (!ownerId || !inv?.id) return;
    const invoice = inv; // freeze — detail refetches under the alert below
    setSavingPay(true);
    try {
      const { id: paymentId } = await recordInvoicePayment(ownerId, invoice.id, { amount, method, note, paidAt });
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPaySheet(false);
      clearStage();
      // chronological, NOT "total − everything paid": with a back-dated payment the two disagree,
      // and this receipt carries the same number the re-issue will print (reviewer finding).
      const balanceAfter = balanceAfterNewPayment(invoiceDue(invoice.total, invoice.creditTotal), invoice.payments || [], { id: paymentId, amount, paidAt });
      // 380ms: the receipt offer (G3) was racing the sheet's dismiss animation and could vanish
      setTimeout(() => Alert.alert(t('job.paymentRecordedTitle'), t('job.sendReceiptBody', { amount: fmt(amount) }), [
        { text: t('job.notNow'), style: 'cancel' },
        {
          text: t('job.sendReceipt'),
          // the receipt carries the day the client PAID, not the day it was typed in — that is the
          // whole point of the date field ("recebeu ontem… hoje vai fazer o recibo")
          onPress: () => requireCompany(() => { void sendReceipt(paymentId, { amount, method, note, date: paidAt, balanceAfter }, invoice.number); }),
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
  const sendReceipt = async (paymentId: string, p: { amount: number; method: string | null; note?: string | null; date: string; balanceAfter: number }, invoiceNumber?: string) => {
    if (receiptBusy) return;
    setReceiptBusy(paymentId);
    try {
      // o número e o saldo são congelados juntos: reemitir devolve o retrato, nunca uma conta nova.
      // `p.balanceAfter` só é usado na PRIMEIRA emissão (e em recibos antigos, sem retrato).
      const minted = await ensureReceiptNumber(paymentId, p.balanceAfter);
      const number = minted.number;
      const balanceAfter = minted.balanceAfter != null ? minted.balanceAfter : p.balanceAfter;
      const co = (company as any) || {};
      await sendDoc('Save PDF', {
        kind: 'receipt',
        docLabel: 'Receipt', // client-facing, English by design
        number,
        company: { name: co.company_name || t('job.yourCompany'), license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email, logo: co.logo_url },
        client: realClient,
        items: [],
        totals: { subtotal: 0, tax: 0, total: p.amount, taxRate: 0 }, // unused by the receipt branch
        receipt: { number, date: p.date, method: p.method, reference: p.note || null, amount: p.amount, invoiceNumber, balanceAfter },
      });
    } catch (e: any) {
      Alert.alert(t('job.couldNotCreateReceipt'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setReceiptBusy(null);
    }
  };
  // re-issue from a ledger row: the balance shown is the one AS OF that payment.
  // Credits come off first: without that, the receipt for the payment that CLOSED a credited
  // invoice printed "Remaining balance $40" while the app showed it as Paid.
  const onReceiptRow = (p: PaymentRecord) => {
    if (!inv) return;
    // Recibo JÁ numerado sem retrato guardado = papel antigo: vale a regra por data, para não
    // reescrever o que o cliente tem na mão. Recibo ainda não emitido: o retrato é o estado de
    // AGORA — congelar o saldo de uma data velha deixaria o papel novo nascendo errado.
    const jaEmitido = !!p.receiptNumber && p.balanceAfter == null;
    const dueThen = jaEmitido
      ? invoiceDue(inv.total, creditTotalUpTo(inv.credits, p.paidAt))
      : invoiceDue(inv.total, inv.creditTotal);
    requireCompany(() => { void sendReceipt(p.id, { amount: p.amount, method: p.method, note: p.note, date: p.paidAt, balanceAfter: balanceAfterPayment(dueThen, inv.payments, p.id) }, inv.number); });
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
  // G-4: the owner was sending the signing link to his own WhatsApp just to READ the contract
  const viewContract = () => {
    const tk = detail?.agreement?.token;
    if (tk) void openClientPage(t, agreementLink(tk));
  };
  const generateContract = async () => {
    if (detail?.agreement) return shareContract(detail.agreement.token); // existing doc — resharing is safe
    if (!inv) { Alert.alert(t('job.alert.invoiceNeeded'), t('job.alert.generateInvoiceFirst')); return; }
    // a client is optional on a job/invoice but REQUIRED for a contract — pre-check with a localized
    // message (createAgreement would otherwise throw its English string into a pt/es alert; L2)
    if (!realClient) { Alert.alert(t('job.alert.clientNeeded'), t('job.alert.clientNeededBody')); return; }
    if (!ownerId || !projectId) return;
    // D6: the contract ALWAYS freezes invoice #1 — the original agreement.
    //
    // My previous attempt here read `detail?.agreement ? invoices[0] : inv`, which is a dead branch:
    // line 874 already returned when an agreement exists, so it collapsed to "always the selected
    // invoice". With the default selection landing on the first invoice that still owes money, a
    // job whose #1 was paid would generate a contract for the CHANGE ORDER — and `createAgreement`
    // builds the item table from the estimate's line_items while taking the price from the invoice,
    // so the client would be asked to sign $10,400 of work at a contract price of $2,400. That is
    // the exact bug this wave fixed on the invoice, in the one document that gets signed.
    // Contracting a change order needs createAgreement to understand is_change_order first.
    const [uid, pid, invId] = [ownerId, projectId, (invoices[0] || inv).id];
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
            {closed ? <ClosedChip kind={closed} lg /> : !fieldMode ? <StageChip stage={stage} lg partial={partiallyPaid} /> : null}
          </Between>
          {showMoney ? (
            <Text style={{ fontFamily: fonts.num, fontSize: 32, color: colors.ink, marginTop: 14, letterSpacing: -0.6 }}>
              {vd}<Text style={{ color: colors.muted }}>{vc}</Text>
            </Text>
          ) : null}
          {showMoney && partiallyPaid ? (
            // the two numbers that matter the moment a partial payment lands
            <Row style={{ gap: 8, marginTop: 6 }}>
              <Icon name="wallet" size={13} color={colors.info} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.info }}>
                {t('job.paidOfTotal', { paid: fmt(paidSoFar), total: fmt(roll.total) })} · {t('job.balanceLeft', { amount: fmt(jobBalance) })}
              </Text>
            </Row>
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink, marginTop: 2 }}>
                  {t('job.next.' + next.act)}
                  {/* "Record payment" alone reads as "nothing came in yet" once a deposit landed */}
                  {showMoney && partiallyPaid ? <Text style={{ color: colors.muted }}> · {t('job.balanceLeft', { amount: fmt(jobBalance) })}</Text> : null}
                </Text>
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
            // photos can join the job at any time now, not only during the capture flow
            onAddPhotos={projectId && !closed ? addJobPhotos : undefined}
            // a closed job is the archive: it can't gain photos, so it must not lose them either
            onRemovePhoto={projectId && !closed ? removeJobPhoto : undefined}
            photoBusy={photoBusy}
            photoProgress={photoProg}
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
                    up({ items, taxRate: quoteTotals.taxRate, marginRate: legacy ? est.legacyMarginRate : est.markupPercent, discount: est.discount, editing: null, custNote: est.customerNote || '', custNoteSrc: est.customerNoteSrc || '' });
                    go('estimate', { editJob: { projectId, estimateId: est.id } });
                  }
                : undefined
            }
            onSend={est && projectId && !closed ? () => requireCompany(() => up({ sheet: true })) : undefined}
          />
        )}
        {tab === 'invoice' && <InvoiceTab stage={stage} items={docItems} totals={invoiceTotals} client={realClient} jobSite={jobSite} company={company} invoice={inv} invoices={invoices} onSelectInvoice={setInvSel} roll={roll} extraToInvoice={extraToInvoice} onAddInvoice={canAddInvoice ? openExtraInvoice : undefined} creditToApply={creditToApply} creditRoomTarget={creditTarget ? creditRoom(creditTarget.total, creditTarget.creditTotal, creditTarget.amountPaid) : 0} onAddCredit={canAddCredit ? () => setCreditSheet(true) : undefined} onRemoveCredit={!closed && role !== 'field' ? removeCredit : undefined} quoteTotal={est?.total} genning={savingPlan} onGen={openGenerateInvoice} onRecordPayment={() => setPaySheet(true)} onEditPlan={() => setPlanSheet('edit')} onReceipt={onReceiptRow} receiptBusyId={receiptBusy} setSheet={(b: boolean) => (b ? requireCompany(() => up({ sheet: true })) : up({ sheet: false }))} />}
        {tab === 'contract' && <ContractTab agreement={detail?.agreement || null} hasInvoice={!!inv} totals={contractTotals} plan={contractPlan} credited={contractCredited} company={company} genning={genningContract} onGenerate={generateContract} onView={detail?.agreement ? viewContract : undefined} />}
        {tab === 'progress' && (
          <ProgressTab
            projectId={projectId}
            estimateId={est?.id || null}
            // storage paths & row user_id stay keyed by the OWNER — a member's photos land in the
            // owner's folders so the whole team (and the client portal) sees one project album
            userId={ownerId || null}
            items={items}
            // how many capture photos exist: with none, there is nothing to put in a "Before
            // photos" phase, so the offer to create the bookends shouldn't nag forever
            jobPhotos={(detail?.photoUrls || []).length}
            // comments sign with the member's own name; the owner keeps signing as the company
            authorName={role !== 'owner' && memberName ? memberName : (company as any)?.company_name || t('job.companyFallback')}
          />
        )}
      </ScrollView>

      <SendSheet
        open={store.sheet}
        onClose={() => (sendBusy ? undefined : up({ sheet: false }))}
        what={tab === 'invoice' ? 'invoice' : tab === 'contract' ? 'contract' : 'quote'}
        busy={sendBusy}
        onSent={(option: string) => {
          if (sendBusy) return;
          const kind = tab === 'invoice' ? 'invoice' : tab === 'contract' ? 'contract' : 'quote';
          const tt = kind === 'invoice' ? invoiceTotals : quoteTotals;
          const co = (company as any) || {};
          const payload: SendData = {
            kind,
            // English on purpose: docLabel prints on the PDF header and the email subject (client-facing)
            docLabel: kind === 'invoice' ? 'Invoice' : kind === 'contract' ? 'Agreement' : 'Quote',
            number: kind === 'invoice' ? inv?.number : undefined,
            company: { name: co.company_name || t('job.yourCompany'), license: co.company_license, address: co.company_address, phone: co.company_phone, email: co.company_email, logo: co.logo_url },
            client: realClient,
            jobSite: jobSite || undefined, // English job-site line on quote & invoice (G5)
            customerNote: (kind !== 'contract' && est?.customerNote) || undefined, // "Notes" section (G1)
            photos: kind === 'quote' && docPhotos.length ? docPhotos : undefined, // curated photos (G2)
            items: kind === 'invoice' ? docItems : items,
            totals: tt,
            // credits print under the total with their reason, and the revised total follows —
            // the client already holds a document for the original amount
            credits: kind === 'invoice' && inv?.credits.length ? inv.credits.map((c) => ({ amount: c.amount, reason: c.reason, date: toDateOnly(new Date(c.createdAt)) })) : undefined,
            // invoice PDF/text: the payment plan + what's already paid (English by design)
            payment:
              kind === 'invoice' && inv && invoicePlan
                ? {
                    // the credit is taken off the last instalments so the schedule and the revised
                    // total tell the same story (a client cannot be asked to add two numbers up)
                    rows: applyCreditToRows(planRows(invoicePlan, inv.total), inv.creditTotal).map((r) => ({ label: r.label, amount: r.amount, due: r.dueDate })),
                    paid: inv.amountPaid,
                    balance,
                    // itemized ledger (field feedback 07/07): the doc should show WHAT was received
                    received: inv.payments.map((p) => ({ date: p.paidAt, method: p.method, amount: p.amount })),
                  }
                : undefined,
          };
          // The PDF route embeds every photo before printing (seconds). Keep the sheet up with its
          // spinner until it returns, so the contractor never taps twice and races two share sheets;
          // the text routes (mail/sms/whatsapp) are instant and close right away as before.
          const isPdf = option === 'Save PDF';
          if (!isPdf) up({ sheet: false });
          setSendBusy(true);
          void sendDoc(option, payload).finally(() => {
            setSendBusy(false);
            if (isPdf) up({ sheet: false });
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
        total={planSheet === 'edit' && inv ? inv.total : planSheet === 'extra' ? extraToInvoice : quoteTotals.total}
        initial={planSheet === 'edit' && invoicePlan ? invoicePlan : defaultPlan}
        hasPayments={planSheet === 'edit' && !!inv?.payments.length}
        busy={savingPlan}
        confirmLabel={planSheet === 'edit' ? t('job.savePlan') : planSheet === 'extra' ? t('job.createExtraInvoice', { amount: fmt(extraToInvoice) }) : t('job.generateInvoice')}
        askWhat={planSheet === 'extra'}
        whatSuggestion={planSheet === 'extra' ? (items[items.length - 1]?.desc || '') : ''}
        onConfirm={confirmPlan}
      />
      <RecordPaymentSheet open={paySheet} onClose={() => setPaySheet(false)} balance={balance} busy={savingPay} onConfirm={confirmPayment} />
      <CreditSheet
        open={creditSheet}
        onClose={() => setCreditSheet(false)}
        suggestion={creditToApply}
        room={creditTarget ? creditRoom(creditTarget.total, creditTarget.creditTotal, creditTarget.amountPaid) : 0}
        taxRate={creditTarget?.taxRate || 0}
        busy={savingCredit}
        onConfirm={confirmCredit}
      />
      <JobMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        closed={closed}
        busy={closingBusy || deletingJob}
        canApprove={canApproveDirectly}
        canAssign={role === 'owner' && !!projectId}
        // deleting is the owner's alone: projects has no office DELETE policy, so the office
        // button would report success on 0 rows and the job would come right back
        canDelete={role === 'owner' && !!projectId}
        onAssign={openAssign}
        onApprove={() => { setMenuOpen(false); void setEstimateStatus('Approved', 'Approved'); }}
        onMarkLost={confirmMarkLost}
        onArchive={() => { void setProjectStatus('Archived'); }}
        onReopen={() => { void setProjectStatus('Active'); }}
        onDelete={confirmDeleteJob}
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
function JobMenuSheet({ open, onClose, closed, busy, canApprove, canAssign, canDelete, onAssign, onApprove, onMarkLost, onArchive, onReopen, onDelete }: { open: boolean; onClose: () => void; closed: ClosedKind | null; busy: boolean; canApprove: boolean; canAssign: boolean; canDelete: boolean; onAssign: () => void; onApprove: () => void; onMarkLost: () => void; onArchive: () => void; onReopen: () => void; onDelete: () => void }) {
  const t = useT();
  // delete sits LAST and stays available on a closed job too — "I made one just to try it and
  // want it gone" is exactly the case the owner reported, and those end up archived first
  const deleteRow = canDelete ? [{ key: 'delete', ico: 'trash', col: colors.error, bg: colors.errorTint, label: t('job.menu.delete'), onPress: onDelete }] : [];
  const rows: { key: string; ico: string; col: string; bg: string; label: string; onPress: () => void }[] = closed
    ? [{ key: 'reopen', ico: 'trend', col: colors.primary, bg: colors.primaryTint, label: t('job.menu.reopen'), onPress: onReopen }, ...deleteRow]
    : [
        ...(canAssign ? [{ key: 'assign', ico: 'users', col: colors.primary, bg: colors.primaryTint, label: t('job.menu.assignTeam'), onPress: onAssign }] : []),
        ...(canApprove ? [{ key: 'approve', ico: 'check', col: colors.success, bg: colors.successTint, label: t('job.approveDirectly'), onPress: onApprove }] : []),
        { key: 'lost', ico: 'flag', col: colors.error, bg: colors.errorTint, label: t('job.menu.markLost'), onPress: onMarkLost },
        { key: 'archive', ico: 'layers', col: colors.muted, bg: colors.chipBg, label: t('job.menu.archive'), onPress: onArchive },
        ...deleteRow,
      ];
  return (
    <Sheet open={open} onClose={onClose} title={t('job.menu.title')}>
      {rows.map((r) => (
        <Pressable key={r.key} disabled={busy} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: r.bg }}>
            <Icon name={r.ico} size={20} color={r.col} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: r.key === 'lost' || r.key === 'delete' ? colors.error : colors.ink }}>{r.label}</Text>
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

function QuoteTab({ items, totals, markupPercent = 0, customerNote, go, photos, docPhotos = [], onToggleDocPhoto, onAddPhotos, onRemovePhoto, photoBusy, photoProgress, onEdit, onSend }: { items: LineItem[]; totals: Totals; markupPercent?: number; customerNote?: string | null; go: NavProp['go']; photos: string[]; docPhotos?: string[]; onToggleDocPhoto?: (url: string) => void; onAddPhotos?: () => void; onRemovePhoto?: (url: string) => void; photoBusy?: boolean; photoProgress?: { done: number; total: number } | null; onEdit?: () => void; onSend?: () => void }) {
  const t = useT();
  return (
    <View style={{ marginTop: 16 }}>
      {photos.length || onAddPhotos ? (
        <>
          {/* the link duplicates the tile below on purpose: with 8 photos the tile sits off-screen
              at the end of the strip, which is exactly how "it won't let me add photos" happened */}
          <SectionTitle title={t('job.photos', { n: photos.length })} link={onAddPhotos && !photoBusy ? t('job.addPhotos') : undefined} onLink={onAddPhotos} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
            {onAddPhotos ? (
              // FIRST in the strip, not last: the add tile has to be visible without scrolling
              <Pressable onPress={photoBusy ? undefined : onAddPhotos} style={{ width: 96, height: 96, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {photoBusy ? (
                  // G-2: the spinner alone never said how long — now it counts the photos out
                  <>
                    <ActivityIndicator color={colors.primary} />
                    {photoProgress ? (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>{photoProgress.done}/{photoProgress.total}</Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Icon name="camera" size={20} color={colors.primary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>{t('job.addPhotos')}</Text>
                  </>
                )}
              </Pressable>
            ) : null}
            {photos.map((u, i) => {
              const onDoc = docPhotos.includes(u);
              return (
                // tap = toggle "prints on the quote PDF" (G2) — green check marks the selected ones;
                // press and hold removes the photo from the job altogether. Both are frozen while an
                // upload is in flight: that write rebuilds the array and would resurrect a removed url.
                // 650ms (not 350): picking which photos print is a deliberate, slightly slow tap —
                // a short threshold fired the destructive "Remove photo?" instead of selecting
                <Pressable key={i} onPress={photoBusy || !onToggleDocPhoto ? undefined : () => onToggleDocPhoto(u)} onLongPress={photoBusy || !onRemovePhoto ? undefined : () => onRemovePhoto(u)} delayLongPress={650}>
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
          {onToggleDocPhoto && photos.length ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 8 }}>
              {t('job.onDocument', { n: docPhotos.length, cap: DOC_PHOTO_CAP })}
              {onRemovePhoto ? ` · ${t('job.longPressToRemove')}` : ''}
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
        {/* G-1: the client sees the discount (owner's D1) — and a total that doesn't match the
            sum of the items would raise a question the contractor has to answer by phone */}
        {totals.discount > 0 ? <TotRow label={t('job.discount')} value={`−${fmt(totals.discount)}`} color={colors.info} /> : null}
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
const METHOD_KEY: Record<string, string> = { Cash: 'job.method.cash', Check: 'job.method.check', Zelle: 'job.method.zelle', Card: 'job.method.card', ACH: 'job.method.ach', Other: 'job.method.other' };
const methodLabel = (t: (k: string) => string, m: string) => (METHOD_KEY[m] ? t(METHOD_KEY[m]) : m);
// app-side date chip ("Aug 5" / "5 de ago"): follows the CONTRACTOR's language. The documents
// keep their own English formatting in send.ts / createAgreement — those are the client's.
const mdDate = (d: Date) => d.toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' });
// comment stamp ("Sep 4 · 12:03 PM"): the year only shows up when it isn't the current one, so the
// common case stays short next to the author's name
const cmStamp = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(localeTag(), sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${date} · ${d.toLocaleTimeString(localeTag(), { hour: 'numeric', minute: '2-digit' })}`;
};
// phase names are stored in English (the client portal reads them straight from the DB); the app
// shows them in the contractor's language
const phaseLabel = (t: Tr, name: string) => (name === BEFORE_PHASE_NAME ? t('job.phase.beforeName') : name === FINAL_PHASE_NAME ? t('job.phase.finalName') : name);

function InvoiceTab({ stage, items, totals, client, jobSite, company, invoice, invoices = [], onSelectInvoice, roll, extraToInvoice = 0, onAddInvoice, creditToApply = 0, creditRoomTarget = 0, onAddCredit, onRemoveCredit, quoteTotal, genning, onGen, onRecordPayment, onEditPlan, onReceipt, receiptBusyId, setSheet }: { stage: Stage; items: LineItem[]; totals: Totals; client: JobDetail['client']; jobSite?: string; company?: any; invoice?: JobDetail['invoice']; invoices?: JobDetail['invoices']; onSelectInvoice?: (id: string) => void; roll?: { count: number; total: number; billed: number; paid: number; balance: number }; extraToInvoice?: number; onAddInvoice?: () => void; creditToApply?: number; creditRoomTarget?: number; onAddCredit?: () => void; onRemoveCredit?: (c: { id: string; amount: number }) => void; quoteTotal?: number; genning: boolean; onGen: () => void; onRecordPayment: () => void; onEditPlan: () => void; onReceipt?: (p: PaymentRecord) => void; receiptBusyId?: string | null; setSheet: (b: boolean) => void }) {
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
  // credits reduce what is owed without any money moving (returned material), so every number
  // below reads off the DUE amount, not the billed one
  const credited = invoice?.creditTotal ?? 0;
  const dueTotal = invoice ? invoiceDue(invoice.total, credited) : totals.total;
  const balance = invoice ? invoiceBalance(dueTotal, amountPaid) : totals.total;
  // the credit comes off the last instalments, so the plan on screen adds up to what is really
  // owed — showing the agreed plan next to a smaller balance was two answers to the same question
  const rows = invoice ? applyCreditToRows(planRows(planFromInvoice(invoice), invoice.total), credited) : [];
  const payStatus = invoice ? statusFromPayments(dueTotal, amountPaid) : 'Unpaid';
  const paid = payStatus === 'Paid' || stage === 'Paid';
  const partial = !paid && payStatus === 'Partially Paid';
  const badge: [string, string, string] = paid
    ? [t('job.paidBadge'), colors.success, colors.successTint]
    : partial
      ? [t('job.partialBadge'), colors.info, colors.infoTint]
      : [t('job.dueBadge'), colors.warning, colors.warningTint];
  // the quote was edited after invoicing and the invoice couldn't be re-synced (payments exist)
  // G-9: compare the quote against EVERYTHING already invoiced, not against the invoice on screen —
  // with a complementary invoice the selected one is only a slice and would always look out of sync.
  // When the difference is billable the "bill the difference" card below says it better anyway.
  const invoicedTotal = roll ? roll.billed : invoice?.total ?? 0;
  const showsAddCard = !!onAddInvoice && extraToInvoice > 0.005;
  // capped at the open balance: crediting past it would owe money back, and there is no refund flow
  const creditSuggestion = Math.min(creditToApply, creditRoomTarget);
  const showsCreditCard = !!onAddCredit && creditSuggestion > 0.005;
  const outOfSync = quoteTotal != null && !!invoice && Math.abs(quoteTotal - invoicedTotal) > 0.005 && !showsAddCard && !showsCreditCard;
  return (
    <View style={{ marginTop: 16 }}>
      {/* G-9: with a single invoice this whole block is absent and the tab is exactly what it has
          always been. From two on, the job's real money lives in the roll-up and each invoice is
          picked by its own chip. */}
      {invoices.length > 1 && roll ? (
        <Card pad style={{ marginBottom: 12, backgroundColor: colors.card2 }}>
          <DpLab text={t('job.invoicesCount', { n: invoices.length })} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink2, marginTop: 6, lineHeight: 18 }}>
            {t('job.jobTotalRoll', { total: fmt(roll.total), paid: fmt(roll.paid), balance: fmt(roll.balance) })}
          </Text>
          <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {invoices.map((iv) => (
              <Chip
                key={iv.id}
                label={`${iv.number} · ${fmt(invoiceDue(iv.total, iv.creditTotal))}`}
                selected={iv.id === invoice?.id}
                onPress={() => onSelectInvoice?.(iv.id)}
              />
            ))}
          </Row>
        </Card>
      ) : null}
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
          {totals.discount > 0 ? <TotRow label={t('job.discount')} value={`−${fmt(totals.discount)}`} color={colors.info} /> : null}
          <TotRow label={t('job.tax', { rate: totals.taxRate, amount: fmt(totals.taxableSubtotal) })} value={fmt(totals.tax)} />
          <Between style={{ paddingTop: 11, marginTop: 7, borderTopWidth: 1.5, borderTopColor: colors.borderStrong }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink }}>{t('job.totalDue')}</Text>
            <Text style={{ fontFamily: fonts.num, fontSize: 24, color: colors.ink, letterSpacing: -0.5 }}>{fmt(credited > 0 ? invoiceDue(totals.total, credited) : totals.total)}</Text>
          </Between>
          {/* the billed amount stays visible above the credit line: the client got a document for
              it, and hiding it would look like the invoice was silently rewritten */}
          {credited > 0 ? (
            <View style={{ marginTop: 8 }}>
              <TotRow label={t('job.billedTotal')} value={fmt(totals.total)} />
              <TotRow label={t('job.creditsApplied')} value={`−${fmt(credited)}`} color={colors.info} />
            </View>
          ) : null}
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
              <View key={p.id} style={{ marginTop: 8 }}>
                <Between>
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
                {/* G-6: the check number is only useful if you can read it back later — and this is
                    the same line the client sees on the receipt */}
                {p.note ? <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.faint, marginTop: 2 }}>{p.note}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        {/* credits, apart from the money ledger on purpose: nothing was received here */}
        {invoice?.credits.length ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <DpLab text={t('job.creditsApplied')} />
            {invoice.credits.map((c) => (
              <Between key={c.id} style={{ marginTop: 8 }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
                  {mdDate(new Date(c.createdAt))}{c.reason ? ` · ${c.reason}` : ''}
                </Text>
                {/* a credit is a number the owner typed, not money that moved — a typo has to be
                    fixable, and there is no other way back once the invoice reads as paid */}
                {onRemoveCredit ? (
                  <Pressable onPress={() => onRemoveCredit(c)} hitSlop={10}>
                    <Icon name="x" size={13} color={colors.faint} />
                  </Pressable>
                ) : null}
                <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.info }}>−{fmt(c.amount)}</Text>
              </Between>
            ))}
          </View>
        ) : null}
      </Card>
      {/* G-9: the quote grew past what is already billed — bill the difference apart instead of
          rewriting an invoice the client already paid against */}
      {showsAddCard ? (
        <Card pad style={{ marginTop: 16, backgroundColor: colors.primaryTint, borderColor: colors.primaryTint2 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{t('job.addInvoiceTitle', { amount: fmt(extraToInvoice) })}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, marginTop: 6, lineHeight: 18 }}>
            {t('job.addInvoiceBody')}
          </Text>
          <Btn sm icon="receipt" title={t('job.createExtraInvoice', { amount: fmt(extraToInvoice) })} onPress={onAddInvoice} style={{ marginTop: 12 }} />
        </Card>
      ) : null}
      {/* the mirror: the quote fell BELOW what was already billed (material returned, agreed cut).
          Same card, other direction — instead of a second invoice, a credit that closes the gap. */}
      {showsCreditCard ? (
        <Card pad style={{ marginTop: 16, backgroundColor: colors.infoTint, borderColor: colors.infoTint }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{t('job.creditCardTitle', { amount: fmt(creditSuggestion) })}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink2, marginTop: 6, lineHeight: 18 }}>
            {t('job.creditCardBody')}
          </Text>
          {/* mesmo ícone do outro cartão: os dois mexem no mesmo papel, em sentidos opostos */}
          <Btn sm icon="receipt" title={t('job.applyCredit', { amount: fmt(creditSuggestion) })} onPress={onAddCredit} style={{ marginTop: 12 }} />
        </Card>
      ) : null}
      {invoice && balance > 0.005 ? <Btn title={t('job.recordPayment')} icon="wallet" onPress={onRecordPayment} style={{ marginTop: 16 }} /> : null}
      <Row style={{ gap: 10, marginTop: invoice && balance > 0.005 ? 10 : 16 }}>
        <Btn variant="ghost" icon="pdf" title={t('job.pdf')} onPress={() => setSheet(true)} style={{ flex: 0.4 }} />
        <Btn variant={invoice && balance > 0.005 ? 'ghost' : 'primary'} title={t('job.sendInvoice')} icon="send" onPress={() => setSheet(true)} style={{ flex: 1 }} />
      </Row>
      {invoice ? (
        <View style={{ alignItems: 'center', marginTop: 14, gap: 10 }}>
          <LinkBtn icon="edit" title={t('job.editPaymentPlan')} onPress={onEditPlan} />
          {/* always reachable, not only when the quote was edited down: without a door here, an
              invoice already paid in full had NO way to say "material came back" — the card is
              hidden in that case and the explanation lived inside a sheet he could not open */}
          {onAddCredit ? <LinkBtn icon="receipt" title={t('job.applyCreditPlain')} onPress={onAddCredit} /> : null}
        </View>
      ) : null}
    </View>
  );
}
const DpLab = ({ text }: { text: string }) => <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1, color: colors.faint }}>{text.toUpperCase()}</Text>;

function ContractTab({ agreement, hasInvoice, totals, plan, credited = 0, company, genning, onGenerate, onView }: { agreement: JobDetail['agreement']; hasInvoice: boolean; totals: Totals; plan: PaymentPlan | null; credited?: number; company?: any; genning: boolean; onGenerate: () => void; onView?: () => void }) {
  const t = useT();
  const coName = company?.company_name || t('job.yourCompany');
  const signed = agreement?.status === 'signed';
  const sent = !!agreement && !signed;
  // the same payment plan the contract's "3. PAYMENT TERMS" table is generated from.
  // `totals.total` já vem líquido; planRows precisa do bruto para recompor as linhas, e o
  // abatimento sai das últimas — igual à aba Invoice, senão as parcelas somam mais que o total.
  const rows = plan ? applyCreditToRows(planRows(plan, round2(totals.total + credited)), credited) : [];
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
      {/* G-4: read the real document (the same page the client sees) without texting yourself the
          link. Only once it exists — there is nothing to open before the contract is generated. */}
      {onView ? (
        <Btn variant="soft" title={signed ? t('job.viewSignedContract') : t('job.viewContract')} icon="eye" onPress={onView} style={{ marginTop: 10 }} />
      ) : null}
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

function PaymentPlanSheet({ open, onClose, total, initial, hasPayments, busy, confirmLabel, askWhat, whatSuggestion = '', onConfirm }: { open: boolean; onClose: () => void; total: number; initial: PaymentPlan; hasPayments: boolean; busy: boolean; confirmLabel: string; askWhat?: boolean; whatSuggestion?: string; onConfirm: (plan: PaymentPlan, what?: string) => void }) {
  const t = useT();
  // "o que é o extra": vai IMPRESSO na linha única da fatura complementar. Vem pré-preenchido com o
  // último item que ele adicionou ao orçamento (já em inglês, como todo item) — digitação zero no
  // caso comum, e editável. Obrigar a digitar num app de obra viraria "asdf".
  const [what, setWhat] = useState('');
  // LOCAL state on purpose (not the global store): closing/reopening or switching jobs can
  // never leak a half-edited plan anywhere else.
  const [mode, setMode] = useState<PaymentMode>('full');
  const [fullDays, setFullDays] = useState(15);
  const [depDays, setDepDays] = useState(0); // deposit due date — used to be hardcoded to "today"
  const [depMode, setDepMode] = useState<'pct' | 'amt'>('pct');
  const [depPct, setDepPct] = useState(25);
  const [depAmt, setDepAmt] = useState(0);
  const [rows, setRows] = useState<DraftRow[]>([]);
  useEffect(() => {
    if (open) setWhat(whatSuggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // once the rows carry stored/hand-edited amounts, the N× stepper must PRESERVE them
  // (resizeDraftRows) instead of re-splitting evenly and wiping the edits
  const [rowsDirty, setRowsDirty] = useState(false);
  // which due date the calendar is editing: 'full' or an installment index (null = closed).
  // The ± steppers moved in 5-day jumps and could never land on the day the client agreed to;
  // now they step by 1 AND the date itself opens a calendar (field request 21/07).
  const [dateFor, setDateFor] = useState<null | 'full' | 'deposit' | number>(null);

  // re-seed from the defaults/invoice every time the sheet opens (the Modal stays mounted closed)
  useEffect(() => {
    if (!open) return;
    setMode(initial.mode);
    setFullDays(initial.mode === 'full' ? daysFromToday(initial.dueDate) : 15);
    setDepDays(initial.mode === 'deposit' ? daysFromToday(initial.dueDate) : 0);
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
      // the deposit's due date is now pickable too (it used to be hardcoded to today, so a deposit
      // agreed for next Monday printed as due on signing day); the balance is due upon completion
      return { mode, dueDate: addDaysISO(depDays), depositPercent: depMode === 'pct' ? depPct : null, depositAmount: depValue, installments: [] };
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
                {/* the date is the button — tapping it opens the calendar on that month */}
                <Pressable onPress={() => setDateFor('full')} hitSlop={6}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: fullDays < 0 ? colors.warning : colors.ink }}>{dueDays(t, fullDays)}</Text>
                  <Row style={{ gap: 5, marginTop: 2 }}>
                    <Icon name="calendar" size={12} color={colors.primary} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>{mdDate(parseDateOnly(addDaysISO(fullDays)))}</Text>
                  </Row>
                </Pressable>
                <Stepper value={String(fullDays)} width={44} onMinus={() => setFullDays((d) => Math.max(-365, d - 1))} onPlus={() => setFullDays((d) => Math.min(365, d + 1))} />
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
                <Between style={{ marginTop: 12 }}>
                  <Pressable onPress={() => setDateFor('deposit')} hitSlop={6}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: depDays < 0 ? colors.warning : colors.ink }}>{dueDays(t, depDays)}</Text>
                    <Row style={{ gap: 5, marginTop: 2 }}>
                      <Icon name="calendar" size={12} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>{mdDate(parseDateOnly(addDaysISO(depDays)))}</Text>
                    </Row>
                  </Pressable>
                  <Stepper value={String(depDays)} width={44} onMinus={() => setDepDays((d) => Math.max(-365, d - 1))} onPlus={() => setDepDays((d) => Math.min(365, d + 1))} />
                </Between>
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
                {/* ten taps on "+" to reach 12× is what "it doesn't give me 10, 12 payments" felt
                    like — one tap now, and "split evenly" fills the rows the resize left at $0 */}
                <Row style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {[3, 4, 6, 10, 12].map((n) => (
                    <Chip
                      key={n}
                      label={`${n}×`}
                      selected={rows.length === n}
                      onPress={() => setRows((r) => (rowsDirty ? resizeDraftRows(r, n, total) : draftRows(total, n)))}
                    />
                  ))}
                  <LinkBtn
                    icon="percent"
                    title={t('job.splitEvenly')}
                    onPress={() =>
                      setRows((r) => {
                        const parts = splitInstallments(total, r.length);
                        return r.map((x, i) => ({ ...x, amount: parts[i] ?? 0 })); // dates/labels kept
                      })
                    }
                  />
                </Row>
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
                        <Pressable onPress={() => setDateFor(i)} hitSlop={6}>
                          <Row style={{ gap: 5 }}>
                            <Icon name="calendar" size={12} color={colors.primary} />
                            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>{mdDate(parseDateOnly(addDaysISO(r.days)))}</Text>
                            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: r.days < 0 ? colors.warning : colors.muted }}>· {dueDays(t, r.days)}</Text>
                          </Row>
                        </Pressable>
                        <Stepper
                          value={String(r.days)}
                          width={44}
                          onMinus={() => { setRowsDirty(true); setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, days: Math.max(-365, x.days - 1) } : x))); }}
                          onPlus={() => { setRowsDirty(true); setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, days: Math.min(365, x.days + 1) } : x))); }}
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
      {askWhat ? (
        <Field label={t('job.whatChanged')}>
          <Input value={what} onChangeText={setWhat} placeholder={t('job.whatChangedHint')} maxLength={120} autoCapitalize="sentences" />
        </Field>
      ) : null}
      {hasPayments ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 10 }}>{t('job.editPlanKeepsPayments')}</Text> : null}
      <Btn title={busy ? t('job.working') : confirmLabel} icon={busy ? undefined : 'check'} disabled={!canConfirm} onPress={() => onConfirm(buildPlan(), what)} style={{ marginTop: 4 }} />
      {/* nested INSIDE this sheet's content on purpose — that's how a second Modal presents
          reliably over the first on iOS. Picking a day converts it back into the plan's day count. */}
      <DateSheet
        open={dateFor !== null}
        onClose={() => setDateFor(null)}
        title={t('job.pickDueDate')}
        sub={typeof dateFor === 'number' && rows[dateFor] ? rowLabel(t, rows[dateFor].label) : dateFor === 'deposit' ? t('job.rowDeposit') : undefined}
        value={
          dateFor === 'full'
            ? addDaysISO(fullDays)
            : dateFor === 'deposit'
              ? addDaysISO(depDays)
              : typeof dateFor === 'number' && rows[dateFor]
                ? addDaysISO(rows[dateFor].days)
                : addDaysISO(0)
        }
        onPick={(picked) => {
          // clamped to the same ±365 the steppers use — a date beyond it would jump back to 365
          // the moment the user tapped "+" once
          const days = Math.max(-365, Math.min(365, daysFromToday(picked)));
          if (dateFor === 'full') setFullDays(days);
          else if (dateFor === 'deposit') setDepDays(days);
          else if (typeof dateFor === 'number') {
            setRowsDirty(true);
            setRows((rs) => rs.map((x, xi) => (xi === dateFor ? { ...x, days } : x)));
          }
        }}
      />
    </Sheet>
  );
}

/* ---------------- Credit sheet: reduces what is owed, no money involved ---------------- */
function CreditSheet({ open, onClose, suggestion, room, taxRate = 0, busy, onConfirm }: { open: boolean; onClose: () => void; suggestion: number; room: number; taxRate?: number; busy: boolean; onConfirm: (amount: number, reason: string) => void }) {
  const t = useT();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) { setAmount(round2(Math.min(suggestion, room))); setReason(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const overRoom = amount > room + 0.005;
  // quanto da diferença do orçamento NÃO cabe no saldo desta fatura
  const overflow = round2(Math.max(0, suggestion - room));
  return (
    <Sheet open={open} onClose={onClose} title={t('job.creditTitle')} sub={t('job.creditSub')}>
      <Field label={t('job.creditAmount')}><DecimalInput value={amount} onChangeValue={setAmount} /></Field>
      {/* 8 of the 38 invoices in production carry tax. On those, a returned taxable item gives back
          its tax too — the app cannot know if the item was taxable, so it says so instead */}
      {taxRate > 0 ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: -6, marginBottom: 12, lineHeight: 17 }}>{t('job.creditTaxHint', { rate: taxRate })}</Text>
      ) : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: overRoom ? colors.error : colors.muted, marginTop: -6, marginBottom: overflow > 0.005 ? 4 : 12, lineHeight: 17 }}>
        {room > 0.005 ? t('job.creditMax', { amount: fmt(room) }) : t('job.creditNoRoom')}
      </Text>
      {/* a devolução que passa do saldo acontece por fora; calar sobre ela deixava o contratante
          achando que o app tinha resolvido tudo */}
      {overflow > 0.005 ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.warning, marginBottom: 12, lineHeight: 17 }}>
          {t('job.creditOverflow', { amount: fmt(overflow) })}
        </Text>
      ) : null}
      {/* prints on the invoice — this is the line that tells the client WHY the amount changed */}
      <Field label={t('job.creditReason')}>
        <Input value={reason} onChangeText={setReason} placeholder={t('job.creditReasonHint')} maxLength={120} autoCapitalize="sentences" />
      </Field>
      <Btn
        title={busy ? t('job.working') : t('job.applyCredit', { amount: fmt(round2(amount)) })}
        icon={busy ? undefined : 'check'}
        disabled={busy || !(amount > 0) || overRoom}
        onPress={() => onConfirm(round2(amount), reason)}
        style={{ marginTop: 16 }}
      />
    </Sheet>
  );
}

/* ---------------- Record payment sheet (F12): money received → ledger ---------------- */
function RecordPaymentSheet({ open, onClose, balance, busy, onConfirm }: { open: boolean; onClose: () => void; balance: number; busy: boolean; onConfirm: (amount: number, method: string | null, note: string, paidAt: string) => void }) {
  const t = useT();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string | null>(null);
  const [note, setNote] = useState(''); // G-6: check number / bank — prints on the receipt
  // The date used to be hardcoded to today. Two real cases break that: a post-dated check ("it's
  // for a week from now") and money that landed yesterday but is only being logged now, with the
  // receipt going out today — the receipt has to carry the day the client actually paid.
  const [paidAt, setPaidAt] = useState(() => toDateOnly(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  // pre-fill with the outstanding balance on every open (fresh per job/press — local state)
  useEffect(() => {
    if (open) { setAmount(round2(balance)); setMethod(null); setNote(''); setPaidAt(toDateOnly(new Date())); setDateOpen(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // method KEYS stay English in the DB; only the chip labels are translated. Zelle is how a US
  // contractor gets paid instantly — "é igual o Pix no Brasil".
  const methods: [string, string][] = [['Cash', 'cash'], ['Check', 'check'], ['Zelle', 'zelle'], ['Card', 'card'], ['ACH', 'ach'], ['Other', 'other']];
  const todayIso = toDateOnly(new Date());
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
      {/* G-6: "quando o cara paga em cheque a gente coloca o número do cheque, e o nome do banco".
          Client-facing on purpose — it prints on the receipt, so the hint is in English like every
          other string that reaches the client. 120 = the DB CHECK. */}
      <Field label={t('job.referenceLabel')} opt>
        <Input value={note} onChangeText={setNote} placeholder={t('job.referenceHint')} maxLength={120} autoCapitalize="words" />
      </Field>
      <Field label={t('job.paidOnLabel')}>
        <Pressable onPress={() => setDateOpen(true)}>
          <Row style={{ gap: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
            <Icon name="calendar" size={15} color={colors.muted} />
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink }}>
              {parseDateOnly(paidAt).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric', year: 'numeric' })}
              {paidAt === todayIso ? ` · ${t('job.today')}` : ''}
            </Text>
            <Icon name="chevR" size={15} color={colors.faint} />
          </Row>
        </Pressable>
        {/* a post-dated check counts as received the moment it is recorded — the invoice can close
            and the money lands in "collected" before the check clears, and the app has no way to
            void a payment. Say it out loud, and make the owner confirm on the way out. */}
        {paidAt > todayIso ? (
          <Row style={{ gap: 6, marginTop: 8 }}>
            <Icon name="clock" size={13} color={colors.warning} />
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.warning, lineHeight: 16 }}>{t('job.postDatedWarn')}</Text>
          </Row>
        ) : null}
      </Field>
      <Btn title={busy ? t('job.working') : t('job.recordPayment')} icon={busy ? undefined : 'check'} disabled={busy || !(amount > 0)} onPress={() => onConfirm(round2(amount), method, note, paidAt)} style={{ marginTop: 16 }} />
      <DateSheet
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        value={paidAt}
        onPick={(iso) => { setPaidAt(iso); setDateOpen(false); }}
        title={t('job.paidOnLabel')}
        sub={t('job.paidOnSub')}
      />
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

function ProgressTab({ projectId, estimateId, userId, items, authorName, jobPhotos = 0 }: { projectId: string | null; estimateId: string | null; userId: string | null; items: LineItem[]; authorName: string; jobPhotos?: number }) {
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
  const [opening, setOpening] = useState(false); // G-3: minting the token before opening the portal
  // G-2: how far each phase's upload got — the upload used to be a silent 20-30s. Keyed BY PHASE
  // (not one global slot): the owner shoots one phase, starts the next while the first is still
  // going, and a dead "Add photos" button with no explanation is the very complaint being fixed.
  const [uploads, setUploads] = useState<Record<string, { done: number; total: number }>>({});
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
    Alert.alert(t('job.alert.deletePhaseTitle'), t('job.alert.deletePhaseBody', { name: phaseLabel(t, p.name) }), [
      { text: t('job.cancel'), style: 'cancel' },
      { text: t('job.delete'), style: 'destructive', onPress: async () => { try { await deletePhase(p.id); refresh(); } catch (e: any) { Alert.alert(t('job.error'), e?.message || t('job.couldNotDelete')); } } },
    ]);
  };

  // add photos to a phase — the owner asked to be able to shoot on the spot OR pick from the gallery
  const uploadAssets = async (p: ProgressPhase, assets: { uri: string }[]) => {
    if (!userId || !assets.length) return;
    setUploads((u) => ({ ...u, [p.id]: { done: 0, total: assets.length } }));
    try {
      const { added, failed } = await addPhasePhotos(
        userId,
        projectId,
        p.id,
        assets.map((a) => ({ uri: a.uri })),
        (done, total) => setUploads((u) => (u[p.id] ? { ...u, [p.id]: { done, total } } : u))
      );
      refresh();
      // same rule as the quote album: a photo that didn't make it is said, never swallowed
      if (failed) Alert.alert(t('job.alert.uploadFailed'), t('job.photosFailed', { n: failed }));
      else if (!added) Alert.alert(t('job.alert.uploadFailed'), t('job.alert.noPhotosAdded'));
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotAddPhotos'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setUploads(({ [p.id]: _done, ...rest }) => rest);
    }
  };
  const addPhotos = (p: ProgressPhase) => {
    if (!userId || uploads[p.id]) return; // this phase is already uploading
    askPhotoSource(t, (mode) => {
      void (async () => {
        const assets = await choosePhotos(t, mode);
        if (assets.length) await uploadAssets(p, assets);
      })();
    });
  };

  // before/after bookends (field request 22/07): a slot holding the job's own capture photos and
  // one waiting for the finished work. Jobs whose phases were created before this exists get the link.
  const [bookendBusy, setBookendBusy] = useState(false);
  // a job with no capture photos never gets a "Before photos" phase (it would stay empty on the
  // client's progress bar) — so having the final one is all this offer can deliver there
  const hasBookends = phases.some((p) => p.name === FINAL_PHASE_NAME) && (jobPhotos === 0 || phases.some((p) => p.name === BEFORE_PHASE_NAME));
  const addBookends = async () => {
    if (!userId || !estimateId || !projectId || bookendBusy) return;
    setBookendBusy(true);
    try {
      // asked for explicitly → the before slot is created even with no photos to import
      const { imported } = await ensureBookendPhases(userId, projectId, estimateId, true);
      refresh();
      if (imported) Alert.alert(t('job.bookendsAddedTitle'), t('job.bookendsAddedBody'));
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotAddPhase'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setBookendBusy(false);
    }
  };
  // owner/office manage the job's photos — tap one to remove it (field only adds)
  const removePhoto = (photoId: string, url: string) => {
    Alert.alert(t('job.deletePhotoTitle'), t('job.deletePhotoBody'), [
      { text: t('job.cancel'), style: 'cancel' },
      {
        text: t('job.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhasePhoto(photoId, url);
            refresh();
          } catch (e: any) {
            Alert.alert(t('job.error'), e?.message || t('job.couldNotDelete'));
          }
        },
      },
    ]);
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
  // G-3: same token, but opened here instead of shared — "to see the client's screen I have to
  // send the link to myself on WhatsApp". Minting the token is the same owner-only move as sharing,
  // but `activate: false` keeps the client's "Start" date out of it: looking at your own job is
  // not the moment the job started for the client — sharing the link is.
  const openClientView = async () => {
    if (!userId || opening) return;
    setOpening(true);
    try {
      const token = await ensureShareToken(userId, projectId, false);
      await openClientPage(t, progressLink(token));
    } catch (e: any) {
      Alert.alert(t('job.alert.couldNotCreateLink'), e?.message || t('job.alert.tryAgain'));
    } finally {
      setOpening(false);
    }
  };

  const done = phases.filter((p) => p.status === 'completed').length;

  return (
    <View style={{ marginTop: 16 }}>
      <Between style={{ marginBottom: 14 }}>
        {/* shrinks first: two actions + a localized "11 of 12 phases" is tight on a small iPhone,
            and the actions overflowing off-screen is exactly the class of bug this wave fixes */}
        <Text numberOfLines={1} style={{ flexShrink: 1, marginRight: 10, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{phases.length ? t('job.phasesCount', { done, total: phases.length }) : t('job.workPhases')}</Text>
        {fieldMode ? null : (
          // sharing the client link is the owner's move (it can mint a share token) — and so is
          // opening it: G-3 puts the client's own screen one tap away instead of a self-WhatsApp
          <Row style={{ gap: 16, flexShrink: 0 }}>
            <Pressable onPress={() => { void openClientView(); }} disabled={opening} hitSlop={8}>
              <Row style={{ gap: 5 }}>
                <Icon name="eye" size={14} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{opening ? t('job.working') : t('job.clientView')}</Text>
              </Row>
            </Pressable>
            <Pressable onPress={shareWithClient} disabled={sharing} hitSlop={8}>
              <Row style={{ gap: 5 }}>
                <Icon name="link" size={14} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{sharing ? t('job.working') : t('job.clientLink')}</Text>
              </Row>
            </Pressable>
          </Row>
        )}
      </Between>

      {/* right under the header, not buried at the bottom of a long phase list: this is the
          "before & after photos" the owner asked for, and it has to be findable */}
      {!fieldMode && !hasBookends && !!userId && !!estimateId && phases.length > 0 ? (
        <Btn
          variant="soft"
          sm
          icon={bookendBusy ? undefined : 'camera'}
          title={bookendBusy ? t('job.working') : t('job.addBookends')}
          disabled={bookendBusy}
          onPress={() => { void addBookends(); }}
          style={{ marginBottom: 12 }}
        />
      ) : null}

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
            const upPhase = uploads[p.id] || null;
            return (
              <Card key={p.id} pad>
                <Between>
                  <Row style={{ gap: 11, flex: 1 }}>
                    <Pressable onPress={() => cycleStatus(p)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                      {p.status === 'completed' ? <Icon name="check" size={17} sw={3} color={c} /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: c }}>{i + 1}</Text>}
                    </Pressable>
                    <Pressable onPress={() => cycleStatus(p)} style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{phaseLabel(t, p.name)}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: c }}>{t('job.tapToAdvance', { label: t(labKey) })}</Text>
                    </Pressable>
                  </Row>
                  {fieldMode ? null : <Pressable onPress={() => removePhase(p)} hitSlop={8}><Icon name="trash" size={16} color={colors.faint} /></Pressable>}
                </Between>
                {p.notes ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 19 }}>{p.notes}</Text> : null}
                {p.photos.length || upPhase ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
                    {/* G-2: one ghost tile per photo still in flight — the row of placeholders
                        shrinks as each one lands, and the real thumbnails come in on the refresh
                        at the end. Either way the strip is never silent while photos are moving. */}
                    {upPhase
                      ? Array.from({ length: Math.max(0, upPhase.total - upPhase.done) }).map((_, k) => (
                          <View key={`up${k}`} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                            {k === 0 ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="image" size={16} color={colors.faint} />}
                          </View>
                        ))
                      : null}
                    {p.photos.map((ph) => (
                      // field only adds photos; owner/office can long-press to delete one
                      <Pressable key={ph.id} onLongPress={fieldMode ? undefined : () => removePhoto(ph.id, ph.url)} delayLongPress={300}>
                        <Image source={{ uri: ph.url }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.chipBg }} />
                        {fieldMode ? null : (
                          <View style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                            <Pressable onPress={() => removePhoto(ph.id, ph.url)} hitSlop={10}><Icon name="x" size={11} sw={3} color="#fff" /></Pressable>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                <Btn
                  variant="ghost"
                  sm
                  icon={upPhase ? undefined : 'camera'}
                  // G-2: the button IS the progress read-out while photos are in flight
                  title={upPhase ? t('job.uploadingCount', { done: upPhase.done, total: upPhase.total }) : p.photos.length ? t('job.addMorePhotos') : t('job.addProgressPhotos')}
                  disabled={!!upPhase}
                  onPress={() => addPhotos(p)}
                  style={{ marginTop: 12 }}
                />
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

      <Sheet open={!!cmPhaseId} onClose={() => { setCmPhaseId(null); setCmText(''); }} title={t('job.comments')} sub={cmPhase ? phaseLabel(t, cmPhase.name) : undefined}>
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {cmPhase && cmPhase.comments.length ? (
            cmPhase.comments.map((c) => (
              <View key={c.id} style={{ backgroundColor: c.authorType === 'client' ? colors.bg : colors.primaryTint, borderRadius: 12, padding: 12 }}>
                <Between style={{ gap: 6, marginBottom: 4 }}>
                  <Row style={{ gap: 6, flexShrink: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 12.5, color: c.authorType === 'client' ? colors.ink : colors.primary, flexShrink: 1 }}>{c.authorName}</Text>
                    {/* capped: at the largest accessibility text size these two would push the
                        stamp out of the bubble and shrink the name to an ellipsis */}
                    <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, color: colors.faint }}>{c.authorType === 'client' ? t('job.commentClient') : t('job.commentYou')}</Text>
                  </Row>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.num, fontSize: 10.5, color: colors.faint }}>{cmStamp(c.createdAt)}</Text>
                </Between>
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
