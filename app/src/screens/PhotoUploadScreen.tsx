import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Photos</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {project && (
          <View style={styles.projectBanner}>
            <Text style={styles.projectBannerTitle}>{project.name}</Text>
            <Text style={styles.projectBannerAddress}>
              {project.address}, {project.city} {project.zip}
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Take quality photos</Text>
            <Text style={styles.infoText}>
              Upload at least 1 photo of the jobsite. More photos = better AI accuracy.
            </Text>
          </View>
        </View>

        <View style={styles.uploadButtons}>
          <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Text style={styles.uploadIcon}>🖼️</Text>
            <Text style={styles.uploadText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

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
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {photos.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📸</Text>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>
              Upload photos to help AI generate an accurate estimate
            </Text>
          </View>
        )}

        {photos.length >= 1 && (
          <View style={styles.section}>
            <Text style={styles.label}>Service Types * (select all that apply)</Text>
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
                    <Text style={styles.customServiceRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            }

            {/* Add custom service */}
            <Text style={styles.label}>Don't see your service? Add it:</Text>
            <View style={styles.customServiceRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g., Pool Renovation"
                placeholderTextColor="#999"
                value={customService}
                onChangeText={setCustomService}
              />
              <TouchableOpacity style={styles.addCustomButton} onPress={addCustomService}>
                <Text style={styles.addCustomButtonText}>+ Add</Text>
              </TouchableOpacity>
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

            <Text style={styles.label}>Describe the Service for AI *</Text>
            <Text style={styles.labelHint}>
              Be specific! The AI uses this description to generate accurate line items and pricing.
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what needs to be done in detail... e.g., Remove old tile in master bathroom (8x10 ft), install new porcelain tile on floor and walls up to 4ft, replace grout, add waterproof membrane behind shower..."
              placeholderTextColor="#999"
              value={serviceDescription}
              onChangeText={setServiceDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Manual Measurements (Optional)</Text>
            <View style={styles.measurementInputs}>
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>Square Feet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 120"
                  placeholderTextColor="#999"
                  value={squareFeet}
                  onChangeText={setSquareFeet}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.measurementInput}>
                <Text style={styles.measurementLabel}>Linear Feet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 40"
                  placeholderTextColor="#999"
                  value={linearFeet}
                  onChangeText={setLinearFeet}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        )}

        {photos.length >= 1 && (
          <TouchableOpacity
            style={[styles.generateButton, selectedServices.length === 0 && styles.generateButtonDisabled]}
            onPress={handleGenerateEstimate}
          >
            <Text style={styles.generateButtonText}>✨ Generate AI Estimate</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  backButton: { fontSize: 16, color: '#1a73e8' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  content: { flex: 1, padding: 20 },
  projectBanner: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  projectBannerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  projectBannerAddress: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  infoCard: {
    backgroundColor: '#e8f0fe', borderRadius: 12, padding: 16,
    flexDirection: 'row', marginBottom: 20,
  },
  infoIcon: { fontSize: 24, marginRight: 12 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#1a73e8', marginBottom: 4 },
  infoText: { fontSize: 14, color: '#666' },
  uploadButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  uploadButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 24,
    alignItems: 'center', marginHorizontal: 6, borderWidth: 2,
    borderColor: '#1a73e8', borderStyle: 'dashed',
  },
  uploadIcon: { fontSize: 40, marginBottom: 8 },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#1a73e8' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  photoContainer: { width: '31%', aspectRatio: 1, margin: 4, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: 8 },
  removeButton: {
    position: 'absolute', top: 4, right: 4, backgroundColor: '#ff0000',
    borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  removeButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 12 },
  labelHint: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  serviceOptions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  serviceButton: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14,
    paddingVertical: 10, marginRight: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  serviceButtonActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  serviceButtonText: { fontSize: 13, color: '#333', fontWeight: '500' },
  serviceButtonTextActive: { color: '#fff' },
  // Custom service
  customServiceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  addCustomButton: {
    backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 16,
    paddingVertical: 12, marginLeft: 8,
  },
  addCustomButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  customServiceTag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0fe',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    marginBottom: 8, alignSelf: 'flex-start',
  },
  customServiceTagText: { fontSize: 13, color: '#1a73e8', fontWeight: '500', marginRight: 8 },
  customServiceRemove: { fontSize: 14, color: '#d32f2f', fontWeight: '600' },
  // Selected summary
  selectedSummary: {
    backgroundColor: '#e6f4ea', borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 8,
  },
  selectedSummaryLabel: { fontSize: 12, color: '#34a853', fontWeight: '600', marginBottom: 4 },
  selectedSummaryText: { fontSize: 13, color: '#333' },
  measurementInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  measurementInput: { flex: 1, marginHorizontal: 4 },
  measurementLabel: { fontSize: 12, color: '#666', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#e0e0e0', fontSize: 14, color: '#333',
  },
  textArea: {
    minHeight: 120, borderRadius: 12, padding: 16, marginBottom: 16,
  },
  generateButton: {
    backgroundColor: '#34a853', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16,
  },
  generateButtonDisabled: { backgroundColor: '#a0c4ab' },
  generateButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
