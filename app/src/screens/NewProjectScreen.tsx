import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { handleError } from '../utils/errorHandler';

interface NewProjectScreenProps {
  navigation: any;
}

export default function NewProjectScreen({ navigation }: NewProjectScreenProps) {
  const { clients, addProject } = useApp();
  const [loading, setLoading] = useState(false);

  const [projectName, setProjectName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [propertyType, setPropertyType] = useState('Residential');
  const [accessLevel, setAccessLevel] = useState('Easy');
  const [floorLevel, setFloorLevel] = useState('0');
  const [hasElevator, setHasElevator] = useState(false);
  const [parkingType, setParkingType] = useState('Easy');
  const [showClientPicker, setShowClientPicker] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleContinue = async () => {
    if (!projectName.trim()) {
      Alert.alert('Required', 'Please enter a project name.');
      return;
    }
    if (!selectedClientId) {
      Alert.alert('Required', 'Please select a client.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required', 'Please enter the street address.');
      return;
    }
    if (!zip.trim()) {
      Alert.alert('Required', 'Please enter the ZIP code.');
      return;
    }

    setLoading(true);
    try {
      const project = await addProject({
        name: projectName.trim(),
        clientId: selectedClientId,
        address: address.trim(),
        city: city.trim() || 'Miami',
        zip: zip.trim(),
        propertyType,
        accessLevel,
        floorLevel,
        hasElevator,
        parkingType,
        serviceType: '',
        serviceDescription: '',
        squareFeet: '',
        linearFeet: '',
      });

      navigation.navigate('PhotoUpload', { projectId: project.id });
    } catch (error) {
      Alert.alert('Error', handleError(error));
    } finally {
      setLoading(false);
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
        <Text style={styles.headerTitle}>New Project</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>

          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Bathroom Remodel - Smith Residence"
            placeholderTextColor="#999"
            value={projectName}
            onChangeText={setProjectName}
          />

          <Text style={styles.label}>Client *</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => {
              if (clients.length === 0) {
                Alert.alert(
                  'No Clients',
                  'You need to add a client first.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Client', onPress: () => navigation.navigate('AddClient') },
                  ]
                );
              } else {
                setShowClientPicker(true);
              }
            }}
          >
            <Text style={selectedClient ? styles.selectTextSelected : styles.selectText}>
              {selectedClient ? selectedClient.name : 'Select Client'}
            </Text>
            <Text style={styles.selectArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Location</Text>

          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Ocean Dr"
            placeholderTextColor="#999"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="Miami"
                placeholderTextColor="#999"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>ZIP Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="33101"
                placeholderTextColor="#999"
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>

          <Text style={styles.label}>Property Type *</Text>
          <View style={styles.optionsRow}>
            {['Residential', 'Commercial', 'Condo'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.optionButton, propertyType === type && styles.optionButtonActive]}
                onPress={() => setPropertyType(type)}
              >
                <Text style={[styles.optionText, propertyType === type && styles.optionTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Access Level *</Text>
          <View style={styles.optionsRow}>
            {['Easy', 'Medium', 'Hard'].map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.optionButton, accessLevel === level && styles.optionButtonActive]}
                onPress={() => setAccessLevel(level)}
              >
                <Text style={[styles.optionText, accessLevel === level && styles.optionTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Floor Level</Text>
              <TextInput
                style={styles.input}
                placeholder="0 (Ground)"
                placeholderTextColor="#999"
                value={floorLevel}
                onChangeText={setFloorLevel}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Elevator</Text>
              <View style={styles.optionsRow}>
                {['Yes', 'No'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionButton, (option === 'Yes') === hasElevator && styles.optionButtonActive]}
                    onPress={() => setHasElevator(option === 'Yes')}
                  >
                    <Text style={[styles.optionText, (option === 'Yes') === hasElevator && styles.optionTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Parking</Text>
          <View style={styles.optionsRow}>
            {['Easy', 'Paid', 'Hard'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.optionButton, parkingType === type && styles.optionButtonActive]}
                onPress={() => setParkingType(type)}
              >
                <Text style={[styles.optionText, parkingType === type && styles.optionTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue to Photos →</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Client Picker Modal */}
      <Modal visible={showClientPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedClientId === item.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedClientId(item.id);
                    setShowClientPicker(false);
                  }}
                >
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemPhone}>{item.phone}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No clients available</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16,
    borderWidth: 1, borderColor: '#e0e0e0', color: '#333',
  },
  selectInput: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16,
    borderWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  selectText: { fontSize: 16, color: '#999' },
  selectTextSelected: { fontSize: 16, color: '#333', fontWeight: '500' },
  selectArrow: { fontSize: 24, color: '#999' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1, marginHorizontal: 4 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  optionButton: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1,
    borderColor: '#e0e0e0', backgroundColor: '#fff', marginHorizontal: 4, alignItems: 'center',
  },
  optionButtonActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  optionText: { fontSize: 14, color: '#333', fontWeight: '500' },
  optionTextActive: { color: '#fff' },
  continueButton: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24,
  },
  continueButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', padding: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  modalClose: { fontSize: 24, color: '#666', padding: 4 },
  modalItem: {
    padding: 16, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f8f9fa',
  },
  modalItemActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  modalItemName: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalItemPhone: { fontSize: 14, color: '#666', marginTop: 4 },
  modalEmpty: { fontSize: 14, color: '#999', textAlign: 'center', padding: 20 },
});
