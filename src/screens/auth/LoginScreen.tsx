import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { ADMIN_CREDENTIALS } from '../../services/authService';
import { colors, typography, spacing } from '../../theme';

type AuthMode = 'LOGIN' | 'REGISTER';
type RegisterRole = 'VENDOR' | 'STAFF';

export const LoginScreen: React.FC = () => {
  const {
    loginWithEmail,
    registerVendor,
    registerStaff,
    authError,
    clearError,
  } = useAuthStore();

  const [authMode, setAuthMode] = useState<AuthMode>('LOGIN');
  const [registerRole, setRegisterRole] = useState<RegisterRole>('VENDOR');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick fill Admin credentials
  const handleFillAdmin = () => {
    setEmail(ADMIN_CREDENTIALS.email);
    setPassword(ADMIN_CREDENTIALS.password);
    clearError();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    clearError();
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password || !fullName.trim() || !phone.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required registration fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (registerRole === 'VENDOR' && !shopName.trim()) {
      Alert.alert('Missing Shop Name', 'Please provide the name of your shop or business.');
      return;
    }

    setSubmitting(true);
    clearError();
    try {
      if (registerRole === 'VENDOR') {
        await registerVendor({
          name: fullName.trim(),
          email: email.trim(),
          pass: password,
          phone: phone.trim(),
          shopName: shopName.trim(),
          area: area.trim() || 'Central',
          address: address.trim() || '',
        });
      } else {
        await registerStaff({
          name: fullName.trim(),
          email: email.trim(),
          pass: password,
          phone: phone.trim(),
          preferredArea: area.trim() || 'Central Zone',
        });
      }
    } catch (err: any) {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand */}
          <View style={styles.brandHeader}>
            <View style={styles.logoCircle}>
              <Ionicons name="cube" size={36} color={colors.textInverse} />
            </View>
            <Text style={styles.brandTitle}>Distributor OS</Text>
            <Text style={styles.brandSubtitle}>
              Wholesale Ledger, Inventory & Order Management
            </Text>
          </View>

          {/* Mode Switch Tabs (Sign In / Create Account) */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, authMode === 'LOGIN' && styles.tabButtonActive]}
              onPress={() => {
                setAuthMode('LOGIN');
                clearError();
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  authMode === 'LOGIN' && styles.tabButtonTextActive,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, authMode === 'REGISTER' && styles.tabButtonActive]}
              onPress={() => {
                setAuthMode('REGISTER');
                clearError();
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  authMode === 'REGISTER' && styles.tabButtonTextActive,
                ]}
              >
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main Form Card */}
          <View style={styles.card}>
            {authError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorBannerText}>{authError}</Text>
              </View>
            )}

            {authMode === 'LOGIN' ? (
              // ── SIGN IN FORM ──────────────────────────────────────────────
              <View>
                <Input
                  label="Email Address"
                  placeholder="name@business.com"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (authError) clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  }
                />

                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (authError) clearError();
                  }}
                  secureTextEntry={!showPassword}
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  }
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  }
                />

                <Button
                  title={submitting ? 'Signing In...' : 'Sign In to Account'}
                  onPress={handleLogin}
                  disabled={submitting}
                  style={styles.mainBtn}
                />

                {/* Quick Admin Helper */}
                <TouchableOpacity
                  style={styles.adminQuickFill}
                  onPress={handleFillAdmin}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.accent} />
                  <Text style={styles.adminQuickFillText}>
                    Fill Admin Credentials (dheerajkalyan2004@gmail.com)
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // ── REGISTRATION FORM ─────────────────────────────────────────
              <View>
                {/* Role Selector: Vendor vs Staff */}
                <Text style={styles.subHeading}>I am registering as:</Text>
                <View style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.rolePickerChip,
                      registerRole === 'VENDOR' && styles.rolePickerChipActive,
                    ]}
                    onPress={() => setRegisterRole('VENDOR')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="storefront"
                      size={16}
                      color={registerRole === 'VENDOR' ? colors.textInverse : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.rolePickerText,
                        registerRole === 'VENDOR' && styles.rolePickerTextActive,
                      ]}
                    >
                      Vendor / Retailer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.rolePickerChip,
                      registerRole === 'STAFF' && styles.rolePickerChipActive,
                    ]}
                    onPress={() => setRegisterRole('STAFF')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="bicycle"
                      size={16}
                      color={registerRole === 'STAFF' ? colors.textInverse : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.rolePickerText,
                        registerRole === 'STAFF' && styles.rolePickerTextActive,
                      ]}
                    >
                      Staff Member
                    </Text>
                  </TouchableOpacity>
                </View>

                {registerRole === 'STAFF' && (
                  <View style={styles.verificationNoticeBox}>
                    <Ionicons name="information-circle" size={16} color={colors.accent} />
                    <Text style={styles.verificationNoticeText}>
                      Staff accounts are verified and approved by the Distributor Administrator before access is granted.
                    </Text>
                  </View>
                )}

                {/* Common fields */}
                <Input
                  label="Full Name *"
                  placeholder="e.g. Rajesh Sharma"
                  value={fullName}
                  onChangeText={setFullName}
                  leftIcon={
                    <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                  }
                />

                {registerRole === 'VENDOR' && (
                  <Input
                    label="Shop / Business Name *"
                    placeholder="e.g. Apex Supermarket"
                    value={shopName}
                    onChangeText={setShopName}
                    leftIcon={
                      <Ionicons name="storefront-outline" size={18} color={colors.textMuted} />
                    }
                  />
                )}

                <Input
                  label="Email Address *"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  }
                />

                <Input
                  label="Mobile Phone *"
                  placeholder="9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  leftIcon={
                    <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                  }
                />

                <Input
                  label={registerRole === 'VENDOR' ? 'Shop Area / Locality' : 'Preferred Delivery Zone'}
                  placeholder="e.g. North Zone, Market Road"
                  value={area}
                  onChangeText={setArea}
                  leftIcon={
                    <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  }
                />

                <Input
                  label="Password (Min 6 Characters) *"
                  placeholder="Create a strong password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  }
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  }
                />

                <Button
                  title={
                    submitting
                      ? 'Creating Account...'
                      : registerRole === 'VENDOR'
                      ? 'Register & Open Store'
                      : 'Submit Staff Registration'
                  }
                  onPress={handleRegister}
                  disabled={submitting}
                  style={styles.mainBtn}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandTitle: {
    ...typography.h1,
    color: colors.textInverse,
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: spacing.borderRadiusMd,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.borderRadiusSm,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
  },
  tabButtonText: {
    ...typography.captionBold,
    color: colors.textInverse,
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.debitLight,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: {
    ...typography.captionBold,
    color: colors.danger,
    flex: 1,
  },
  subHeading: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rolePickerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 6,
  },
  rolePickerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rolePickerText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  rolePickerTextActive: {
    color: colors.textInverse,
  },
  verificationNoticeBox: {
    flexDirection: 'row',
    backgroundColor: colors.accentLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginBottom: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  verificationNoticeText: {
    ...typography.caption,
    color: colors.accent,
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  mainBtn: {
    marginTop: spacing.sm,
  },
  adminQuickFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  adminQuickFillText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  quickAccessBox: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  quickAccessTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  quickAccessButtons: {
    width: '100%',
  },
  quickBtn: {
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
