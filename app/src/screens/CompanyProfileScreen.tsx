import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';

interface CompanyProfileScreenProps {
  navigation: any;
}

export default function CompanyProfileScreen({ navigation }: CompanyProfileScreenProps) {
  const { companyProfile, updateCompanyProfile } = useApp();

  const [name, setName] = useState(companyProfile.name);
  const [address, setAddress] = useState(companyProfile.address);
  const [city, setCity] = useState(companyProfile.city);
  const [state, setState] = useState(companyProfile.state);
  const [zip, setZip] = useState(companyProfile.zip);
  const [phone, setPhone] = useState(companyProfile.phone);
  const [email, setEmail] = useState(companyProfile.email);
  const [website, setWebsite] = useState(companyProfile.website);
  const [licenseNumber, setLicenseNumber] = useState(companyProfile.licenseNumber);
  const [logoUri, setLogoUri] = useState(companyProfile.logoUri);
  const [logoScale, setLogoScale] = useState(companyProfile.logoScale || 1);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setLogoUri(result.assets[0].uri);
      setLogoScale(1);
    }
  };

  const adjustScale = (delta: number) => {
    setLogoScale(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(0.5, Math.min(2.0, next));
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your company name.');
      return;
    }

    updateCompanyProfile({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      licenseNumber: licenseNumber.trim(),
      logoUri,
      logoScale,
    });

    Alert.alert('Saved', 'Company profile has been updated.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
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
        <Text style={styles.headerTitle}>Company Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <TouchableOpacity style={styles.logoContainer} onPress={pickLogo}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={[styles.logoImage, { transform: [{ scale: logoScale }] }]}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderIcon}>🏢</Text>
                <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
              </View>
            )}
          </TouchableOpacity>

          {logoUri ? (
            <View style={styles.logoControls}>
              <View style={styles.scaleRow}>
                <TouchableOpacity style={styles.scaleButton} onPress={() => adjustScale(-0.1)}>
                  <Text style={styles.scaleButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.scaleLabel}>{Math.round(logoScale * 100)}%</Text>
                <TouchableOpacity style={styles.scaleButton} onPress={() => adjustScale(0.1)}>
                  <Text style={styles.scaleButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { setLogoUri(''); setLogoScale(1); }}>
                <Text style={styles.removeLogo}>Remove logo</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Company Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Company Information</Text>

          <Text style={styles.label}>Company Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ABC Construction LLC"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 123 Main Street"
            placeholderTextColor="#999"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.row}>
            <View style={styles.rowCol2}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Miami"
                placeholderTextColor="#999"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={styles.rowCol1}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="FL"
                placeholderTextColor="#999"
                value={state}
                onChangeText={setState}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
            <View style={styles.rowCol1}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput
                style={styles.input}
                placeholder="33101"
                placeholderTextColor="#999"
                value={zip}
                onChangeText={setZip}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., (305) 555-1234"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., info@abcconstruction.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., www.abcconstruction.com"
            placeholderTextColor="#999"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
          />
        </View>

        {/* License */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>License & Registration</Text>

          <Text style={styles.label}>License Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., CBC1234567"
            placeholderTextColor="#999"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>

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

  logoSection: { alignItems: 'center', marginBottom: 20 },
  logoContainer: {
    width: 120, height: 120, borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed',
  },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0',
  },
  logoPlaceholderIcon: { fontSize: 40, marginBottom: 4 },
  logoPlaceholderText: { fontSize: 12, color: '#999' },

  logoControls: { alignItems: 'center', marginTop: 10 },
  scaleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  scaleButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a73e8',
    alignItems: 'center', justifyContent: 'center',
  },
  scaleButtonText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  scaleLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginHorizontal: 16, minWidth: 45, textAlign: 'center' },
  removeLogo: { fontSize: 14, color: '#d32f2f', marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },

  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#f8f9fa', borderRadius: 10, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', color: '#333',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowCol2: { flex: 2, marginRight: 8 },
  rowCol1: { flex: 1, marginLeft: 4 },

  saveButton: {
    backgroundColor: '#1a73e8', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
