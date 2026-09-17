import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, typography, spacing } from '../../theme';

export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  fullScreen = false,
}) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.inlineMessage}>{message}</Text>
    </View>
  );
};

export const SkeletonRow: React.FC = () => {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLineShort} />
      <View style={styles.skeletonLineLong} />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  inline: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  skeletonCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.lg,
    marginBottom: spacing.md,
    height: 72,
    justifyContent: 'center',
  },
  skeletonLineShort: {
    width: '40%',
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineLong: {
    width: '80%',
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 4,
  },
});
