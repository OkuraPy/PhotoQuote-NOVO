import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useApp, InvoiceStatus } from '../context/AppContext';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  Unpaid: { bg: '#fef7e0', text: '#e37400' },
  Sent: { bg: '#e8f0fe', text: '#1a73e8' },
  Paid: { bg: '#e6f4ea', text: '#34a853' },
  Overdue: { bg: '#fce8e6', text: '#d32f2f' },
};

interface InvoicesListScreenProps {
  navigation: any;
}

export default function InvoicesListScreen({ navigation }: InvoicesListScreenProps) {
  const { invoices, getProject, getClient } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {invoices.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>$</Text>
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            <Text style={styles.emptyText}>
              Generate an invoice from an approved estimate to see it here
            </Text>
          </View>
        )}

        {invoices.map((invoice) => {
          const project = getProject(invoice.projectId);
          const client = project ? getClient(project.clientId) : undefined;
          const date = new Date(invoice.createdAt);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          const statusColor = STATUS_COLORS[invoice.status];

          return (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                  <Text style={styles.projectName}>{project?.name ?? 'Unknown Project'}</Text>
                  <Text style={styles.clientName}>{client?.name ?? 'Unknown Client'}</Text>
                </View>
                <View style={styles.totalContainer}>
                  <Text style={styles.totalValue}>${invoice.total.toFixed(2)}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor?.bg ?? '#e8f0fe' },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: statusColor?.text ?? '#333' },
                    ]}>{invoice.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.dateText}>{dateStr}</Text>
                <Text style={styles.itemsCount}>{invoice.lineItems.length} items</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, padding: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16, color: '#34a853', fontWeight: '700' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  invoiceCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardInfo: { flex: 1, marginRight: 12 },
  invoiceNumber: { fontSize: 14, fontWeight: '700', color: '#34a853', marginBottom: 4 },
  projectName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  clientName: { fontSize: 14, color: '#666' },
  totalContainer: { alignItems: 'flex-end' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#34a853', marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12,
  },
  dateText: { fontSize: 12, color: '#999' },
  itemsCount: { fontSize: 12, color: '#999' },
});
