import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Building2, Camera, Minus, Plus, Trash2, LogOut,
  Phone, Mail, Globe, FileCheck, MapPin,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { handleError } from '../utils/errorHandler';
import { storageService } from '../services/storage';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { ScreenHeader, Card, Input, Button, IconButton } from '../components/ui';

interface CompanyProfileScreenProps {
  navigation: any;
}

export default function CompanyProfileScreen({ navigation }: CompanyProfileScreenProps) {
  const { companyProfile, updateCompanyProfile } = useApp();
  const { signOut, user } = useAuth();
  const [loading, setLoading] = useState(false);

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

  // Sync from database when companyProfile loads (handles sign-up race condition)
  useEffect(() => {
    if (companyProfile.name && !name) {
      setName(companyProfile.name);
      setAddress(companyProfile.address);
      setCity(companyProfile.city);
      setState(companyProfile.state);
      setZip(companyProfile.zip);
      setPhone(companyProfile.phone);
      setEmail(companyProfile.email);
      setWebsite(companyProfile.website);
      setLicenseNumber(companyProfile.licenseNumber);
      setLogoUri(companyProfile.logoUri);
      setLogoScale(companyProfile.logoScale || 1);
    }
  }, [companyProfile]);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets && user) {
      setLogoUri(result.assets[0].uri);
      setLogoScale(1);
    }
  };

  const adjustScale = (delta: number) => {
    setLogoScale(prev => Math.max(0.5, Math.min(2.0, Math.round((prev + delta) * 10) / 10)));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your company name.'); return; }
    if (!user) { Alert.alert('Error', 'User not authenticated'); return; }

    setLoading(true);
    try {
      let finalLogoUri = logoUri;
      if (logoUri && logoUri.startsWith('file://')) {
        try {
          finalLogoUri = await storageService.uploadLogo(user.id, logoUri);
        } catch (uploadError) {
          console.error('Logo upload failed:', uploadError);
          Alert.alert('Warning', 'Logo upload failed, but profile will be saved without logo.');
          finalLogoUri = '';
        }
      }
      await updateCompanyProfile({
        name: name.trim(), address: address.trim(), city: city.trim(),
        state: state.trim(), zip: zip.trim(), phone: phone.trim(),
        email: email.trim(), website: website.trim(), licenseNumber: licenseNumber.trim(),
        logoUri: finalLogoUri, logoScale,
      });
      if (finalLogoUri !== logoUri) setLogoUri(finalLogoUri);
      Alert.alert('Saved', 'Company profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Company Profile" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoSection}>
          <TouchableOpacity style={styles.logoContainer} onPress={pickLogo} activeOpacity={0.7}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={[styles.logoImage, { transform: [{ scale: logoScale }] }]} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Camera size={28} color={colors.textTertiary} />
                <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
              </View>
            )}
          </TouchableOpacity>
          {logoUri ? (
            <View style={styles.logoControls}>
              <View style={styles.scaleRow}>
                <IconButton icon={<Minus size={16} color={colors.textOnPrimary} />}
                  onPress={() => adjustScale(-0.1)} size={32}
                  style={{ backgroundColor: colors.primary, borderRadius: 16 }} />
                <Text style={styles.scaleLabel}>{Math.round(logoScale * 100)}%</Text>
                <IconButton icon={<Plus size={16} color={colors.textOnPrimary} />}
                  onPress={() => adjustScale(0.1)} size={32}
                  style={{ backgroundColor: colors.primary, borderRadius: 16 }} />
              </View>
              <TouchableOpacity onPress={() => { setLogoUri(''); setLogoScale(1); }}>
                <Text style={styles.removeLogo}>Remove logo</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Company Info */}
        <Card variant="default" style={styles.card}>
          <Text style={styles.cardTitle}>Company Information</Text>
          <Input label="Company Name *" placeholder="e.g., ABC Construction LLC" value={name}
            onChangeText={setName} autoCapitalize="words"
            iconLeft={<Building2 size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
          <Input label="Address" placeholder="e.g., 123 Main Street" value={address}
            onChangeText={setAddress}
            iconLeft={<MapPin size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
          <View style={styles.row}>
            <Input label="City" placeholder="Miami" value={city}
              onChangeText={setCity} containerStyle={styles.flex2} />
            <Input label="State" placeholder="FL" value={state}
              onChangeText={setState} autoCapitalize="characters" maxLength={2}
              containerStyle={styles.flex1} />
            <Input label="ZIP" placeholder="33101" value={zip}
              onChangeText={setZip} keyboardType="numeric" maxLength={5}
              containerStyle={styles.flex1} />
          </View>
        </Card>

        {/* Contact */}
        <Card variant="default" style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <Input label="Phone" placeholder="(305) 555-1234" value={phone}
            onChangeText={setPhone} keyboardType="phone-pad"
            iconLeft={<Phone size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
          <Input label="Email" placeholder="info@abcconstruction.com" value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
            iconLeft={<Mail size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
          <Input label="Website" placeholder="www.abcconstruction.com" value={website}
            onChangeText={setWebsite} autoCapitalize="none"
            iconLeft={<Globe size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
        </Card>

        {/* License */}
        <Card variant="default" style={styles.card}>
          <Text style={styles.cardTitle}>License & Registration</Text>
          <Input label="License Number" placeholder="e.g., CBC1234567" value={licenseNumber}
            onChangeText={setLicenseNumber} autoCapitalize="characters"
            iconLeft={<FileCheck size={18} color={colors.textTertiary} />}
            containerStyle={styles.inputSpacing} />
        </Card>

        <Button title="Save Profile" onPress={handleSave} loading={loading}
          fullWidth size="lg" style={styles.saveBtn} />

        {/* Account */}
        <Card variant="outlined" style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          {user && (
            <View style={styles.accountInfo}>
              <Text style={styles.accountLabel}>Email:</Text>
              <Text style={styles.accountValue}>{user.email}</Text>
            </View>
          )}
          <Button title="Logout" onPress={handleLogout} variant="destructive" fullWidth
            icon={<LogOut size={18} color={colors.textOnPrimary} />} />
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { flex: 1, padding: spacing.lg },
  logoSection: { alignItems: 'center', marginBottom: spacing.xl },
  logoContainer: {
    width: 160, height: 120, borderRadius: radii.xl, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgTertiary,
  },
  logoPlaceholderText: { fontSize: typography.sizes.xs, color: colors.textTertiary, marginTop: spacing.xs },
  logoControls: { alignItems: 'center', marginTop: spacing.md },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  scaleLabel: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
    color: colors.textPrimary, minWidth: 45, textAlign: 'center',
  },
  removeLogo: { fontSize: typography.sizes.sm, color: colors.error, marginTop: spacing.sm },
  card: { marginBottom: spacing.lg },
  cardTitle: {
    fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold,
    color: colors.textPrimary, marginBottom: spacing.md,
  },
  inputSpacing: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex2: { flex: 2 },
  flex1: { flex: 1 },
  saveBtn: { marginBottom: spacing.lg },
  accountInfo: {
    backgroundColor: colors.bgTertiary, borderRadius: radii.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  accountLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  accountValue: { fontSize: typography.sizes.sm, color: colors.textPrimary, fontWeight: typography.weights.medium },
});
