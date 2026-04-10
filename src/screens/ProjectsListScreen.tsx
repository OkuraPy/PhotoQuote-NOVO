import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FolderOpen, ChevronRight, Building2 } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { colors, typography, spacing } from '../theme';
import { Card, StatusBadge, EmptyState, Divider } from '../components/ui';

interface ProjectsListScreenProps {
  navigation: any;
}

export default function ProjectsListScreen({ navigation }: ProjectsListScreenProps) {
  const { projects, estimates, getClient, getProjectEstimates } = useApp();
  const insets = useSafeAreaInsets();

  const handleProjectPress = (projectId: string) => {
    const projectEstimates = getProjectEstimates(projectId);
    if (projectEstimates.length > 0) {
      navigation.navigate('EstimateDetail', { estimateId: projectEstimates[0].id });
    } else {
      navigation.navigate('PhotoUpload', { projectId });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Projects</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {projects.length === 0 && (
          <EmptyState
            icon={<FolderOpen size={48} color={colors.textTertiary} />}
            title="No projects yet"
            description='Tap "New Project" on the home screen to get started!'
          />
        )}

        {projects.map((project) => {
          const client = getClient(project.clientId);
          const projectEstimates = getProjectEstimates(project.id);
          const date = new Date(project.createdAt);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          const status = projectEstimates.length > 0
            ? projectEstimates[0].status.toLowerCase().replace(' ', '_')
            : 'draft';

          return (
            <Card
              key={project.id}
              variant="elevated"
              onPress={() => handleProjectPress(project.id)}
              style={styles.projectCard}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <Building2 size={20} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.clientName}>{client?.name ?? 'Unknown Client'}</Text>
                  {project.serviceType ? (
                    <Text style={styles.serviceType}>{project.serviceType}</Text>
                  ) : null}
                </View>
                <View style={styles.cardRight}>
                  <StatusBadge status={status as any} />
                  <ChevronRight size={16} color={colors.textTertiary} style={{ marginTop: spacing.xs }} />
                </View>
              </View>
              <Divider marginVertical={spacing.md} />
              <View style={styles.cardBottom}>
                <Text style={styles.metaText}>{dateStr}</Text>
                <Text style={styles.metaText}>{projectEstimates.length} estimate{projectEstimates.length !== 1 ? 's' : ''}</Text>
                {project.address ? (
                  <Text style={styles.metaText} numberOfLines={1}>{project.address}</Text>
                ) : null}
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
  projectCard: { marginBottom: spacing.sm },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardInfo: { flex: 1, marginRight: spacing.md },
  projectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  clientName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  serviceType: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  cardRight: { alignItems: 'flex-end' },
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
