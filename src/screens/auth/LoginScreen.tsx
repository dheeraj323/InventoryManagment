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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const LoginScreen: React.FC = () => {
  const { loginAsRole } = useAuthStore();
  const [phone, setPhone] = useState('9988776655');
  const [otp, setOtp] = useState('1234');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [selectedRole, setSelectedRole] = useState<UserRole>('VENDOR');

  const handleSendOtp = () => {
    if (phone.length >= 10) {
      setStep('OTP');
    }
  };

  const handleVerifyOtp = () => {
    loginAsRole(selectedRole);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.brandHeader}>
            <View style={styles.logoCircle}>
              <Ionicons name="cube" size={36} color={colors.textInverse} />
            </View>
            <Text style={styles.brandTitle}>Distributor OS</Text>
            <Text style={styles.brandSubtitle}>
              Wholesale Ledger, Inventory & Order Management
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.roleHeaderLabel}>Select Demo Role to Login:</Text>
            <View style={styles.roleToggleRow}>
              {(['ADMIN', 'STAFF', 'VENDOR'] as UserRole[]).map((role) => {
                const isActive = selectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      isActive ? styles.roleChipActive : null,
                    ]}
                    onPress={() => setSelectedRole(role)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        role === 'ADMIN'
                          ? 'shield-checkmark'
                          : role === 'STAFF'
                          ? 'bicycle'
                          : 'storefront'
                      }
                      size={14}
                      color={isActive ? colors.textInverse : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        isActive ? styles.roleChipTextActive : null,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {step === 'PHONE' ? (
              <View style={styles.formSection}>
                <Input
                  label="Mobile Number"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  prefix="+91"
                  leftIcon={
                    <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                  }
                />
                <Button
                  title="Send Verification Code"
                  onPress={handleSendOtp}
                  style={styles.mainBtn}
                />
              </View>
            ) : (
              <View style={styles.formSection}>
                <Text style={styles.otpNotice}>
                  Verification code sent to +91 {phone} (Use 1234 for demo)
                </Text>
                <Input
                  label="Enter 4-Digit OTP"
                  placeholder="1 2 3 4"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  maxLength={4}
                  style={styles.otpInput}
                />
                <Button
                  title={`Login as ${selectedRole}`}
                  onPress={handleVerifyOtp}
                  style={styles.mainBtn}
                />
                <TouchableOpacity
                  onPress={() => setStep('PHONE')}
                  style={styles.changePhoneBtn}
                >
                  <Text style={styles.changePhoneText}>Change phone number</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.quickAccessBox}>
            <Text style={styles.quickAccessTitle}>Quick One-Tap Role Preview:</Text>
            <View style={styles.quickAccessButtons}>
              <Button
                title="Login as Vendor"
                onPress={() => loginAsRole('VENDOR')}
                variant="outline"
                size="sm"
                style={styles.quickBtn}
              />
              <Button
                title="Login as Staff"
                onPress={() => loginAsRole('STAFF')}
                variant="outline"
                size="sm"
                style={styles.quickBtn}
              />
              <Button
                title="Login as Admin"
                onPress={() => loginAsRole('ADMIN')}
                variant="secondary"
                size="sm"
                style={styles.quickBtn}
              />
            </View>
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
    marginBottom: spacing.xxl,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.xl,
  },
  roleHeaderLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  roleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginLeft: 4,
    fontSize: 11,
  },
  roleChipTextActive: {
    color: colors.textInverse,
  },
  formSection: {
    marginTop: spacing.xs,
  },
  otpNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  otpInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  mainBtn: {
    marginTop: spacing.sm,
  },
  changePhoneBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  changePhoneText: {
    ...typography.captionBold,
    color: colors.accent,
  },
  quickAccessBox: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  quickAccessTitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
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
