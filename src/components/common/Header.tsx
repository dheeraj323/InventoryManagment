import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';
import { UserRole } from '../../types';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  activeRole?: UserRole;
  onRoleSwitch?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  activeRole,
  onRoleSwitch,
  rightAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightRow}>
        {activeRole && (
          <View
            style={[
              styles.roleBadge,
              activeRole === 'ADMIN'
                ? styles.roleAdmin
                : activeRole === 'STAFF'
                ? styles.roleStaff
                : styles.roleVendor,
            ]}
          >
            <Ionicons
              name={
                activeRole === 'ADMIN'
                  ? 'shield-checkmark'
                  : activeRole === 'STAFF'
                  ? 'bicycle'
                  : 'storefront'
              }
              size={12}
              color={colors.textInverse}
            />
            <Text style={styles.roleText}>{activeRole}</Text>
          </View>
        )}
        {rightAction}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: 4,
    marginLeft: -2,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  roleAdmin: {
    backgroundColor: colors.primary,
  },
  roleStaff: {
    backgroundColor: colors.accent,
  },
  roleVendor: {
    backgroundColor: colors.brandGreen,
  },
  roleText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
