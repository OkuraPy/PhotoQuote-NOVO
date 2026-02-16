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
import { useApp, Invoice, InvoiceStatus, CompanyProfile } from '../context/AppContext';

interface InvoiceDetailScreenProps {
  navigation: any;
  route: any;
}

const STATUS_FLOW: InvoiceStatus[] = ['Unpaid', 'Sent', 'Paid', 'Overdue'];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Unpaid: '#e37400',
  Sent: '#1a73e8',
  Paid: '#34a853',
  Overdue: '#d32f2f',
};

function buildInvoicePdf(invoice: Invoice, projectName: string, clientName: string, address: string, serviceType: string, company: CompanyProfile): string {
  const rows = invoice.lineItems.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1a73e8;font-weight:600;text-transform:uppercase;font-size:11px;">${item.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${item.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <html>
    <head><meta charset="utf-8"><style>
      body { font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
      h1 { color: #1a73e8; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
      .invoice-badge { display: inline-block; background: #34a853; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; margin-bottom: 20px; }
      .info-grid { display: flex; flex-wrap: wrap; margin-bottom: 24px; }
      .info-item { width: 50%; margin-bottom: 12px; }
      .info-label { font-size: 12px; color: #555; text-transform: uppercase; font-weight: 600; }
      .info-value { font-size: 14px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase; border-bottom: 2px solid #e0e0e0; }
      .totals { margin-left: auto; width: 280px; }
      .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand-total { border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
      .grand-total .label { font-size: 18px; font-weight: 700; }
      .grand-total .value { font-size: 22px; font-weight: 700; color: #34a853; }
      .notes { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 24px; }
      .notes h3 { margin-top: 0; color: #333; font-size: 14px; }
      .notes p { font-size: 13px; color: #666; line-height: 1.6; }
      .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
    </style></head>
    <body>
      <div style="display:flex;align-items:center;margin-bottom:10px;">
        ${company.logoUri ? `<img src="${company.logoUri}" style="width:60px;height:60px;border-radius:8px;margin-right:16px;" />` : ''}
        <div>
          <h1 style="margin:0;">${company.name || 'PhotoQuote AI'}</h1>
          ${company.address ? `<p style="margin:2px 0;font-size:13px;color:#666;">${company.address}${company.city ? `, ${company.city}` : ''}${company.state ? `, ${company.state}` : ''} ${company.zip}</p>` : ''}
          ${company.phone ? `<p style="margin:2px 0;font-size:13px;color:#666;">${company.phone}${company.email ? ` | ${company.email}` : ''}</p>` : ''}
          ${company.licenseNumber ? `<p style="margin:2px 0;font-size:12px;color:#555;">License: ${company.licenseNumber}</p>` : ''}
        </div>
      </div>
      <p class="subtitle">Professional Invoice</p>
      <div class="invoice-badge">Invoice #${invoice.invoiceNumber}</div>

      <div class="info-grid">
        <div class="info-item"><div class="info-label">Client</div><div class="info-value">${clientName}</div></div>
        <div class="info-item"><div class="info-label">Project</div><div class="info-value">${projectName}</div></div>
        <div class="info-item"><div class="info-label">Address</div><div class="info-value">${address}</div></div>
        <div class="info-item"><div class="info-label">Services</div><div class="info-value">${serviceType}</div></div>
        <div class="info-item"><div class="info-label">Date</div><div class="info-value">${new Date(invoice.createdAt).toLocaleDateString()}</div></div>
        <div class="info-item"><div class="info-label">Status</div><div class="info-value">${invoice.status}</div></div>
      </div>

      <table>
        <thead>
          <tr><th>Category</th><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>$${invoice.subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>Tax (${invoice.taxRate}%)</span><span>$${invoice.tax.toFixed(2)}</span></div>
        <div class="total-row"><span>Margin (${invoice.marginRate}%)</span><span>$${invoice.margin.toFixed(2)}</span></div>
        <div class="total-row grand-total"><span class="label">Total Due</span><span class="value">$${invoice.total.toFixed(2)}</span></div>
      </div>

      <div class="notes">
        <h3>Payment Terms</h3>
        <p>Payment is due within 30 days of invoice date.<br>Please make payment via check or bank transfer.</p>
      </div>

      <div class="footer">
        ${company.name || 'PhotoQuote AI'} &bull; Invoice #${invoice.invoiceNumber} &bull; ${new Date(invoice.createdAt).toLocaleDateString()}
      </div>
    </body>
    </html>
  `;
}

function buildInvoiceShareText(invoice: Invoice, projectName: string, clientName: string, address: string, serviceType: string): string {
  const items = invoice.lineItems.map(i => `- ${i.category}: $${i.subtotal.toFixed(2)}`).join('\n');
  return `*PhotoQuote AI - Invoice #${invoice.invoiceNumber}*\n\nClient: ${clientName}\nProject: ${projectName}\nAddress: ${address}\nServices: ${serviceType}\n\n${items}\n\nSubtotal: $${invoice.subtotal.toFixed(2)}\nTax (${invoice.taxRate}%): $${invoice.tax.toFixed(2)}\nMargin (${invoice.marginRate}%): $${invoice.margin.toFixed(2)}\n*Total Due: $${invoice.total.toFixed(2)}*\n\nPayment due within 30 days.`;
}

export default function InvoiceDetailScreen({ navigation, route }: InvoiceDetailScreenProps) {
  const { invoices, getProject, getClient, updateInvoice, companyProfile } = useApp();
  const invoiceId = route.params?.invoiceId as string;
  const invoice = invoices.find(inv => inv.id === invoiceId);
  const project = invoice ? getProject(invoice.projectId) : undefined;
  const client = project ? getClient(project.clientId) : undefined;

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Invoice not found</Text>
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
  const shareText = buildInvoiceShareText(invoice, projectName, clientName, address, serviceType);

  const currentStatusIndex = STATUS_FLOW.indexOf(invoice.status);

  const handleChangeStatus = (newStatus: InvoiceStatus) => {
    updateInvoice(invoice.id, { status: newStatus });
  };

  const autoAdvanceToSent = () => {
    if (invoice.status === 'Unpaid') {
      updateInvoice(invoice.id, { status: 'Sent' });
    }
  };

  const sendViaText = async (method: 'email' | 'sms' | 'whatsapp') => {
    const plainText = shareText.replace(/\*/g, '');

    try {
      if (method === 'email') {
        const subject = encodeURIComponent(`Invoice #${invoice.invoiceNumber} - ${projectName}`);
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
        const encoded = encodeURIComponent(shareText);
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
      const html = buildInvoicePdf(invoice, projectName, clientName, address, serviceType, companyProfile);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Invoice PDF',
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

  const handleSendInvoice = () => {
    Alert.alert('Send Invoice', 'Choose the format:', [
      { text: 'As Text', onPress: () => showChannelPicker('text') },
      { text: 'As PDF', onPress: () => showChannelPicker('pdf') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Invoice Number Banner */}
        <View style={styles.invoiceBanner}>
          <Text style={styles.invoiceBannerNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.invoiceBannerDate}>
            {new Date(invoice.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Status</Text>
          <View style={styles.progressBar}>
            {STATUS_FLOW.map((status, index) => {
              const isCurrent = index === currentStatusIndex;
              const isPast = index < currentStatusIndex;
              const isFuture = index > currentStatusIndex;
              const color = STATUS_COLORS[status];
              const activeColor = STATUS_COLORS[invoice.status];

              return (
                <View key={status} style={styles.progressStep}>
                  {index > 0 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineBefore,
                      { backgroundColor: isPast || isCurrent ? activeColor : '#e0e0e0' },
                    ]} />
                  )}

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
                        `Change invoice status to "${status}"?`,
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

                  {index < STATUS_FLOW.length - 1 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineAfter,
                      { backgroundColor: isPast ? activeColor : '#e0e0e0' },
                    ]} />
                  )}

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
          <Text style={styles.cardTitle}>Details</Text>
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
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Line Items ({invoice.lineItems.length})</Text>
          {invoice.lineItems.map((item, index) => (
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
          <Text style={styles.cardTitle}>Total Due</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValueText}>${invoice.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({invoice.taxRate}%)</Text>
            <Text style={styles.totalValueText}>${invoice.tax.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Margin ({invoice.marginRate}%)</Text>
            <Text style={styles.totalValueText}>${invoice.margin.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>${invoice.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Send Invoice Button */}
        <TouchableOpacity style={styles.sendInvoiceButton} onPress={handleSendInvoice}>
          <Text style={styles.sendInvoiceIcon}>📤</Text>
          <Text style={styles.sendInvoiceText}>Send Invoice</Text>
        </TouchableOpacity>

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

  invoiceBanner: {
    backgroundColor: '#34a853', borderRadius: 12, padding: 16, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  invoiceBannerNumber: { fontSize: 20, fontWeight: '700', color: '#fff' },
  invoiceBannerDate: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },

  // Progress bar
  progressBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 4,
  },
  progressStep: { alignItems: 'center', flex: 1, position: 'relative' },
  progressCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', zIndex: 1,
  },
  progressCheck: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  progressLine: { position: 'absolute', top: 12, height: 4, zIndex: 0 },
  progressLineBefore: { right: '50%', left: -4 },
  progressLineAfter: { left: '50%', right: -4 },
  progressLabel: { fontSize: 11, marginTop: 6, textAlign: 'center', color: '#999' },

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
  totalValueText: { fontSize: 15, color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  grandTotalLabel: { fontSize: 20, fontWeight: '700', color: '#333' },
  grandTotalValue: { fontSize: 24, fontWeight: '700', color: '#34a853' },

  // Send invoice
  sendInvoiceButton: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 18, alignItems: 'center',
    marginBottom: 16, flexDirection: 'row', justifyContent: 'center',
  },
  sendInvoiceIcon: { fontSize: 22, marginRight: 10 },
  sendInvoiceText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
