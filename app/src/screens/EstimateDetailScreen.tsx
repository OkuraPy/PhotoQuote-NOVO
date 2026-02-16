import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp, Estimate, EstimateStatus, CompanyProfile } from '../context/AppContext';

interface EstimateDetailScreenProps {
  navigation: any;
  route: any;
}

const STATUS_FLOW: EstimateStatus[] = ['Draft', 'Sent', 'Approved', 'In Progress', 'Completed'];

const STATUS_COLORS: Record<EstimateStatus, string> = {
  Draft: '#1a73e8',
  Sent: '#e37400',
  Approved: '#34a853',
  'In Progress': '#f57c00',
  Completed: '#00897b',
};

function buildPdfHtml(estimate: Estimate, projectName: string, clientName: string, address: string, serviceType: string, docType: 'Estimate' | 'Invoice', company: CompanyProfile, invoiceNumber?: string): string {
  const rows = estimate.lineItems.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a73e8;font-weight:600;text-transform:uppercase;font-size:11px;">${item.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${item.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const invoiceInfo = docType === 'Invoice' && invoiceNumber
    ? `<div class="info-item"><div class="info-label">Invoice #</div><div class="info-value">${invoiceNumber}</div></div>`
    : '';

  const taxableSubtotal = estimate.lineItems.filter(i => i.taxable).reduce((sum, i) => sum + i.subtotal, 0);
  const marginRow = estimate.marginRate > 0
    ? `<div class="total-row"><span>Margin (${estimate.marginRate}%)</span><span>$${estimate.margin.toFixed(2)}</span></div>`
    : '';

  return `
    <html>
    <head><meta charset="utf-8"><style>
      body { font-family: Helvetica, Arial, sans-serif; padding: 0; color: #333; margin: 0; }
      h1 { color: #1a73e8; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
      .info-grid { display: flex; flex-wrap: wrap; margin-bottom: 24px; }
      .info-item { width: 50%; margin-bottom: 12px; }
      .info-label { font-size: 12px; color: #555; text-transform: uppercase; font-weight: 600; }
      .info-value { font-size: 14px; font-weight: 600; }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .items-table th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase; border-bottom: 2px solid #e0e0e0; }
      .totals { margin-left: auto; width: 280px; }
      .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand-total { border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
      .grand-total .label { font-size: 18px; font-weight: 700; }
      .grand-total .value { font-size: 22px; font-weight: 700; color: #1b6d2f; }
      .notes { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 24px; }
      .notes h3 { margin-top: 0; color: #333; font-size: 14px; }
      .notes p { font-size: 13px; color: #666; line-height: 1.6; }
      .page-table { width: 100%; border-collapse: collapse; }
      .page-table > thead > tr > td { padding: 20px 40px 10px; border-bottom: 1px solid #ddd; }
      .page-table > tbody > tr > td { padding: 10px 40px 40px; }
      .page-table > tfoot > tr > td { padding: 12px 40px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #555; font-weight: 500; }
    </style></head>
    <body>
      <table class="page-table">
        <thead><tr><td>
          <div style="display:flex;align-items:center;">
            ${company.logoUri ? `<img src="${company.logoUri}" style="max-width:60px;max-height:60px;border-radius:8px;margin-right:16px;object-fit:contain;" />` : ''}
            <div>
              <h1 style="margin:0;font-size:18px;">${company.name || 'PhotoQuote AI'}</h1>
              ${company.address ? `<p style="margin:2px 0;font-size:11px;color:#666;">${company.address}${company.city ? `, ${company.city}` : ''}${company.state ? `, ${company.state}` : ''} ${company.zip}</p>` : ''}
              ${company.phone ? `<p style="margin:2px 0;font-size:11px;color:#666;">${company.phone}${company.email ? ` | ${company.email}` : ''}</p>` : ''}
              ${company.licenseNumber ? `<p style="margin:2px 0;font-size:11px;color:#555;">License: ${company.licenseNumber}</p>` : ''}
            </div>
          </div>
        </td></tr></thead>
        <tbody><tr><td>
      <p class="subtitle">Professional ${docType}</p>

      <div class="info-grid">
        ${invoiceInfo}
        <div class="info-item"><div class="info-label">Client</div><div class="info-value">${clientName}</div></div>
        <div class="info-item"><div class="info-label">Project</div><div class="info-value">${projectName}</div></div>
        <div class="info-item"><div class="info-label">Address</div><div class="info-value">${address}</div></div>
        <div class="info-item"><div class="info-label">Services</div><div class="info-value">${serviceType}</div></div>
      </div>

      <table class="items-table">
        <thead>
          <tr><th>Category</th><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>$${estimate.subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>Tax (${estimate.taxRate}% on $${taxableSubtotal.toFixed(2)})</span><span>$${estimate.tax.toFixed(2)}</span></div>
        ${marginRow}
        <div class="total-row grand-total"><span class="label">Total</span><span class="value">$${estimate.total.toFixed(2)}</span></div>
      </div>

      <div class="notes">
        <h3>Notes & Assumptions</h3>
        <p>${estimate.notes.replace(/\n/g, '<br>')}</p>
      </div>

        </td></tr></tbody>
        <tfoot><tr><td>
          ${company.name || 'PhotoQuote AI'} &bull; ${docType === 'Invoice' ? 'Payment due within 30 days' : 'Valid for 30 days'} &bull; ${new Date(estimate.createdAt).toLocaleDateString()}
        </td></tr></tfoot>
      </table>
    </body>
    </html>
  `;
}

