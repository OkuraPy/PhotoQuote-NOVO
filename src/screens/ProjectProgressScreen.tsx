import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Camera,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
  Link2,
  CheckCircle,
  Clock,
  Circle,
  Send,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radii } from '../theme';
import { ScreenHeader, Card, Button, Divider } from '../components/ui';
import { useApp, ProjectPhase, PhaseStatus } from '../context/AppContext';
import { phaseService, shareTokenService } from '../services/database';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

interface ProjectProgressScreenProps {
  navigation: any;
  route: any;
}

const STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_ICONS: Record<PhaseStatus, any> = {
  not_started: Circle,
  in_progress: Clock,
  completed: CheckCircle,
};

const STATUS_COLORS: Record<PhaseStatus, string> = {
  not_started: colors.textTertiary,
  in_progress: colors.warning,
  completed: colors.success,
};

export default function ProjectProgressScreen({ navigation, route }: ProjectProgressScreenProps) {
  const { getProject, getProjectEstimates } = useApp();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const projectId = route.params?.projectId as string;
  const project = getProject(projectId);
  const estimates = getProjectEstimates(projectId);

  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [shareLink, setShareLink] = useState<string | null>(null);

  const loadPhases = useCallback(async () => {
    try {
      const data = await phaseService.getAll(projectId);
      setPhases(data);
    } catch (error) {
      console.error('Error loading phases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadShareToken = useCallback(async () => {
    try {
      const token = await shareTokenService.getByProject(projectId);
      if (token) {
        setShareLink(`https://photoquote-client-portal.vercel.app/p/${token.token}`);
      }
    } catch (error) {
      console.error('Error loading share token:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadPhases();
    loadShareToken();
  }, [loadPhases, loadShareToken]);

  const handleAddPhase = async () => {
    if (!newPhaseName.trim() || !user) return;
    const estimateId = estimates[0]?.id;
    if (!estimateId) {
      Alert.alert('Error', 'This project needs an estimate before adding phases.');
      return;
    }
    try {
      const phase = await phaseService.create(projectId, estimateId, newPhaseName.trim(), phases.length, user.id);
      setPhases(prev => [...prev, phase]);
      setNewPhaseName('');
      setShowAddPhase(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add phase.');
    }
  };

  const handleUpdateStatus = async (phaseId: string, newStatus: PhaseStatus) => {
    try {
      await phaseService.update(phaseId, { status: newStatus });
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, status: newStatus, actualCompletionDate: newStatus === 'completed' ? new Date().toISOString() : p.actualCompletionDate } : p
      ));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update status.');
    }
  };

  const handleDeletePhase = (phaseId: string, name: string) => {
    Alert.alert('Delete Phase', `Delete "${name}"? This will also delete its photos and comments.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await phaseService.delete(phaseId);
            setPhases(prev => prev.filter(p => p.id !== phaseId));
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to delete phase.');
          }
        }
      },
    ]);
  };

  const handleAddPhoto = async (phaseId: string) => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() || 'jpg';
      const fileName = `phase_${phaseId}_${Date.now()}.${ext}`;
      const filePath = `phase-photos/${projectId}/${fileName}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(filePath, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(filePath);

      const photo = await phaseService.addPhoto(phaseId, projectId, user.id, urlData.publicUrl, '');
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, photos: [...p.photos, photo] } : p
      ));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to upload photo.');
    }
  };

  const handleAddComment = async (phaseId: string) => {
    const text = commentText[phaseId]?.trim();
    if (!text) return;

    try {
      const comment = await phaseService.addComment(phaseId, projectId, 'Contractor', text);
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, comments: [...p.comments, comment] } : p
      ));
      setCommentText(prev => ({ ...prev, [phaseId]: '' }));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add comment.');
    }
  };

  const handleShareLink = async () => {
    if (!user) return;

    try {
      let link = shareLink;
      if (!link) {
        const token = await shareTokenService.create(projectId, user.id);
        link = `https://photoquote-client-portal.vercel.app/p/${token.token}`;
        setShareLink(link);
      }

      await Share.share({
        message: `Track your project progress here: ${link}`,
        url: link,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Error', error?.message || 'Failed to share link.');
      }
    }
  };

  const completedCount = phases.filter(p => p.status === 'completed').length;
  const progressPercent = phases.length > 0 ? Math.round((completedCount / phases.length) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Project Progress" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Project Progress" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Project Info + Progress */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.projectName}>{project?.name ?? 'Project'}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressPercent}%</Text>
          </View>
          <Text style={styles.phaseCount}>
            {completedCount} of {phases.length} phases completed
          </Text>
        </Card>

        {/* Share Link */}
        <Card style={styles.cardSpacing}>
          <Button
            title={shareLink ? 'Share Client Link' : 'Generate Client Link'}
            onPress={handleShareLink}
            size="lg"
            icon={<Link2 size={18} color={colors.textOnPrimary} />}
          />
          {shareLink && (
            <Text style={styles.shareLinkText} numberOfLines={1}>{shareLink}</Text>
          )}
        </Card>

        {/* Phases */}
        {phases.map((phase) => {
          const isExpanded = expandedPhase === phase.id;
          const StatusIcon = STATUS_ICONS[phase.status];
          const statusColor = STATUS_COLORS[phase.status];

          return (
            <Card key={phase.id} style={styles.cardSpacing}>
              <TouchableOpacity
                onPress={() => setExpandedPhase(isExpanded ? null : phase.id)}
                style={styles.phaseHeader}
              >
                <StatusIcon size={20} color={statusColor} />
                <View style={styles.phaseInfo}>
                  <Text style={styles.phaseName}>{phase.name}</Text>
                  <Text style={[styles.phaseStatus, { color: statusColor }]}>
                    {STATUS_LABELS[phase.status]}
                  </Text>
                </View>
                {isExpanded ? (
                  <ChevronUp size={20} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={20} color={colors.textTertiary} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.phaseBody}>
                  <Divider marginVertical={spacing.md} />

                  {/* Status buttons */}
                  <View style={styles.statusRow}>
                    {(['not_started', 'in_progress', 'completed'] as PhaseStatus[]).map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => handleUpdateStatus(phase.id, s)}
                        style={[
                          styles.statusBtn,
                          phase.status === s && { backgroundColor: STATUS_COLORS[s] + '20', borderColor: STATUS_COLORS[s] },
                        ]}
                      >
                        <Text style={[
                          styles.statusBtnText,
                          phase.status === s && { color: STATUS_COLORS[s], fontWeight: '700' as any },
                        ]}>
                          {STATUS_LABELS[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Photos */}
                  <Text style={styles.sectionLabel}>Photos ({phase.photos.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                    {phase.photos.map(photo => (
                      <Image key={photo.id} source={{ uri: photo.fileUrl }} style={styles.photoThumb} />
                    ))}
                    <TouchableOpacity onPress={() => handleAddPhoto(phase.id)} style={styles.addPhotoBtn}>
                      <Camera size={24} color={colors.primary} />
                      <Text style={styles.addPhotoText}>Add</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {/* Comments */}
                  <Text style={styles.sectionLabel}>Comments ({phase.comments.length})</Text>
                  {phase.comments.map(comment => (
                    <View key={comment.id} style={[
                      styles.commentBubble,
                      comment.authorType === 'client' ? styles.clientComment : styles.contractorComment,
                    ]}>
                      <Text style={styles.commentAuthor}>
                        {comment.authorName} ({comment.authorType})
                      </Text>
                      <Text style={styles.commentContent}>{comment.content}</Text>
                      <Text style={styles.commentTime}>
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}

                  {/* Add comment */}
                  <View style={styles.commentInputRow}>
                    <TextInput
                      style={styles.commentInput}
                      value={commentText[phase.id] || ''}
                      onChangeText={(v) => setCommentText(prev => ({ ...prev, [phase.id]: v }))}
                      placeholder="Add a comment..."
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity onPress={() => handleAddComment(phase.id)} style={styles.sendBtn}>
                      <Send size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Delete phase */}
                  <TouchableOpacity
                    onPress={() => handleDeletePhase(phase.id, phase.name)}
                    style={styles.deletePhaseBtn}
                  >
                    <Trash2 size={14} color={colors.error} />
                    <Text style={styles.deletePhaseText}>Delete Phase</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        })}

        {/* Add Phase */}
        {showAddPhase ? (
          <Card style={styles.cardSpacing}>
            <Text style={styles.sectionLabel}>New Phase</Text>
            <TextInput
              style={styles.phaseInput}
              value={newPhaseName}
              onChangeText={setNewPhaseName}
              placeholder="Phase name (e.g., Demolition, Framing...)"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.addPhaseActions}>
              <Button title="Add Phase" onPress={handleAddPhase} size="md" style={{ flex: 1 }} />
              <Button title="Cancel" onPress={() => { setShowAddPhase(false); setNewPhaseName(''); }} size="md" variant="outline" style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <TouchableOpacity onPress={() => setShowAddPhase(true)} style={styles.addPhaseBtn}>
            <Plus size={20} color={colors.primary} />
            <Text style={styles.addPhaseBtnText}>Add Phase</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { flex: 1, padding: spacing.lg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardSpacing: { marginBottom: spacing.md },

  projectName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressBarBg: {
    flex: 1, height: 8, backgroundColor: colors.bgTertiary,
    borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', backgroundColor: colors.success, borderRadius: 4,
  },
  progressText: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.bold,
    color: colors.success, width: 40, textAlign: 'right',
  },
  phaseCount: {
    fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: spacing.xs,
  },

  shareLinkText: {
    fontSize: typography.sizes.xs, color: colors.textTertiary,
    marginTop: spacing.sm, textAlign: 'center',
  },

  phaseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  phaseInfo: { flex: 1 },
  phaseName: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  phaseStatus: { fontSize: typography.sizes.xs },
  phaseBody: { paddingTop: 0 },

  statusRow: {
    flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg,
  },
  statusBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  statusBtnText: { fontSize: typography.sizes.xs, color: colors.textSecondary },

  sectionLabel: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
    color: colors.textPrimary, marginBottom: spacing.sm,
  },
  photosRow: { flexDirection: 'row', marginBottom: spacing.lg },
  photoThumb: {
    width: 80, height: 80, borderRadius: radii.md, marginRight: spacing.sm,
  },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoText: { fontSize: typography.sizes.xs, color: colors.primary, marginTop: 2 },

  commentBubble: {
    padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm,
  },
  clientComment: { backgroundColor: colors.bgTertiary, marginLeft: spacing.xl },
  contractorComment: { backgroundColor: colors.primaryLight, marginRight: spacing.xl },
  commentAuthor: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textSecondary, marginBottom: 2,
  },
  commentContent: { fontSize: typography.sizes.sm, color: colors.textPrimary },
  commentTime: {
    fontSize: typography.sizes.xs - 1, color: colors.textTertiary,
    marginTop: spacing.xs, textAlign: 'right',
  },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.md,
  },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm, color: colors.textPrimary,
  },
  sendBtn: { padding: spacing.sm },

  deletePhaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm,
  },
  deletePhaseText: { fontSize: typography.sizes.xs, color: colors.error },

  phaseInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  addPhaseActions: {
    flexDirection: 'row', gap: spacing.sm,
  },
  addPhaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: radii.xl, marginBottom: spacing.md,
  },
  addPhaseBtnText: {
    fontSize: typography.sizes.base, color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
