import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { GoogleMapsLocationPicker } from '../../components/common/GoogleMapsLocationPicker';
import { colors, spacing } from '../../theme';

export const ProfileScreen: React.FC = () => {
  const { currentUser, activeVendorId, updateProfile, logout, sendPasswordReset } =
    useAuthStore();
  const { getVendorById, updateVendorProfile } = useVendorStore();

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || '';
  const vendor = getVendorById(effectiveVendorId);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || vendor?.name || '');
  const [shopName, setShopName] = useState(
    currentUser?.businessName || vendor?.shopName || ''
  );
  const [phone, setPhone] = useState(currentUser?.phone || vendor?.phone || '');
  const [address, setAddress] = useState(
    currentUser?.address || vendor?.address || ''
  );
  const [locationUrl, setLocationUrl] = useState(
    currentUser?.locationUrl || vendor?.locationUrl || ''
  );
  const [latitude, setLatitude] = useState<number | undefined>(
    currentUser?.latitude !== undefined ? currentUser.latitude : vendor?.latitude
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    currentUser?.longitude !== undefined ? currentUser.longitude : vendor?.longitude
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    text: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    text: '',
    type: 'success',
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, text, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  useEffect(() => {
    setName(currentUser?.name || vendor?.name || '');
    setShopName(currentUser?.businessName || vendor?.shopName || '');
    setPhone(currentUser?.phone || vendor?.phone || '');
    setAddress(currentUser?.address || vendor?.address || '');
    setLocationUrl(currentUser?.locationUrl || vendor?.locationUrl || '');
    setLatitude(currentUser?.latitude !== undefined ? currentUser.latitude : vendor?.latitude);
    setLongitude(currentUser?.longitude !== undefined ? currentUser.longitude : vendor?.longitude);
  }, [currentUser, vendor]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter proprietor / full name.', 'error');
      return;
    }
    if (!shopName.trim()) {
      showToast('Please enter your shop name.', 'error');
      return;
    }

    setSaving(true);
    try {
      // 1. Update user profile document in Auth/Users
      await updateProfile({
        name: name.trim(),
        businessName: shopName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        locationUrl: locationUrl.trim(),
        latitude,
        longitude,
      });

      // 2. Synchronize vendor record in Firestore
      if (effectiveVendorId) {
        await updateVendorProfile(
          effectiveVendorId,
          {
            name: name.trim(),
            shopName: shopName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            locationUrl: locationUrl.trim(),
            latitude,
            longitude,
          },
          name.trim()
        );
      }

      setIsEditing(false);
      showToast('Profile and Google Maps location updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not save profile changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(currentUser?.name || vendor?.name || '');
    setShopName(currentUser?.businessName || vendor?.shopName || '');
    setPhone(currentUser?.phone || vendor?.phone || '');
    setAddress(currentUser?.address || vendor?.address || '');
    setLocationUrl(currentUser?.locationUrl || vendor?.locationUrl || '');
    setLatitude(currentUser?.latitude !== undefined ? currentUser.latitude : vendor?.latitude);
    setLongitude(currentUser?.longitude !== undefined ? currentUser.longitude : vendor?.longitude);
    setIsEditing(false);
  };

  const isPasswordAdminManaged = Boolean(
    currentUser?.passwordManagedByAdmin || vendor?.passwordManagedByAdmin
  );

  const handlePasswordReset = () => {
    if (isPasswordAdminManaged) {
      Alert.alert(
        'Password Managed by Administrator',
        'Your login credentials are created and managed by the administrator. Please contact the administrator to update or change your password.',
        [{ text: 'Got It' }]
      );
      return;
    }

    if (!currentUser?.email) return;
    Alert.alert(
      'Reset Password',
      `Send a password reset link to ${currentUser.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await sendPasswordReset(currentUser.email!);
              showToast(`Reset link sent to ${currentUser.email}`, 'success');
            } catch (err: any) {
              showToast(err.message || 'Failed to send reset email.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const displayShopName =
    currentUser?.businessName || vendor?.shopName || 'My Store';
  const displayProprietorName =
    currentUser?.name || vendor?.name || 'Shop Owner';
  const displayPhone = currentUser?.phone || vendor?.phone || '';
  const displayAddress =
    currentUser?.address || vendor?.address || 'Not specified';

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Profile"
        rightAction={
          !isEditing ? (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={styles.headerEditBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* In-App Toast Notification */}
      {toast.visible && (
        <View
          style={[
            styles.toastContainer,
            toast.type === 'error' ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={toast.type === 'success' ? '#16A34A' : '#DC2626'}
          />
          <Text
            style={[
              styles.toastText,
              toast.type === 'error'
                ? styles.toastErrorText
                : styles.toastSuccessText,
            ]}
          >
            {toast.text}
          </Text>
          <TouchableOpacity
            onPress={() => setToast((prev) => ({ ...prev, visible: false }))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close"
              size={16}
              color={toast.type === 'success' ? '#16A34A' : '#DC2626'}
            />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {displayShopName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{displayShopName}</Text>
            <Text style={styles.userSubtitle}>Proprietor: {displayProprietorName}</Text>
          </View>

          {/* Shop & Personal Details Form */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>SHOP & PERSONAL DETAILS</Text>

            {isEditing ? (
              <View>
                <Input
                  label="Shop / Business Name"
                  value={shopName}
                  onChangeText={setShopName}
                  autoCapitalize="words"
                />

                <Input
                  label="Proprietor / Full Name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <Input
                  label="Email Address"
                  value={currentUser?.email || ''}
                  editable={false}
                />

                <Input
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  prefix="+91"
                />

                <Input
                  label="Shop Address"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />

                <GoogleMapsLocationPicker
                  locationUrl={locationUrl}
                  latitude={latitude}
                  longitude={longitude}
                  address={address}
                  shopName={shopName}
                  editable={true}
                  onChangeLocation={(locData) => {
                    setLocationUrl(locData.locationUrl);
                    setLatitude(locData.latitude);
                    setLongitude(locData.longitude);
                  }}
                />

                <View style={styles.editActionRow}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={handleCancel}
                    disabled={saving}
                    style={styles.cancelBtn}
                  />
                  <Button
                    title={saving ? 'Saving...' : 'Save Changes'}
                    onPress={handleSave}
                    disabled={saving}
                    style={styles.saveBtn}
                  />
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Shop / Business Name</Text>
                  <Text style={styles.infoValue}>{displayShopName}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Proprietor Name</Text>
                  <Text style={styles.infoValue}>{displayProprietorName}</Text>
                </View>

                {Boolean(currentUser?.username || vendor?.username) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Username</Text>
                    <Text style={styles.infoValue}>
                      {currentUser?.username || vendor?.username}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email / Login ID</Text>
                  <Text style={styles.infoValue}>
                    {currentUser?.username
                      ? `${currentUser.username}`
                      : currentUser?.email || 'Not specified'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>
                    {displayPhone ? `+91 ${displayPhone}` : 'Not added'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Shop Address</Text>
                  <Text style={styles.infoValue}>{displayAddress}</Text>
                </View>

                <View style={{ marginTop: spacing.sm }}>
                  <GoogleMapsLocationPicker
                    locationUrl={locationUrl}
                    latitude={latitude}
                    longitude={longitude}
                    address={displayAddress}
                    shopName={displayShopName}
                    editable={false}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Account Actions */}
          {!isEditing && (
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>ACCOUNT</Text>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={handlePasswordReset}
                activeOpacity={0.7}
              >
                <Ionicons name="key-outline" size={18} color="#64748B" />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.menuText}>Change Password</Text>
                  {isPasswordAdminManaged && (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      Managed by Administrator
                    </Text>
                  )}
                </View>
                {isPasswordAdminManaged ? (
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, { borderBottomWidth: 0 }]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={colors.danger}
                />
                <Text style={[styles.menuText, { color: colors.danger }]}>
                  Log Out
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  headerEditBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  toastSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  toastSuccessText: {
    color: '#166534',
  },
  toastErrorText: {
    color: '#991B1B',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  userSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  editActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
});
