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
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
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
        {activeRole && onRoleSwitch && (
          <TouchableOpacity
            style={[
              styles.roleBadge,
              activeRole === 'ADMIN'
                ? styles.roleAdmin
                : activeRole === 'STAFF'
                ? styles.roleStaff
                : styles.roleVendor,
            ]}
            onPress={onRoleSwitch}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle-outline" size={14} color={colors.textInverse} />
            <Text style={styles.roleText}>{activeRole}</Text>
          </TouchableOpacity>
        )}
        {rightAction}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: 4,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
    marginRight: spacing.xs,
  },
  roleAdmin: {
    backgroundColor: colors.primary,
  },
  roleStaff: {
    backgroundColor: colors.accent,
  },
  roleVendor: {
    backgroundColor: colors.credit,
  },
  roleText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 10,
    marginLeft: 4,
  },
});
