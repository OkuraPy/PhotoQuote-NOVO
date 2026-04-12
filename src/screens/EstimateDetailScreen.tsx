import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send,
  DollarSign,
  CheckCircle,
  FileText,
  Users,
  Edit3,
  Trash2,
  Plus,
  Save,
  X,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { ScreenHeader, Card, Button, Divider } from '../components/ui';
import { useApp, Estimate, EstimateStatus, CompanyProfile, LineItem } from '../context/AppContext';

interface EstimateDetailScreenProps {
  navigation: any;
  route: any;
}

const STATUS_FLOW: EstimateStatus[] = ['Draft', 'Sent', 'Approved', 'In Progress', 'Completed'];

const STATUS_COLORS: Record<EstimateStatus, string> = {
  Draft: colors.info,
  Sent: colors.warning,
  Approved: colors.success,
  'In Progress': colors.accent,
  Completed: colors.primary,
};

function buildPdfHtml(estimate: Estimate, projectName: string, clientName: string, address: string, serviceType: string, docType: 'Estimate' | 'Invoice', company: CompanyProfile, invoiceNumber?: string): string {
  const rows = estimate.lineItems.map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#1B5E20;font-weight:600;text-transform:uppercase;font-size:11px;">${item.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(item.unitPrice || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(item.subtotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const invoiceInfo = docType === 'Invoice' && invoiceNumber
    ? `<div class="info-item"><div class="info-label">Invoice #</div><div class="info-value">${invoiceNumber}</div></div>`
    : '';

  const taxableSubtotal = estimate.lineItems.filter(i => i.taxable).reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const marginRow = estimate.marginRate > 0
    ? `<div class="total-row"><span>Margin (${estimate.marginRate}%)</span><span>$${(estimate.margin || 0).toFixed(2)}</span></div>`
    : '';

  return `
    <html>
    <head><meta charset="utf-8"><style>
      body { font-family: Helvetica, Arial, sans-serif; padding: 0; color: #1F2937; margin: 0; }
      h1 { color: #1B5E20; margin-bottom: 4px; }
      .subtitle { color: #6B7280; font-size: 14px; margin-bottom: 30px; }
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
        <div class="total-row"><span>Subtotal</span><span>$${(estimate.subtotal || 0).toFixed(2)}</span></div>
        <div class="total-row"><span>Tax (${estimate.taxRate || 0}% on $${taxableSubtotal.toFixed(2)})</span><span>$${(estimate.tax || 0).toFixed(2)}</span></div>
        ${marginRow}
        <div class="total-row grand-total"><span class="label">Total</span><span class="value">$${(estimate.total || 0).toFixed(2)}</span></div>
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
  const items = estimate.lineItems.map(i => `- ${i.category}: $${(i.subtotal || 0).toFixed(2)}`).join('\n');
  const header = docType === 'Invoice' && invoiceNumber
    ? `*PhotoQuote AI - Invoice #${invoiceNumber}*`
    : '*PhotoQuote AI - Estimate*';
  const marginLine = estimate.marginRate > 0 ? `\nMargin (${estimate.marginRate}%): $${(estimate.margin || 0).toFixed(2)}` : '';
  return `${header}\n\nClient: ${clientName}\nProject: ${projectName}\nAddress: ${address}\nServices: ${serviceType}\n\n${items}\n\nSubtotal: $${(estimate.subtotal || 0).toFixed(2)}\nTax (${estimate.taxRate || 0}%): $${(estimate.tax || 0).toFixed(2)}${marginLine}\n*Total: $${(estimate.total || 0).toFixed(2)}*\n\n${docType === 'Invoice' ? 'Payment due within 30 days.' : 'Valid for 30 days.'}`;
}

