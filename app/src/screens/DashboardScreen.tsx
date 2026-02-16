import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useApp, EstimateStatus } from '../context/AppContext';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Draft: { bg: '#e8f0fe', text: '#1a73e8' },
  Sent: { bg: '#fef7e0', text: '#e37400' },
  Approved: { bg: '#e6f4ea', text: '#34a853' },
  'In Progress': { bg: '#fff3e0', text: '#f57c00' },
  Completed: { bg: '#e0f2f1', text: '#00897b' },
};

interface DashboardScreenProps {
  navigation: any;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { clients, projects, estimates, getClient, getProjectEstimates } = useApp();

  const totalEstimateValue = estimates.reduce((sum, e) => sum + e.total, 0);

  const stats = [
    { label: 'Projects', value: String(projects.length), color: '#1a73e8' },
    { label: 'Estimates', value: String(estimates.length), color: '#34a853' },
    { label: 'Clients', value: String(clients.length), color: '#fbbc04' },
  ];

  const recentProjects = projects.slice(0, 5);

  // Get the effective status for a project based on its most recent estimate
  const getProjectStatus = (projectId: string): string => {
    const projectEstimates = getProjectEstimates(projectId);
    if (projectEstimates.length === 0) return 'Draft';
    // Use the most recent estimate's status (estimates are ordered newest first)
    return projectEstimates[0].status;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.companyName}>PhotoQuote AI</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('CompanyProfile')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={[styles.statCard, { borderLeftColor: stat.color }]}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#1a73e8' }]}
              onPress={() => navigation.navigate('NewProject')}
            >
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={styles.actionText}>New Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#34a853' }]}
              onPress={() => navigation.navigate('AddClient')}
            >
              <Text style={styles.actionIcon}>👥</Text>
              <Text style={styles.actionText}>New Client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#fbbc04' }]}
              onPress={() => navigation.navigate('Clients')}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionText}>View All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Projects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          {recentProjects.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No projects yet. Tap "New Project" to get started!</Text>
            </View>
          )}
          {recentProjects.map((project) => {
            const client = getClient(project.clientId);
            const status = getProjectStatus(project.id);
            const colors = STATUS_COLORS[status] ?? STATUS_COLORS.Draft;
            return (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => navigation.navigate('PhotoUpload', { projectId: project.id })}
              >
                <View style={styles.projectIcon}>
                  <Text style={styles.projectIconText}>📁</Text>
                </View>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.projectClient}>
                    Client: {client?.name ?? 'Unknown'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.statusText, { color: colors.text }]}>{status}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  greeting: { fontSize: 16, color: '#666' },
  companyName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 4 },
  settingsButton: { padding: 8 },
  settingsIcon: { fontSize: 24 },
  content: { flex: 1, padding: 20 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12,
    marginHorizontal: 4, borderLeftWidth: 4, elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCard: {
    flex: 1, padding: 20, borderRadius: 12, alignItems: 'center',
    marginHorizontal: 4, elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  projectCard: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  projectIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  projectIconText: { fontSize: 24 },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  projectClient: { fontSize: 14, color: '#666' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
});
