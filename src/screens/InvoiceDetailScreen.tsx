import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  CheckCircle,
  FileText,
  FileSignature,
  Clock,
  XCircle,
  Link2,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { ScreenHeader, Card, Button, Divider } from '../components/ui';
import { useApp, Invoice, InvoiceStatus, CompanyProfile, Agreement } from '../context/AppContext';
import { agreementService } from '../services/database';
import { useAuth } from '../context/AuthContext';

interface InvoiceDetailScreenProps {
  navigation: any;
  route: any;
}

const STATUS_FLOW: InvoiceStatus[] = ['Unpaid', 'Sent', 'Paid', 'Overdue'];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Unpaid: colors.warning,
  Sent: colors.info,
  Paid: colors.success,
  Overdue: colors.error,
};

function buildInvoicePdf(invoice: Invoice, projectName: string, clientName: string, address: string, serviceType: string, company: CompanyProfile): string {
  const rows = invoice.lineItems.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1B5E20;font-weight:600;text-transform:uppercase;font-size:11px;">${item.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${item.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  const taxableSubtotal = invoice.lineItems.filter(i => i.taxable).reduce((sum, i) => sum + i.subtotal, 0);
  const marginRow = invoice.marginRate > 0
    ? `<div class="total-row"><span>Margin (${invoice.marginRate}%)</span><span>$${invoice.margin.toFixed(2)}</span></div>`
    : '';

  return `
    <html>
    <head><meta charset="utf-8"><style>
      body { font-family: Helvetica, Arial, sans-serif; padding: 0; color: #1F2937; margin: 0; }
      h1 { color: #1B5E20; margin-bottom: 4px; }
      .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 30px; }
      .invoice-badge { display: inline-block; background: #059669; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; margin-bottom: 20px; }
      .info-grid { display: flex; flex-wrap: wrap; margin-bottom: 24px; }
      .info-item { width: 50%; margin-bottom: 12px; }
      .info-label { font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 600; }
      .info-value { font-size: 14px; font-weight: 600; }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .items-table th { background: #F9FAFB; padding: 10px 8px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase; border-bottom: 2px solid #E5E7EB; }
      .totals { margin-left: auto; width: 280px; }
      .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand-total { border-top: 2px solid #1F2937; padding-top: 12px; margin-top: 8px; }
      .grand-total .label { font-size: 18px; font-weight: 700; }
      .grand-total .value { font-size: 22px; font-weight: 700; color: #059669; }
      .notes { background: #F9FAFB; padding: 16px; border-radius: 8px; margin-top: 24px; }
      .notes h3 { margin-top: 0; color: #1F2937; font-size: 14px; }
      .notes p { font-size: 13px; color: #6B7280; line-height: 1.6; }
      .page-table { width: 100%; border-collapse: collapse; }
      .page-table > thead > tr > td { padding: 20px 40px 10px; border-bottom: 1px solid #E5E7EB; }
      .page-table > tbody > tr > td { padding: 10px 40px 40px; }
      .page-table > tfoot > tr > td { padding: 12px 40px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #6B7280; font-weight: 500; }
    </style></head>
    <body>
      <table class="page-table">
        <thead><tr><td>
          <div style="display:flex;align-items:center;">
            ${company.logoUri ? `<img src="${company.logoUri}" style="max-width:60px;max-height:60px;border-radius:8px;margin-right:16px;object-fit:contain;" />` : ''}
            <div>
              <h1 style="margin:0;font-size:18px;">${company.name || 'PhotoQuote AI'}</h1>
              ${company.address ? `<p style="margin:2px 0;font-size:11px;color:#6B7280;">${company.address}${company.city ? `, ${company.city}` : ''}${company.state ? `, ${company.state}` : ''} ${company.zip}</p>` : ''}
              ${company.phone ? `<p style="margin:2px 0;font-size:11px;color:#6B7280;">${company.phone}${company.email ? ` | ${company.email}` : ''}</p>` : ''}
              ${company.licenseNumber ? `<p style="margin:2px 0;font-size:11px;color:#6B7280;">License: ${company.licenseNumber}</p>` : ''}
            </div>
          </div>
        </td></tr></thead>
        <tbody><tr><td>
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

      <table class="items-table">
        <thead>
          <tr><th>Category</th><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>$${invoice.subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>Tax (${invoice.taxRate}% on $${taxableSubtotal.toFixed(2)})</span><span>$${invoice.tax.toFixed(2)}</span></div>
        ${marginRow}
        <div class="total-row grand-total"><span class="label">Total Due</span><span class="value">$${invoice.total.toFixed(2)}</span></div>
      </div>

      <div class="notes">
        <h3>Payment Terms</h3>
        <p>Payment is due within 30 days of invoice date.<br>Please make payment via check or bank transfer.</p>
      </div>

        </td></tr></tbody>
        <tfoot><tr><td>
          ${company.name || 'PhotoQuote AI'} &bull; Invoice #${invoice.invoiceNumber} &bull; ${new Date(invoice.createdAt).toLocaleDateString()}
        </td></tr></tfoot>
      </table>
    </body>
    </html>
  `;
}