export default function EstimateDetailScreen({ navigation, route }: EstimateDetailScreenProps) {
  const { estimates, getProject, getClient, updateEstimate, deleteEstimate, addInvoice, getEstimateInvoice, companyProfile } = useApp();
  const insets = useSafeAreaInsets();
  const estimateId = route.params?.estimateId as string;
  const estimate = estimates.find(e => e.id === estimateId);
  const project = estimate ? getProject(estimate.projectId) : undefined;
  const client = project ? getClient(project.clientId) : undefined;
  const invoice = estimate ? getEstimateInvoice(estimate.id) : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('');
  const [saving, setSaving] = useState(false);

  if (!estimate) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Estimate" onBack={() => navigation.goBack()} />
        <View style={styles.emptyState}>
          <FileText size={40} color={colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>Estimate not found</Text>
        </View>
      </View>
    );
  }

  const canEdit = estimate.status === 'Draft';

  const startEditing = () => {
    setEditLineItems(estimate.lineItems.map(item => ({ ...item })));
    setEditNotes(estimate.notes);
    setEditTaxRate(String(estimate.taxRate || 0));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setEditLineItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value, subtotal: field === 'quantity' || field === 'unitPrice'
        ? (field === 'quantity' ? Number(value) : item.quantity) * (field === 'unitPrice' ? Number(value) : item.unitPrice)
        : item.subtotal
      } : item
    ));
  };

  const addEditLineItem = () => {
    setEditLineItems(prev => [
      ...prev,
      { id: String(Date.now()), category: 'New Item', description: '', unit: 'job', quantity: 1, unitPrice: 0, subtotal: 0, taxable: true },
    ]);
  };

  const removeEditLineItem = (index: number) => {
    if (editLineItems.length <= 1) {
      Alert.alert('Required', 'You must have at least one line item.');
      return;
    }
    setEditLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveEdits = async () => {
    if (editLineItems.some(item => !item.category.trim())) {
      Alert.alert('Required', 'All items must have a title.');
      return;
    }

    setSaving(true);
    try {
      const taxRate = Number(editTaxRate) || 0;
      const subtotal = editLineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
      const taxableSubtotal = editLineItems.filter(i => i.taxable).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
      const tax = taxableSubtotal * (taxRate / 100);
      const margin = subtotal * ((estimate.marginRate || 0) / 100);
      const total = subtotal + tax + margin;

      const updatedItems = editLineItems.map(item => ({
        ...item,
        subtotal: (item.quantity || 0) * (item.unitPrice || 0),
      }));

      await updateEstimate(estimate.id, {
        lineItems: updatedItems,
        notes: editNotes,
        taxRate,
        marginRate: estimate.marginRate,
        subtotal,
        tax,
        margin,
        total,
      });
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEstimate = () => {
    Alert.alert(
      'Delete Estimate',
      'Are you sure you want to delete this estimate? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEstimate(estimate.id);
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete estimate.');
            }
          },
        },
      ]
    );
  };

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

  const handleGenerateInvoice = async () => {
    if (invoice) {
      navigation.navigate('InvoiceDetail', { invoiceId: invoice.id });
      return;
    }
    const invNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const inv = await addInvoice({
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
    navigation.navigate('InvoiceDetail', { invoiceId: inv.id });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Estimate" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <Card style={styles.cardSpacing}>
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
                      { backgroundColor: isPast || isCurrent ? activeColor : colors.border },
                    ]} />
                  )}

                  {/* Circle */}
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
                        `Change status to "${status}"?`,
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

                  {/* Connecting line (after circle, except last) */}
                  {index < STATUS_FLOW.length - 1 && (
                    <View style={[
                      styles.progressLine,
                      styles.progressLineAfter,
                      { backgroundColor: isPast ? activeColor : colors.border },
                    ]} />
                  )}

                  {/* Label */}
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
        </Card>

        {/* Edit / Delete buttons for Draft */}
        {canEdit && !isEditing && (
          <View style={styles.actionRow}>
            <Button
              title="Edit Estimate"
              onPress={startEditing}
              size="lg"
              icon={<Edit3 size={18} color={colors.textOnPrimary} />}
              style={styles.actionButton}
            />
            <Button
              title="Delete"
              onPress={handleDeleteEstimate}
              size="lg"
              icon={<Trash2 size={18} color={colors.textOnPrimary} />}
              style={{ ...styles.actionButton, backgroundColor: colors.error }}
            />
          </View>
        )}

        {/* Edit mode: Save / Cancel */}
        {isEditing && (
          <View style={styles.actionRow}>
            <Button
              title={saving ? 'Saving...' : 'Save Changes'}
              onPress={saveEdits}
              size="lg"
              icon={<Save size={18} color={colors.textOnPrimary} />}
              style={styles.actionButton}
              disabled={saving}
            />
            <Button
              title="Cancel"
              onPress={cancelEditing}
              size="lg"
              variant="outline"
              icon={<X size={18} color={colors.primary} />}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Line Items */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Line Items ({isEditing ? editLineItems.length : estimate.lineItems.length})</Text>
          {(isEditing ? editLineItems : estimate.lineItems).map((item, index) => (
            <View key={isEditing ? `edit-${index}` : index} style={styles.lineItem}>
              {isEditing ? (
                <>
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={item.category}
                      onChangeText={(v) => updateLineItem(index, 'category', v)}
                      placeholder="Category/Title"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity onPress={() => removeEditLineItem(index)} style={styles.removeItemBtn}>
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.editInput, { marginTop: spacing.xs }]}
                    value={item.description}
                    onChangeText={(v) => updateLineItem(index, 'description', v)}
                    placeholder="Description"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  <View style={[styles.editRow, { marginTop: spacing.xs }]}>
                    <View style={{ flex: 1, marginRight: spacing.xs }}>
                      <Text style={styles.editLabel}>Qty</Text>
                      <TextInput
                        style={styles.editInput}
                        value={String(item.quantity)}
                        onChangeText={(v) => updateLineItem(index, 'quantity', Number(v) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1, marginRight: spacing.xs }}>
                      <Text style={styles.editLabel}>Unit</Text>
                      <TextInput
                        style={styles.editInput}
                        value={item.unit}
                        onChangeText={(v) => updateLineItem(index, 'unit', v)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.editLabel}>Price</Text>
                      <TextInput
                        style={styles.editInput}
                        value={String(item.unitPrice)}
                        onChangeText={(v) => updateLineItem(index, 'unitPrice', Number(v) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <Text style={[styles.lineItemDetails, { marginTop: spacing.xs }]}>
                    Subtotal: ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.lineItemCategory}>{item.category}</Text>
                    <Text style={styles.lineItemSubtotal}>${(item.subtotal || 0).toFixed(2)}</Text>
                  </View>
                  <Text style={styles.lineItemDescription}>{item.description}</Text>
                  <Text style={styles.lineItemDetails}>
                    {item.quantity} {item.unit} x ${(item.unitPrice || 0).toFixed(2)}/{item.unit}
                  </Text>
                </>
              )}
            </View>
          ))}
          {isEditing && (
            <TouchableOpacity onPress={addEditLineItem} style={styles.addItemBtn}>
              <Plus size={16} color={colors.primary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Totals */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Summary</Text>
          {isEditing ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>
                  ${editLineItems.reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0)), 0).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.totalRow, { alignItems: 'center' }]}>
                <Text style={styles.totalLabel}>Tax Rate (%)</Text>
                <TextInput
                  style={[styles.editInput, { width: 70, textAlign: 'right' }]}
                  value={editTaxRate}
                  onChangeText={setEditTaxRate}
                  keyboardType="numeric"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${(estimate.subtotal || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({estimate.taxRate || 0}%)</Text>
                <Text style={styles.totalValue}>${(estimate.tax || 0).toFixed(2)}</Text>
              </View>
              {estimate.marginRate > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Margin ({estimate.marginRate}%)</Text>
                  <Text style={styles.totalValue}>${(estimate.margin || 0).toFixed(2)}</Text>
                </View>
              )}
              <Divider marginVertical={spacing.md} />
              <View style={styles.totalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>${(estimate.total || 0).toFixed(2)}</Text>
              </View>
            </>
          )}
        </Card>

        {/* Notes */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Notes</Text>
          {isEditing ? (
            <TextInput
              style={[styles.editInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholder="Add notes..."
              placeholderTextColor={colors.textTertiary}
            />
          ) : (
            <Text style={styles.note}>{estimate.notes ? estimate.notes.split('\n').map(l => `\u2022 ${l}`).join('\n') : 'No notes'}</Text>
          )}
        </Card>

        {/* Action Buttons: Send + Invoice side by side */}
        {!isEditing && (
          <View style={styles.actionRow}>
            <Button
              title="Send Estimate"
              onPress={handleSendEstimate}
              size="lg"
              icon={<Send size={18} color={colors.textOnPrimary} />}
              style={styles.actionButton}
            />

            <Button
              title={invoice ? 'View Invoice' : 'Generate Invoice'}
              onPress={handleGenerateInvoice}
              size="lg"
              icon={<DollarSign size={18} color={colors.textOnPrimary} />}
              style={{ ...styles.actionButton, backgroundColor: colors.success }}
            />
          </View>
        )}

        {/* Project Progress */}
        {!isEditing && (
          <Button
            title="Project Progress"
            onPress={() => navigation.navigate('ProjectProgress', { projectId: estimate.projectId })}
            size="lg"
            icon={<CheckCircle size={18} color={colors.textOnPrimary} />}
            style={{ marginBottom: spacing.sm, backgroundColor: colors.accent }}
          />
        )}

        {/* Manage Team */}
        {!isEditing && (
          <Button
            title="Manage Project Team"
            onPress={() => navigation.navigate('ProjectMembers', { projectId: estimate.projectId })}
            size="lg"
            variant="outline"
            icon={<Users size={18} color={colors.primary} />}
            style={{ marginBottom: spacing.lg }}
          />
        )}

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
    fontSize: typography.sizes.xs - 2,
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

  note: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.base,
  },

  // Action row (Send + Invoice side by side)
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },

  // Edit mode styles
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    backgroundColor: colors.bgPrimary,
  },
  editLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  removeItemBtn: {
    padding: spacing.sm,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
