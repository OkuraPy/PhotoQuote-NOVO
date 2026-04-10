import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Receipt, ChevronRight } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { colors, typography, spacing } from '../theme';
import { Card, StatusBadge, EmptyState, Divider } from '../components/ui';

const STATUS_MAP: Record<string, string> = {
  Unpaid: 'unpaid', Sent: 'sent', Paid: 'paid', Overdue: 'overdue',
};

interface InvoicesListScreenProps {
  navigation: any;
}

export default function InvoicesListScreen({ navigation }: InvoicesListScreenProps) {
  const { invoices, getProject, getClient } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Invoices</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {invoices.length === 0 && (
          <EmptyState
            icon={<Receipt size={48} color={colors.textTertiary} />}
            title="No invoices yet"
            description="Generate an invoice from an approved estimate to see it here"
          />
        )}

        {invoices.map((invoice) => {
          const project = getProject(invoice.projectId);
          const client = project ? getClient(project.clientId) : undefined;
          const date = new Date(invoice.createdAt);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          const statusKey = STATUS_MAP[invoice.status] || 'unpaid';

          return (
            <Card
              key={invoice.id}
              variant="elevated"
              onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id })}
              style={styles.invoiceCard}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                  <Text style={styles.projectName}>{project?.name ?? 'Unknown Project'}</Text>
                  <Text style={styles.clientName}>{client?.name ?? 'Unknown Client'}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.totalValue}>${(invoice.total || 0).toFixed(2)}</Text>
                  <StatusBadge status={statusKey as any} />
                </View>
              </View>
              <Divider marginVertical={spacing.md} />
              <View style={styles.cardBottom}>
                <Text style={styles.metaText}>{dateStr}</Text>
                <Text style={styles.metaText}>{invoice.lineItems.length} items</Text>
                <View style={{ flex: 1 }} />
                <ChevronRight size={16} color={colors.textTertiary} />
              </View>
            </Card>
          );
        })}
        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  header: {
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  content: { flex: 1, padding: spacing.lg },
  invoiceCard: { marginBottom: spacing.sm },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardInfo: { flex: 1, marginRight: spacing.md },
  invoiceNumber: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 2,
  },
  projectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  clientName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  cardRight: { alignItems: 'flex-end' },
  totalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
});
