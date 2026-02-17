import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  ImageIcon,
  Lightbulb,
  X,
  Plus,
  Sparkles,
  CameraIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { ScreenHeader, Card, Button, Input, EmptyState, Divider } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { projectService } from '../services/database';
import { handleError } from '../utils/errorHandler';

const SERVICE_OPTIONS = [
  'Flooring',
  'Painting',
  'Drywall',
  'Bathroom',
  'Kitchen',
  'Plumbing',
  'Electrical',
  'Roofing',
  'Windows & Doors',
  'HVAC',
  'Fencing',
  'Landscaping',
  'Concrete',
  'Siding',
  'Tiling',
  'Carpentry',
  'Demolition',
  'General Repair',
];

interface PhotoUploadScreenProps {
  navigation: any;
  route: any;
}

export default function PhotoUploadScreen({ navigation, route }: PhotoUploadScreenProps) {
  const { updateProject, getProject } = useApp();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const projectId = route.params?.projectId as string | undefined;
  const project = projectId ? getProject(projectId) : undefined;

  const [photos, setPhotos] = useState<string[]>(project?.photos ?? []);
  const [uploading, setUploading] = useState(false);

  // Multi-select: parse existing serviceType back to array
  const initialServices = project?.serviceType
    ? project.serviceType.split(', ').filter(Boolean)
    : [];
  const [selectedServices, setSelectedServices] = useState<string[]>(initialServices);
  const [customService, setCustomService] = useState('');
  const [serviceDescription, setServiceDescription] = useState(project?.serviceDescription ?? '');
  const [squareFeet, setSquareFeet] = useState(project?.squareFeet ?? '');
  const [linearFeet, setLinearFeet] = useState(project?.linearFeet ?? '');

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const addCustomService = () => {
    const trimmed = customService.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please type a service name.');
      return;
    }
    if (selectedServices.includes(trimmed)) {
      Alert.alert('Duplicate', 'This service is already selected.');
      return;
    }
    setSelectedServices(prev => [...prev, trimmed]);
    setCustomService('');
  };

  const pickImage = async () => {
    if (!user || !projectId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      exif: false,
    });

    if (!result.canceled && result.assets) {
      setUploading(true);
      try {
        const uploadedUrls: string[] = [];

        for (const asset of result.assets) {
          if (photos.length + uploadedUrls.length >= 30) break;

          const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const photoUrl = await storageService.uploadProjectPhoto(
            user.id,
            projectId,
            asset.uri,
            photoId
          );

          // Save to media table
          await projectService.addPhoto(projectId, photoUrl, photos.length + uploadedUrls.length);
          uploadedUrls.push(photoUrl);
        }

        const combined = [...photos, ...uploadedUrls];
        setPhotos(combined);
      } catch (error) {
        Alert.alert('Upload Error', handleError(error));
      } finally {
        setUploading(false);
      }
    }
  };

  const takePhoto = async () => {
    if (!user || !projectId) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      exif: false,
    });

    if (!result.canceled && result.assets) {
      if (photos.length >= 30) {
        Alert.alert('Limit Reached', 'Maximum 30 photos per project');
        return;
      }

      setUploading(true);
      try {
        const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const photoUrl = await storageService.uploadProjectPhoto(
          user.id,
          projectId,
          result.assets[0].uri,
          photoId
        );

        // Save to media table
        await projectService.addPhoto(projectId, photoUrl, photos.length);
        setPhotos([...photos, photoUrl]);
      } catch (error) {
        Alert.alert('Upload Error', handleError(error));
      } finally {
        setUploading(false);
      }
    }
  };

  const handleGenerateEstimate = async () => {
    if (selectedServices.length === 0) {
      Alert.alert('Select a service', 'Please select at least one service type before generating an estimate.');
      return;
    }

    // Save service details to project
    if (projectId) {
      setUploading(true);
      try {
        await updateProject(projectId, {
          photos, // Already uploaded
          serviceType: selectedServices.join(', '),
          serviceDescription,
          squareFeet,
          linearFeet,
        });

        navigation.navigate('EstimatePreview', { projectId });
      } catch (error) {
        Alert.alert('Error', handleError(error));
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Upload Photos" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Project Banner */}
        {project && (
          <View style={styles.projectBanner}>
            <Text style={styles.projectBannerTitle}>{project.name}</Text>
            <Text style={styles.projectBannerAddress}>
              {project.address}, {project.city} {project.zip}
            </Text>
          </View>
        )}

        {/* Info Card */}
        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Lightbulb size={20} color={colors.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Take quality photos</Text>
              <Text style={styles.infoText}>
                Upload at least 1 photo of the jobsite. More photos = better AI accuracy.
              </Text>
            </View>
          </View>
        </Card>

        {/* Upload Buttons */}
        <View style={styles.uploadButtons}>
          <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
            <Camera size={32} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.uploadText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <ImageIcon size={32} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.uploadText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadingIndicator}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}

        {/* Photos Grid */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({photos.length}/30)</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    <X size={14} color={colors.textOnPrimary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {photos.length === 0 && (
          <EmptyState
            icon={<CameraIcon size={48} color={colors.textTertiary} strokeWidth={1.5} />}
            title="No photos yet"
            description="Upload photos to help AI generate an accurate estimate"
          />
        )}

        {/* Service Selection (shown after photos uploaded) */}
        {photos.length >= 1 && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Service Types * (select all that apply)</Text>
            <View style={styles.serviceOptions}>
              {SERVICE_OPTIONS.map((service) => {
                const isSelected = selectedServices.includes(service);
                return (
                  <TouchableOpacity
                    key={service}
                    style={[styles.serviceButton, isSelected && styles.serviceButtonActive]}
                    onPress={() => toggleService(service)}
                  >
                    <Text style={[styles.serviceButtonText, isSelected && styles.serviceButtonTextActive]}>
                      {service}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom services added by user */}
            {selectedServices
              .filter(s => !SERVICE_OPTIONS.includes(s))
              .map((custom) => (
                <View key={custom} style={styles.customServiceTag}>
                  <Text style={styles.customServiceTagText}>{custom}</Text>
                  <TouchableOpacity onPress={() => setSelectedServices(prev => prev.filter(s => s !== custom))}>
                    <X size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            }

            {/* Add custom service */}
            <Text style={styles.fieldLabel}>Don't see your service? Add it:</Text>
            <View style={styles.customServiceRow}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="e.g., Pool Renovation"
                  value={customService}
                  onChangeText={setCustomService}
                />
              </View>
              <Button
                title="Add"
                onPress={addCustomService}
                size="md"
                icon={<Plus size={16} color={colors.textOnPrimary} />}
                style={styles.addCustomButton}
              />
            </View>

            {/* Selected summary */}
            {selectedServices.length > 0 && (
              <View style={styles.selectedSummary}>
                <Text style={styles.selectedSummaryLabel}>Selected:</Text>
                <Text style={styles.selectedSummaryText}>
                  {selectedServices.join(', ')}
                </Text>
              </View>
            )}

            <Input
              label="Describe the Service for AI *"
              helperText="Be specific! The AI uses this description to generate accurate line items and pricing."
              placeholder="Describe what needs to be done in detail... e.g., Remove old tile in master bathroom (8x10 ft), install new porcelain tile on floor and walls up to 4ft, replace grout, add waterproof membrane behind shower..."
              value={serviceDescription}
              onChangeText={setServiceDescription}
              multiline
              numberOfLines={6}
              style={styles.textArea}
              containerStyle={styles.inputSpacing}
            />

            <Text style={styles.fieldLabel}>Manual Measurements (Optional)</Text>
            <View style={styles.measurementInputs}>
              <View style={styles.measurementInput}>
                <Input
                  label="Square Feet"
                  placeholder="e.g., 120"
                  value={squareFeet}
                  onChangeText={setSquareFeet}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.measurementInput}>
                <Input
                  label="Linear Feet"
                  placeholder="e.g., 40"
                  value={linearFeet}
                  onChangeText={setLinearFeet}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        )}

        {/* Generate Button */}
        {photos.length >= 1 && (
          <Button
            title="Generate AI Estimate"
            onPress={handleGenerateEstimate}
            size="lg"
            fullWidth
            disabled={selectedServices.length === 0}
            loading={uploading}
            icon={<Sparkles size={18} color={colors.textOnPrimary} />}
            style={{ backgroundColor: colors.success, marginTop: spacing.lg }}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  projectBanner: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  projectBannerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textOnPrimary,
  },
  projectBannerAddress: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  infoCard: {
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.base,
  },
  uploadButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing['2xl'],
    gap: spacing.md,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: radii.lg,
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  uploadingText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  photoContainer: {
    width: '31%',
    aspectRatio: 1,
    margin: spacing.xs,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.error,
    borderRadius: radii.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  serviceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  serviceButton: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  serviceButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  serviceButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  serviceButtonTextActive: {
    color: colors.textOnPrimary,
  },
  customServiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  addCustomButton: {
    marginTop: 0,
  },
  customServiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  customServiceTagText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  selectedSummary: {
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectedSummaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  selectedSummaryText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  inputSpacing: {
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  measurementInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  measurementInput: {
    flex: 1,
  },
});
