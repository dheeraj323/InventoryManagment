import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, typography, spacing } from '../../theme';

export const PendingApprovalScreen: React.FC = () => {
  const { currentUser, refreshCurrentUser, logout } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCheckStatus = async () => {
    setIsRefreshing(true);
    try {
      await refreshCurrentUser();
    } catch (err) {
      Alert.alert('Error', 'Unable to refresh verification status. Please check your internet connection.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isRejected = currentUser?.status === 'REJECTED';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Status Icon */}
        <View
          style={[
            styles.iconCircle,
            isRejected ? styles.iconCircleRejected : styles.iconCirclePending,
          ]}
        >
          <Ionicons
            name={isRejected ? 'alert-circle' : 'hourglass-outline'}
            size={48}
            color={isRejected ? colors.danger : colors.accent}
          />
        </View>

        {/* Title & Description */}
        <Text style={styles.title}>
          {isRejected ? 'Account Request Rejected' : 'Staff Verification Pending'}
        </Text>
        
        <Text style={styles.subtitle}>
          {isRejected
            ? 'Your staff account registration could not be approved by the distributor administrator.'
            : 'Welcome to the team! Your staff account has been registered and is currently awaiting verification and route assignment by the Administrator.'}
        </Text>

        {/* User Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Staff Name</Text>
            <Text style={styles.infoValue}>{currentUser?.name || 'Staff Member'}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{currentUser?.email || '-'}</Text>
          </View>
          {currentUser?.phone ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{currentUser.phone}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                isRejected ? styles.statusBadgeRejected : styles.statusBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isRejected ? styles.statusTextRejected : styles.statusTextPending,
                ]}
              >
                {isRejected ? 'REJECTED' : 'PENDING APPROVAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!isRejected && (
            <Button
              title={isRefreshing ? 'Checking Status...' : 'Check Approval Status'}
              onPress={handleCheckStatus}
              disabled={isRefreshing}
              variant="primary"
              style={styles.refreshBtn}
            />
          )}

          <Button
            title="Log Out & Switch Account"
            onPress={logout}
            variant="outline"
            style={styles.logoutBtn}
          />
        </View>

        <Text style={styles.contactNotice}>
          Need urgent access? Contact your distributor administrator directly at:
          {'\n'}
          <Text style={styles.adminContact}>dheerajkalyan2004@gmail.com</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconCirclePending: {
    backgroundColor: colors.accentLight,
  },
  iconCircleRejected: {
    backgroundColor: colors.debitLight,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  statusBadgePending: {
    backgroundColor: colors.accentLight,
  },
  statusBadgeRejected: {
    backgroundColor: colors.debitLight,
  },
  statusText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  statusTextPending: {
    color: colors.accent,
  },
  statusTextRejected: {
    color: colors.danger,
  },
  actionContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  refreshBtn: {
    marginBottom: spacing.sm,
  },
  logoutBtn: {
    borderColor: colors.border,
  },
  contactNotice: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  adminContact: {
    fontWeight: '700',
    color: colors.primary,
  },
});
