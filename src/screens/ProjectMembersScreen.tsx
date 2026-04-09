import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, UserMinus, ChevronDown, Check } from 'lucide-react-native';
import { useApp, ProjectMember, TeamMember } from '../context/AppContext';
import { colors, typography, spacing, radii } from '../theme';
import { Card, Avatar, Button, ScreenHeader, EmptyState } from '../components/ui';

interface ProjectMembersScreenProps {
  navigation: any;
  route: any;
}

const ACCESS_LABELS: Record<string, { label: string; desc: string }> = {
  view: { label: 'View', desc: 'Can only view' },
  edit: { label: 'Edit', desc: 'Can view and edit' },
  full: { label: 'Full', desc: 'Full access' },
};

export default function ProjectMembersScreen({ navigation, route }: ProjectMembersScreenProps) {
  const projectId = route.params?.projectId as string;
  const { teamMembers, getProjectMembers, assignProjectMember, removeProjectMember, getProject } = useApp();
  const insets = useSafeAreaInsets();

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const project = getProject(projectId);
  const activeTeamMembers = teamMembers.filter(m => m.status !== 'removed');

  // Members already assigned
  const assignedMemberIds = new Set(projectMembers.map(pm => pm.memberId));
  // Available to add
  const availableMembers = activeTeamMembers.filter(m => !assignedMemberIds.has(m.id));

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const members = await getProjectMembers(projectId);
      setProjectMembers(members);
    } catch (error) {
      console.error('Failed to load project members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (member: TeamMember) => {
    Alert.alert(
      'Add to Project',
      `Add ${member.fullName} to "${project?.name || 'this project'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Access',
          onPress: () => doAssign(member.id, 'view'),
        },
        {
          text: 'Edit Access',
          onPress: () => doAssign(member.id, 'edit'),
        },
        {
          text: 'Full Access',
          onPress: () => doAssign(member.id, 'full'),
        },
      ]
    );
  };

  const doAssign = async (memberId: string, accessLevel: ProjectMember['accessLevel']) => {
    setAssigning(true);
    try {
      const pm = await assignProjectMember(projectId, memberId, accessLevel);
      setProjectMembers(prev => [...prev, pm]);
    } catch (error) {
      Alert.alert('Error', 'Failed to assign member.');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = (pm: ProjectMember) => {
    Alert.alert('Remove from Project', `Remove ${pm.memberName} from this project?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeProjectMember(pm.id);
            setProjectMembers(prev => prev.filter(p => p.id !== pm.id));
          } catch (error) {
            Alert.alert('Error', 'Failed to remove member.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Project Team" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Members */}
        <Text style={styles.sectionTitle}>
          Assigned Members ({projectMembers.length})
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : projectMembers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No team members assigned to this project yet.</Text>
          </Card>
        ) : (
          projectMembers.map((pm) => (
            <Card key={pm.id} variant="elevated" style={styles.memberCard}>
              <View style={styles.memberRow}>
                <Avatar name={pm.memberName} size="sm" />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{pm.memberName}</Text>
                  <Text style={styles.memberEmail}>{pm.memberEmail}</Text>
                </View>
                <View style={[styles.accessBadge, {
                  backgroundColor: pm.accessLevel === 'full' ? colors.successBg
                    : pm.accessLevel === 'edit' ? colors.warningBg : colors.bgTertiary,
                }]}>
                  <Text style={[styles.accessText, {
                    color: pm.accessLevel === 'full' ? colors.success
                      : pm.accessLevel === 'edit' ? colors.warning : colors.textSecondary,
                  }]}>
                    {ACCESS_LABELS[pm.accessLevel]?.label || pm.accessLevel}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(pm)} style={styles.removeBtn}>
                  <UserMinus size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Available Members */}
        {availableMembers.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
              Available to Add ({availableMembers.length})
            </Text>

            {availableMembers.map((member) => (
              <Card key={member.id} variant="elevated" style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <Avatar name={member.fullName} size="sm" />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.fullName}</Text>
                    <Text style={styles.memberEmail}>{member.memberEmail}</Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                  <Button
                    title="Add"
                    onPress={() => handleAssign(member)}
                    size="sm"
                    icon={<UserPlus size={14} color={colors.textOnPrimary} />}
                  />
                </View>
              </Card>
            ))}
          </>
        )}

        {activeTeamMembers.length === 0 && (
          <Card style={[styles.emptyCard, { marginTop: spacing.xl }]}>
            <Text style={styles.emptyText}>
              You don't have any team members yet. Go to Team settings to invite people.
            </Text>
            <Button
              title="Go to Team"
              onPress={() => navigation.navigate('Team')}
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  memberCard: { marginBottom: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  memberEmail: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  memberRole: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  accessBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  accessText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  emptyCard: { padding: spacing.xl },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.base,
  },
});
