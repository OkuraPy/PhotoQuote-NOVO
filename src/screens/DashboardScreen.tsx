import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users, FolderOpen, FileText, DollarSign, Plus, ChevronRight,
  Building2, Settings, UserPlus,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { Card, StatCard, StatusBadge, EmptyState } from '../components/ui';

interface DashboardScreenProps {
  navigation: any;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { clients, projects, estimates, getClient, getProjectEstimates } = useApp();
  const insets = useSafeAreaInsets();

  const totalEstimateValue = estimates.reduce((sum, e) => sum + (e.total || 0), 0);
  const recentProjects = projects.slice(0, 5);

  const getProjectStatus = (projectId: string): string => {
    const projectEstimates = getProjectEstimates(projectId);
    if (projectEstimates.length === 0) return 'draft';
    return projectEstimates[0].status.toLowerCase().replace(' ', '_');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoCircle}>
            <Building2 size={18} color={colors.textOnPrimary} />
          </View>
          <View>
            <Text style={styles.companyName}>PhotoQuote AI</Text>
            <Text style={styles.greeting}>Welcome back</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('CompanyProfile')}
          activeOpacity={0.7}
        >
          <Settings size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Stat Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="Clients"
              value={clients.length}
              icon={<Users size={18} color={colors.statGreen} />}
              accentColor={colors.statGreen}
            />
            <View style={{ width: spacing.md }} />
            <StatCard
              label="Projects"
              value={projects.length}
              icon={<FolderOpen size={18} color={colors.statBlue} />}
              accentColor={colors.statBlue}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Estimates"
              value={estimates.length}
              icon={<FileText size={18} color={colors.statOrange} />}
              accentColor={colors.statOrange}
            />
            <View style={{ width: spacing.md }} />
            <StatCard
              label="Revenue"
              value={`$${totalEstimateValue >= 1000 ? (totalEstimateValue / 1000).toFixed(1) + 'k' : totalEstimateValue.toFixed(0)}`}
              icon={<DollarSign size={18} color={colors.statPurple} />}
              accentColor={colors.statPurple}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('NewProject')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Plus size={20} color={colors.primary} />
            </View>
            <Text style={styles.actionText}>New Project</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AddClient')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '15' }]}>
              <UserPlus size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionText}>New Client</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Team')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.statPurple + '15' }]}>
              <Users size={20} color={colors.statPurple} />
            </View>
            <Text style={styles.actionText}>Team</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Projects */}
        <Text style={styles.sectionTitle}>Recent Projects</Text>
        {recentProjects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={48} color={colors.textTertiary} />}
            title="No projects yet"
            description='Tap "New Project" to get started!'
          />
        ) : (
          recentProjects.map((project) => {
            const client = getClient(project.clientId);
            const status = getProjectStatus(project.id);
            return (
              <Card
                key={project.id}
                variant="elevated"
                onPress={() => {
                  const projectEstimates = getProjectEstimates(project.id);
                  if (projectEstimates.length > 0) {
                    navigation.navigate('EstimateDetail', { estimateId: projectEstimates[0].id });
                  } else {
                    navigation.navigate('PhotoUpload', { projectId: project.id });
                  }
                }}
                style={styles.projectCard}
              >
                <View style={styles.projectRow}>
                  <View style={styles.projectIconWrap}>
                    <Building2 size={20} color={colors.primary} />
                  </View>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectClient}>{client?.name ?? 'Unknown'}</Text>
                  </View>
                  <StatusBadge status={status as any} />
                  <ChevronRight size={18} color={colors.textTertiary} style={{ marginLeft: spacing.sm }} />
                </View>
              </Card>
            );
          })
        )}
        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  companyName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  greeting: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  statsGrid: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: radii.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  projectCard: {
    marginBottom: spacing.sm,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIconWrap: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectInfo: { flex: 1 },
  projectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  projectClient: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});