function buildInvoiceShareText(invoice: Invoice, projectName: string, clientName: string, address: string, serviceType: string): string {
  const items = invoice.lineItems.map(i => `- ${i.category}: $${i.subtotal.toFixed(2)}`).join('\n');
  const marginLine = invoice.marginRate > 0 ? `\nMargin (${invoice.marginRate}%): $${invoice.margin.toFixed(2)}` : '';
  return `*PhotoQuote AI - Invoice #${invoice.invoiceNumber}*\n\nClient: ${clientName}\nProject: ${projectName}\nAddress: ${address}\nServices: ${serviceType}\n\n${items}\n\nSubtotal: $${invoice.subtotal.toFixed(2)}\nTax (${invoice.taxRate}%): $${invoice.tax.toFixed(2)}${marginLine}\n*Total Due: $${invoice.total.toFixed(2)}*\n\nPayment due within 30 days.`;
}

export default function InvoiceDetailScreen({ navigation, route }: InvoiceDetailScreenProps) {
  const { invoices, getProject, getClient, updateInvoice, companyProfile } = useApp();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const invoiceId = route.params?.invoiceId as string;
  const invoice = invoices.find(inv => inv.id === invoiceId);
  const project = invoice ? getProject(invoice.projectId) : undefined;
  const client = project ? getClient(project.clientId) : undefined;

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const [generatingContract, setGeneratingContract] = useState(false);

  useEffect(() => {
    if (invoice && user) {
      setLoadingAgreement(true);
      agreementService.getByInvoice(invoice.id, user.id)
        .then(setAgreement)
        .catch(console.error)
        .finally(() => setLoadingAgreement(false));
    }
  }, [invoice?.id, user?.id]);

  const handleGenerateContract = async () => {
    if (!invoice || !project || !client || !user) return;
    setGeneratingContract(true);
    try {
      const ag = await agreementService.create(
        invoice,
        { name: project.name, address: project.address, city: project.city, zip: project.zip, serviceType: project.serviceType },
        { id: client.id, name: client.name, email: client.email, phone: client.phone, address: client.address },
        companyProfile,
        user.id,
        'FL'
      );
      setAgreement(ag);
      Alert.alert('Contract Generated', 'The contract has been created. You can now send it to the client for signing.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to generate contract.');
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleSendContract = async () => {
    if (!agreement || !client) return;
    const signUrl = `https://photoquote-client-portal.vercel.app/agreement/sign/${agreement.token}`;
    const message = `Hi ${client.name},\n\nPlease review and sign the construction agreement for your project.\n\nSign here: ${signUrl}\n\nThank you,\n${companyProfile.name || 'PhotoQuote AI'}`;

    Alert.alert('Send Contract', 'Choose how to send:', [
      {
        text: 'Email', onPress: async () => {
          const subject = encodeURIComponent('Construction Agreement - Signature Required');
          const body = encodeURIComponent(message);
          await Linking.openURL(`mailto:${client.email}?subject=${subject}&body=${body}`);
          if (user) await agreementService.updateStatus(agreement.id, 'sent', user.id);
          setAgreement(prev => prev ? { ...prev, status: 'sent' } : null);
        }
      },
      {
        text: 'WhatsApp', onPress: async () => {
          const phone = (client.phone || '').replace(/[^0-9]/g, '');
          const encoded = encodeURIComponent(message);
          await Linking.openURL(`https://wa.me/${phone}?text=${encoded}`);
          if (user) await agreementService.updateStatus(agreement.id, 'sent', user.id);
          setAgreement(prev => prev ? { ...prev, status: 'sent' } : null);
        }
      },
      {
        text: 'Share', onPress: async () => {
          await Share.share({ message, url: signUrl });
          if (user) await agreementService.updateStatus(agreement.id, 'sent', user.id);
          setAgreement(prev => prev ? { ...prev, status: 'sent' } : null);
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleViewContract = async () => {
    if (!agreement) return;
    try {
      const html = `<html><head><meta charset="utf-8"><style>body{font-family:Helvetica,Arial,sans-serif;padding:40px;color:#1F2937;max-width:800px;margin:0 auto;}</style></head><body>${agreement.contractHtml}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Contract PDF' });
      }
    } catch {
      Alert.alert('Error', 'Failed to generate contract PDF.');
    }
  };

  if (!invoice) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Invoice" onBack={() => navigation.goBack()} />
        <View style={styles.emptyState}>
          <FileText size={40} color={colors.textTertiary} strokeWidth={1.5} />
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
      <ScreenHeader title="Invoice" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Invoice Number Banner */}
        <View style={styles.invoiceBanner}>
          <Text style={styles.invoiceBannerNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.invoiceBannerDate}>
            {new Date(invoice.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Progress Bar */}
        <Card style={styles.cardSpacing}>
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
                      { backgroundColor: isPast || isCurrent ? activeColor : colors.border },
                    ]} />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.progressCircle,
                      isPast && { backgroundColor: activeColor, borderColor: activeColor },
                      isCurrent && { backgroundColor: color, borderColor: color },
                      isFuture && { backgroundColor: colors.bgPrimary, borderColor: colors.border },
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
                    {isPast && <CheckCircle size={14} color={colors.textOnPrimary} />}
                    {isCurrent && <View style={styles.progressDotInner} />}
                  </TouchableOpacity>

                  {index < STATUS_FLOW.length - 1 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineAfter,
                      { backgroundColor: isPast ? activeColor : colors.border },
                    ]} />
                  )}

                  <Text style={[
                    styles.progressLabel,
                    isCurrent && { color, fontWeight: typography.weights.bold },
                    isPast && { color: activeColor },
                    isFuture && { color: colors.textTertiary },
                  ]}>{status}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Project Info */}
        <Card style={styles.cardSpacing}>
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
        </Card>

        {/* Line Items */}
        <Card style={styles.cardSpacing}>
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
        </Card>

        {/* Totals */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Total Due</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${(invoice.subtotal || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({invoice.taxRate || 0}%)</Text>
            <Text style={styles.totalValue}>${(invoice.tax || 0).toFixed(2)}</Text>
          </View>
          {(invoice.marginRate || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Margin ({invoice.marginRate}%)</Text>
              <Text style={styles.totalValue}>${(invoice.margin || 0).toFixed(2)}</Text>
            </View>
          )}
          <Divider marginVertical={spacing.md} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>${(invoice.total || 0).toFixed(2)}</Text>
          </View>
        </Card>

        {/* Contract / Agreement Section */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Contract</Text>
          {loadingAgreement ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : agreement ? (
            <View>
              <View style={styles.contractStatusRow}>
                {agreement.status === 'signed' ? (
                  <CheckCircle size={20} color={colors.success} />
                ) : agreement.status === 'sent' || agreement.status === 'pending_signature' ? (
                  <Clock size={20} color={colors.warning} />
                ) : (
                  <XCircle size={20} color={colors.textTertiary} />
                )}
                <Text style={[styles.contractStatusText, {
                  color: agreement.status === 'signed' ? colors.success
                    : agreement.status === 'sent' ? colors.warning
                    : colors.textTertiary
                }]}>
                  {agreement.status === 'signed' ? `Signed by ${agreement.signedName}`
                    : agreement.status === 'sent' ? 'Pending Signature'
                    : agreement.status === 'pending_signature' ? 'Pending Signature'
                    : 'Draft — Not Sent'}
                </Text>
              </View>
              {agreement.signedDate && (
                <Text style={styles.contractMeta}>
                  Signed on {new Date(agreement.signedDate).toLocaleDateString()}
                </Text>
              )}
              <View style={styles.contractActions}>
                <Button
                  title="View PDF"
                  onPress={handleViewContract}
                  size="md"
                  variant="outline"
                  style={{ flex: 1 }}
                />
                {agreement.status !== 'signed' && (
                  <Button
                    title={agreement.status === 'draft' ? 'Send for Signing' : 'Resend'}
                    onPress={handleSendContract}
                    size="md"
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          ) : (
            <Button
              title={generatingContract ? 'Generating...' : 'Generate Contract'}
              onPress={handleGenerateContract}
              size="lg"
              fullWidth
              icon={<FileSignature size={18} color={colors.textOnPrimary} />}
              disabled={generatingContract}
            />
          )}
        </Card>

        {/* Send Invoice Button */}
        <Button
          title="Send Invoice"
          onPress={handleSendInvoice}
          size="lg"
          fullWidth
          icon={<Send size={18} color={colors.textOnPrimary} />}
          style={styles.sendButton}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textTertiary,
  },

  invoiceBanner: {
    backgroundColor: colors.success,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceBannerNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  invoiceBannerDate: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
  },

  cardSpacing: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPrimary,
    zIndex: 1,
  },
  progressDotInner: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.bgPrimary,
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
    fontSize: typography.sizes.xs - 1,
    marginTop: spacing.xs + 2,
    textAlign: 'center',
    color: colors.textTertiary,
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 1,
    textAlign: 'right',
  },

  // Line items
  lineItem: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  lineItemCategory: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  lineItemSubtotal: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  lineItemDescription: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  lineItemDetails: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },

  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  grandTotalLabel: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  grandTotalValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.success,
  },

  // Send invoice
  sendButton: {
    marginBottom: spacing.lg,
  },

  // Contract section
  contractStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contractStatusText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  contractMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  contractActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
