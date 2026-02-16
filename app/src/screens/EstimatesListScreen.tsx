import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useApp, EstimateStatus } from '../context/AppContext';

const STATUS_COLORS: Record<EstimateStatus, { bg: string; text: string }> = {
  Draft: { bg: '#e8f0fe', text: '#1a73e8' },
  Sent: { bg: '#fef7e0', text: '#e37400' },
  Approved: { bg: '#e6f4ea', text: '#34a853' },
  'In Progress': { bg: '#fff3e0', text: '#f57c00' },
  Completed: { bg: '#e0f2f1', text: '#00897b' },
};

interface EstimatesListScreenProps {
  navigation: any;
}

export default function EstimatesListScreen({ navigation }: EstimatesListScreenProps) {
  const { estimates, getProject, getClient } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estimates</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {estimates.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No estimates yet</Text>
            <Text style={styles.emptyText}>
              Create a project and generate an AI estimate to see it here
            </Text>
          </View>
        )}

        {estimates.map((estimate) => {
          const project = getProject(estimate.projectId);
          const client = project ? getClient(project.clientId) : undefined;
          const date = new Date(estimate.createdAt);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

          return (
            <TouchableOpacity
              key={estimate.id}
              style={styles.estimateCard}
              onPress={() => navigation.navigate('EstimateDetail', { estimateId: estimate.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.projectName}>{project?.name ?? 'Unknown Project'}</Text>
                  <Text style={styles.clientName}>{client?.name ?? 'Unknown Client'}</Text>
                  <Text style={styles.serviceType}>{project?.serviceType ?? ''}</Text>
                </View>
                <View style={styles.totalContainer}>
                  <Text style={styles.totalValue}>${estimate.total.toFixed(2)}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[estimate.status]?.bg ?? '#e8f0fe' },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: STATUS_COLORS[estimate.status]?.text ?? '#333' },
                    ]}>{estimate.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.dateText}>{dateStr}</Text>
                <Text style={styles.itemsCount}>{estimate.lineItems.length} line items</Text>
                <Text style={styles.confidence}>{estimate.confidence}% confidence</Text>
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
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  estimateCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardInfo: { flex: 1, marginRight: 12 },
  projectName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  clientName: { fontSize: 14, color: '#666', marginBottom: 2 },
  serviceType: { fontSize: 13, color: '#1a73e8', fontWeight: '500' },
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
  confidence: { fontSize: 12, color: '#999' },
});
