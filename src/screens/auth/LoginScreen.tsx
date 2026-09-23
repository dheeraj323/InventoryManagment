import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, typography, spacing } from '../../theme';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';
type RegisterRole = 'VENDOR' | 'STAFF';

export const LoginScreen: React.FC = () => {
  const {
    loginWithEmail,
    registerVendor,
    registerStaff,
    sendPasswordReset,
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
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email address and password.');
      return;
    }

    setSubmitting(true);
    clearError();
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      // Handled by store
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }

    setSubmitting(true);
    clearError();
    try {
      await sendPasswordReset(email.trim());
      setResetSent(true);
      Alert.alert(
        'Reset Email Sent',
        `A password reset link has been sent to ${email.trim()}. Please check your inbox and follow the instructions.`,
        [
          {
            text: 'Back to Sign In',
            onPress: () => {
              setAuthMode('LOGIN');
              setResetSent(false);
            },
          },
        ]
      );
    } catch (err: any) {
      // Handled by store
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password || !fullName.trim() || !phone.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters long.');
      return;
    }

    if (registerRole === 'VENDOR' && !shopName.trim()) {
      Alert.alert('Missing Shop Name', 'Please enter your shop or business name.');
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
        });
      }
    } catch (err: any) {
      // Handled by store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand */}
          <View style={styles.header}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            {authMode === 'FORGOT_PASSWORD' && (
              <Text style={styles.appTitle}>Reset Password</Text>
            )}
            <Text style={styles.appSubtitle}>
              {authMode === 'LOGIN'
                ? 'Sign in to access your inventory and orders'
                : authMode === 'FORGOT_PASSWORD'
                ? 'Enter your registered email to receive a password reset link'
                : 'Create a new account to get started'}
            </Text>
          </View>

          {/* Mode Switcher Pills (Hidden during Forgot Password flow) */}
          {authMode !== 'FORGOT_PASSWORD' ? (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, authMode === 'LOGIN' && styles.tabItemActive]}
                onPress={() => {
                  setAuthMode('LOGIN');
                  clearError();
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    authMode === 'LOGIN' && styles.tabTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, authMode === 'REGISTER' && styles.tabItemActive]}
                onPress={() => {
                  setAuthMode('REGISTER');
                  clearError();
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    authMode === 'REGISTER' && styles.tabTextActive,
                  ]}
                >
                  Register
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Form Card */}
          <View style={styles.formContainer}>
            {authError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            )}

            {authMode === 'FORGOT_PASSWORD' ? (
              // ── FORGOT PASSWORD FORM ───────────────────────────────────────
              <View>
                <Input
                  label="Registered Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (authError) clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={18} color="#64748B" />
                  }
                />

                <Button
                  title={submitting ? 'Sending Link...' : 'Send Password Reset Link'}
                  onPress={handleForgotPassword}
                  disabled={submitting}
                  size="lg"
                  style={styles.submitBtn}
                />

                <View style={styles.switchModeFooter}>
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMode('LOGIN');
                      clearError();
                    }}
                    style={styles.backToLoginBtn}
                  >
                    <Ionicons name="arrow-back" size={16} color="#2563EB" />
                    <Text style={styles.switchModeLink}> Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : authMode === 'LOGIN' ? (
              // ── SIGN IN FORM ──────────────────────────────────────────────
              <View>
                <Input
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (authError) clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons name="mail-outline" size={18} color="#64748B" />
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
                    <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                  }
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  }
                />

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={styles.forgotPasswordWrap}
                  onPress={() => {
                    setAuthMode('FORGOT_PASSWORD');
                    clearError();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <Button
                  title={submitting ? 'Signing in...' : 'Sign In'}
                  onPress={handleLogin}
                  disabled={submitting}
                  size="lg"
                  style={styles.submitBtn}
                />

                <View style={styles.switchModeFooter}>
                  <Text style={styles.switchModePrompt}>Don't have an account?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMode('REGISTER');
                      clearError();
                    }}
                  >
                    <Text style={styles.switchModeLink}> Register here</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // ── REGISTRATION FORM ─────────────────────────────────────────
              <View>
                <Text style={styles.rolePickerLabel}>I AM REGISTERING AS</Text>
                <View style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleChip,
                      registerRole === 'VENDOR' && styles.roleChipActive,
                    ]}
                    onPress={() => setRegisterRole('VENDOR')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="storefront-outline"
                      size={16}
                      color={registerRole === 'VENDOR' ? '#2563EB' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        registerRole === 'VENDOR' && styles.roleChipTextActive,
                      ]}
                    >
                      Vendor / Retailer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleChip,
                      registerRole === 'STAFF' && styles.roleChipActive,
                    ]}
                    onPress={() => setRegisterRole('STAFF')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={registerRole === 'STAFF' ? '#2563EB' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        registerRole === 'STAFF' && styles.roleChipTextActive,
                      ]}
                    >
                      Delivery Staff
                    </Text>
                  </TouchableOpacity>
                </View>

                {registerRole === 'STAFF' && (
                  <View style={styles.staffInfoBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                    <Text style={styles.staffInfoText}>
                      Staff accounts are reviewed by the administrator before activation.
                    </Text>
                  </View>
                )}

                <Input
                  label="Full Name *"
                  value={fullName}
                  onChangeText={setFullName}
                />

                {registerRole === 'VENDOR' && (
                  <Input
                    label="Shop / Business Name *"
                    value={shopName}
                    onChangeText={setShopName}
                  />
                )}

                <Input
                  label="Email Address *"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Phone Number *"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  prefix="+91"
                />

                {registerRole === 'VENDOR' && (
                  <>
                    <Input
                      label="Area / Locality"
                      value={area}
                      onChangeText={setArea}
                    />
                    <Input
                      label="Shop Address (Optional)"
                      value={address}
                      onChangeText={setAddress}
                    />
                  </>
                )}

                <Input
                  label="Password (Min 6 Characters) *"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  }
                />

                <Button
                  title={
                    submitting
                      ? 'Creating Account...'
                      : registerRole === 'VENDOR'
                      ? 'Create Vendor Account'
                      : 'Submit Staff Application'
                  }
                  onPress={handleRegister}
                  disabled={submitting}
                  size="lg"
                  style={styles.submitBtn}
                />

                <View style={styles.switchModeFooter}>
                  <Text style={styles.switchModePrompt}>Already have an account?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAuthMode('LOGIN');
                      clearError();
                    }}
                  >
                    <Text style={styles.switchModeLink}> Sign in</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 280,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: spacing.lg,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: spacing.sm + 2,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  rolePickerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  roleChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roleChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  staffInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    padding: 10,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: 6,
  },
  staffInfoText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 15,
  },
  submitBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  forgotPasswordWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  switchModeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  switchModePrompt: {
    fontSize: 13,
    color: '#64748B',
  },
  switchModeLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
});

