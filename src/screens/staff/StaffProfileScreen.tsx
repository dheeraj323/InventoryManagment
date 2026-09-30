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
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { colors, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

export const StaffProfileScreen: React.FC = () => {
  const { currentUser, updateProfile, logout, sendPasswordReset } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
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
    if (currentUser) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      setIsEditing(false);
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast(getFriendlyErrorMessage(err, 'Could not save profile changes.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(currentUser?.name || '');
    setPhone(currentUser?.phone || '');
    setIsEditing(false);
  };

  const handlePasswordReset = () => {
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
              showToast(getFriendlyErrorMessage(err, 'Failed to send reset email.'), 'error');
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

  const displayName = currentUser?.name || 'Staff Member';
  const displayPhone = currentUser?.phone || '';
  const displayEmail = currentUser?.email || 'Not specified';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userSubtitle}>Field & Delivery Staff</Text>
          </View>

          {/* Personal Details Form */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>PERSONAL DETAILS</Text>

            {isEditing ? (
              <View>
                <Input
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <Input
                  label="Email Address"
                  value={displayEmail}
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
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{displayName}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{displayEmail}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>
                    {displayPhone ? `+91 ${displayPhone}` : 'Not added'}
                  </Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Account Status</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>ACTIVE</Text>
                  </View>
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
                <Text style={styles.menuText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
  statusBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgeText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
