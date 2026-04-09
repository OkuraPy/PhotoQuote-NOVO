import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Plus, X, Mail, Shield, Eye, PenTool, Trash2 } from 'lucide-react-native';
import { useApp, TeamRole } from '../context/AppContext';
import { colors, typography, spacing, radii } from '../theme';
import { Card, Avatar, Button, EmptyState, Badge } from '../components/ui';

interface TeamScreenProps {
  navigation: any;
}

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: 'Admin', color: colors.info, bg: colors.infoBg, icon: Shield },
  estimator: { label: 'Estimator', color: colors.warning, bg: colors.warningBg, icon: PenTool },
  viewer: { label: 'Viewer', color: colors.textSecondary, bg: colors.bgTertiary, icon: Eye },
};

export default function TeamScreen({ navigation }: TeamScreenProps) {
  const { teamMembers, addTeamMember, updateTeamMember, removeTeamMember } = useApp();
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<TeamRole>('viewer');
  const [saving, setSaving] = useState(false);

  const activeMembers = teamMembers.filter(m => m.status !== 'removed');

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      Alert.alert('Error', 'Please fill in name and email.');
      return;
    }
    setSaving(true);
    try {
      await addTeamMember({ email: newEmail, fullName: newName, role: newRole });
      setShowModal(false);
      setNewName('');
      setNewEmail('');
      setNewRole('viewer');
    } catch (error: any) {
      const msg = error?.message?.includes('duplicate')
        ? 'This email is already on your team.'
        : 'Failed to add team member.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = (id: string, currentRole: TeamRole) => {
    const roles: TeamRole[] = ['viewer', 'estimator', 'admin'];
    Alert.alert('Change Role', 'Select a role:', [
      ...roles.filter(r => r !== currentRole).map(r => ({
        text: ROLE_CONFIG[r].label,
        onPress: () => updateTeamMember(id, { role: r }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleRemove = (id: string, name: string) => {
    Alert.alert('Remove Member', `Remove ${name} from your team?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTeamMember(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team</Text>
        <Button
          title="Add"
          onPress={() => setShowModal(true)}
          size="sm"
          icon={<Plus size={16} color={colors.textOnPrimary} />}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeMembers.length === 0 && (
          <EmptyState
            icon={<Users size={48} color={colors.textTertiary} />}
            title="No team members yet"
            description={'Tap "Add" to invite someone to your team'}
          />
        )}

        {activeMembers.map((member) => {
          const roleConfig = ROLE_CONFIG[member.role];
          const RoleIcon = roleConfig.icon;
          return (
            <Card key={member.id} variant="elevated" style={styles.memberCard}>
              <View style={styles.memberRow}>
                <Avatar name={member.fullName} size="md" />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.fullName}</Text>
                  <View style={styles.emailRow}>
                    <Mail size={12} color={colors.textTertiary} />
                    <Text style={styles.memberEmail}>{member.memberEmail}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}
                    onPress={() => handleChangeRole(member.id, member.role)}
                  >
                    <RoleIcon size={12} color={roleConfig.color} />
                    <Text style={[styles.roleText, { color: roleConfig.color }]}>
                      {roleConfig.label}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.memberActions}>
                  <View style={[styles.statusDot, {
                    backgroundColor: member.status === 'active' ? colors.success : colors.warning,
                  }]} />
                  <Text style={styles.statusText}>
                    {member.status === 'active' ? 'Active' : 'Pending'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemove(member.id, member.fullName)}
                    style={styles.removeBtn}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        })}
        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. John Smith"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="e.g. john@email.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              {(['viewer', 'estimator', 'admin'] as TeamRole[]).map((role) => {
                const config = ROLE_CONFIG[role];
                const isSelected = newRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      isSelected && { backgroundColor: config.bg, borderColor: config.color },
                    ]}
                    onPress={() => setNewRole(role)}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      isSelected && { color: config.color, fontWeight: typography.weights.semibold },
                    ]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.roleDescription}>
              <Text style={styles.roleDescText}>
                {newRole === 'viewer' && 'Can view assigned projects, photos, and estimates.'}
                {newRole === 'estimator' && 'Can view projects + create and edit estimates.'}
                {newRole === 'admin' && 'Can view, create projects, edit estimates, and manage invoices.'}
              </Text>
            </View>

            <Button
              title={saving ? 'Adding...' : 'Add Member'}
              onPress={handleAdd}
              size="lg"
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  header: {
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backButton: {
    fontSize: typography.sizes.base,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  headerTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
    marginBottom: 2,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  memberEmail: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  memberActions: {
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
  },
  removeBtn: {
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  roleDescription: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
  },
  roleDescText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.base,
  },
});