function buildShareText(estimate: Estimate, projectName: string, clientName: string, address: string, serviceType: string, docType: 'Estimate' | 'Invoice', invoiceNumber?: string): string {
  const items = estimate.lineItems.map(i => `- ${i.category}: $${i.subtotal.toFixed(2)}`).join('\n');
  const header = docType === 'Invoice' && invoiceNumber
    ? `*PhotoQuote AI - Invoice #${invoiceNumber}*`
    : '*PhotoQuote AI - Estimate*';
  const marginLine = estimate.marginRate > 0 ? `\nMargin (${estimate.marginRate}%): $${estimate.margin.toFixed(2)}` : '';
  return `${header}\n\nClient: ${clientName}\nProject: ${projectName}\nAddress: ${address}\nServices: ${serviceType}\n\n${items}\n\nSubtotal: $${estimate.subtotal.toFixed(2)}\nTax (${estimate.taxRate}%): $${estimate.tax.toFixed(2)}${marginLine}\n*Total: $${estimate.total.toFixed(2)}*\n\n${docType === 'Invoice' ? 'Payment due within 30 days.' : 'Valid for 30 days.'}`;
}

export default function EstimateDetailScreen({ navigation, route }: EstimateDetailScreenProps) {
  const { estimates, getProject, getClient, updateEstimate, addInvoice, getEstimateInvoice, companyProfile } = useApp();
  const estimateId = route.params?.estimateId as string;
  const estimate = estimates.find(e => e.id === estimateId);
  const project = estimate ? getProject(estimate.projectId) : undefined;
  const client = project ? getClient(project.clientId) : undefined;
  const invoice = estimate ? getEstimateInvoice(estimate.id) : undefined;

  if (!estimate) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Estimate</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Estimate not found</Text>
        </View>
      </View>
    );
  }

  const projectName = project?.name ?? 'N/A';
  const clientName = client?.name ?? 'N/A';
  const address = project ? `${project.address}, ${project.city}, FL ${project.zip}` : 'N/A';
  const serviceType = project?.serviceType ?? 'N/A';
  const clientEmail = client?.email ?? '';
  const clientPhone = client?.phone ?? '';

  const currentStatusIndex = STATUS_FLOW.indexOf(estimate.status);

  const handleChangeStatus = (newStatus: EstimateStatus) => {
    updateEstimate(estimate.id, { status: newStatus });
  };

  const autoAdvanceToSent = () => {
    if (estimate.status === 'Draft') {
      updateEstimate(estimate.id, { status: 'Sent' });
    }
  };

  const sendViaText = async (method: 'email' | 'sms' | 'whatsapp') => {
    const text = buildShareText(estimate, projectName, clientName, address, serviceType, 'Estimate', invoice?.invoiceNumber);
    const plainText = text.replace(/\*/g, '');

    try {
      if (method === 'email') {
        const subject = encodeURIComponent(`Estimate - ${projectName}`);
        const body = encodeURIComponent(plainText);
        await Linking.openURL(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
      } else if (method === 'sms') {
        const body = encodeURIComponent(plainText);
        const sms = Platform.OS === 'ios'
          ? `sms:${clientPhone}&body=${body}`
          : `sms:${clientPhone}?body=${body}`;
        await Linking.openURL(sms);
      } else {
        const phone = clientPhone.replace(/[^0-9]/g, '');
        const encoded = encodeURIComponent(text);
        const url = `https://wa.me/${phone}?text=${encoded}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('WhatsApp', 'WhatsApp is not installed on this device.');
          return;
        }
      }
      autoAdvanceToSent();
    } catch {
      Alert.alert('Error', `Could not open ${method} app.`);
    }
  };

  const sendViaPdf = async () => {
    try {
      const html = buildPdfHtml(estimate, projectName, clientName, address, serviceType, 'Estimate', companyProfile, invoice?.invoiceNumber);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Estimate PDF',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF Saved', `PDF saved to: ${uri}`);
        }
      }
      autoAdvanceToSent();
    } catch {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const showChannelPicker = (format: 'text' | 'pdf') => {
    if (format === 'pdf') {
      sendViaPdf();
      return;
    }
    Alert.alert('Send via', 'Choose how to send:', [
      { text: 'Email', onPress: () => sendViaText('email') },
      { text: 'SMS', onPress: () => sendViaText('sms') },
      { text: 'WhatsApp', onPress: () => sendViaText('whatsapp') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSendEstimate = () => {
    Alert.alert('Send Estimate', 'Choose the format:', [
      { text: 'As Text', onPress: () => showChannelPicker('text') },
      { text: 'As PDF', onPress: () => showChannelPicker('pdf') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleGenerateInvoice = () => {
    if (invoice) {
      navigation.navigate('InvoiceDetail', { invoiceId: invoice.id });
      return;
    }
    const invNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const newInvoice = addInvoice({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      invoiceNumber: invNumber,
      lineItems: [...estimate.lineItems],
      taxRate: estimate.taxRate,
      marginRate: estimate.marginRate,
      subtotal: estimate.subtotal,
      tax: estimate.tax,
      margin: estimate.margin,
      total: estimate.total,
      notes: estimate.notes,
      status: 'Unpaid',
    });
    navigation.navigate('InvoiceDetail', { invoiceId: newInvoice.id });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estimate</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <View style={styles.progressBar}>
            {STATUS_FLOW.map((status, index) => {
              const isCurrent = index === currentStatusIndex;
              const isPast = index < currentStatusIndex;
              const isFuture = index > currentStatusIndex;
              const color = STATUS_COLORS[status];
              const activeColor = STATUS_COLORS[estimate.status];

              return (
                <View key={status} style={styles.progressStep}>
                  {/* Connecting line (before circle, except first) */}
                  {index > 0 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineBefore,
                      { backgroundColor: isPast || isCurrent ? activeColor : '#e0e0e0' },
                    ]} />
                  )}

                  {/* Circle */}
                  <TouchableOpacity
                    style={[
                      styles.progressCircle,
                      isPast && { backgroundColor: activeColor, borderColor: activeColor },
                      isCurrent && { backgroundColor: color, borderColor: color },
                      isFuture && { backgroundColor: '#fff', borderColor: '#e0e0e0' },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        'Change Status',
                        `Change status to "${status}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', onPress: () => handleChangeStatus(status) },
                        ]
                      );
                    }}
                  >
                    {isPast && <Text style={styles.progressCheck}>✓</Text>}
                    {isCurrent && <View style={styles.progressDotInner} />}
                  </TouchableOpacity>

                  {/* Connecting line (after circle, except last) */}
                  {index < STATUS_FLOW.length - 1 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineAfter,
                      { backgroundColor: isPast ? activeColor : '#e0e0e0' },
                    ]} />
                  )}

                  {/* Label */}
                  <Text style={[
                    styles.progressLabel,
                    isCurrent && { color, fontWeight: '700' },
                    isPast && { color: activeColor },
                    isFuture && { color: '#999' },
                  ]}>{status}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Project Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Project Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client:</Text>
            <Text style={styles.infoValue}>{clientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Project:</Text>
            <Text style={styles.infoValue}>{projectName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Services:</Text>
            <Text style={styles.infoValue}>{serviceType}</Text>
          </View>
          {project && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Property:</Text>
                <Text style={styles.infoValue}>{project.propertyType} | Access: {project.accessLevel}</Text>
              </View>
              {parseInt(project.floorLevel) > 0 && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Floor:</Text>
                  <Text style={styles.infoValue}>{project.floorLevel} | Elevator: {project.hasElevator ? 'Yes' : 'No'}</Text>
                </View>
              )}
            </>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Confidence:</Text>
            <Text style={styles.infoValue}>{estimate.confidence}%</Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Line Items ({estimate.lineItems.length})</Text>
          {estimate.lineItems.map((item, index) => (
            <View key={index} style={styles.lineItem}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemCategory}>{item.category}</Text>
                <Text style={styles.lineItemSubtotal}>${item.subtotal.toFixed(2)}</Text>
              </View>
              <Text style={styles.lineItemDescription}>{item.description}</Text>
              <Text style={styles.lineItemDetails}>
                {item.quantity} {item.unit} x ${item.unitPrice.toFixed(2)}/{item.unit}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${estimate.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({estimate.taxRate}%)</Text>
            <Text style={styles.totalValue}>${estimate.tax.toFixed(2)}</Text>
          </View>
          {estimate.marginRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Margin ({estimate.marginRate}%)</Text>
              <Text style={styles.totalValue}>${estimate.margin.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>${estimate.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          <Text style={styles.note}>{estimate.notes.split('\n').map(l => `• ${l}`).join('\n')}</Text>
        </View>

        {/* Action Buttons: Send + Invoice side by side */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSendEstimate}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Send Estimate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.invoiceButton]}
            onPress={handleGenerateInvoice}
          >
            <Text style={styles.actionIcon}>$</Text>
            <Text style={styles.actionText}>
              {invoice ? 'View Invoice' : 'Generate Invoice'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  backButton: { fontSize: 16, color: '#1a73e8' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  content: { flex: 1, padding: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#999' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  progressCheck: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  progressLine: {
    position: 'absolute',
    top: 12,
    height: 4,
    zIndex: 0,
  },
  progressLineBefore: {
    right: '50%',
    left: -4,
  },
  progressLineAfter: {
    left: '50%',
    right: -4,
  },
  progressLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    color: '#999',
  },

  // Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1, textAlign: 'right' },

  // Line items
  lineItem: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  lineItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lineItemCategory: { fontSize: 12, fontWeight: '600', color: '#1a73e8', textTransform: 'uppercase' },
  lineItemSubtotal: { fontSize: 16, fontWeight: '600', color: '#333' },
  lineItemDescription: { fontSize: 15, color: '#333', marginBottom: 4 },
  lineItemDetails: { fontSize: 13, color: '#666' },

  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 15, color: '#666' },
  totalValue: { fontSize: 15, color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  grandTotalLabel: { fontSize: 20, fontWeight: '700', color: '#333' },
  grandTotalValue: { fontSize: 24, fontWeight: '700', color: '#1b6d2f' },

  note: { fontSize: 14, color: '#666', lineHeight: 22 },

  // Action row (PDF + Invoice side by side)
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  invoiceButton: {
    backgroundColor: '#34a853',
  },
  actionIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

});
