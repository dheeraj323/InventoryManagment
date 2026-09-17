import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface StatusTrackerProps {
  status: OrderStatus;
}

const STEPS = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'OUT_FOR_DELIVERY', label: 'On Way' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export const StatusTracker: React.FC<StatusTrackerProps> = ({ status }) => {
  const getStepIndex = (st: OrderStatus) => {
    switch (st) {
      case 'PENDING':
        return 0;
      case 'APPROVED':
        return 1;
      case 'OUT_FOR_DELIVERY':
        return 2;
      case 'DELIVERED':
      case 'PARTIALLY_DELIVERED':
        return 3;
      case 'CANCELLED':
        return -1;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(status);
  const isCancelled = status === 'CANCELLED';

  if (isCancelled) {
    return (
      <View style={styles.cancelledBanner}>
        <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
        <Text style={styles.cancelledText}>This order was cancelled.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {STEPS.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    isCompleted ? styles.circleCompleted : styles.circlePending,
                    isCurrent ? styles.circleCurrent : null,
                  ]}
                >
                  <Ionicons
                    name={isCompleted ? 'checkmark' : 'ellipse'}
                    size={12}
                    color={isCompleted ? colors.textInverse : colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted ? styles.stepLabelActive : null,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {idx < STEPS.length - 1 && (
                <View
                  style={[
                    styles.line,
                    idx < currentIndex ? styles.lineCompleted : styles.linePending,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    zIndex: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  circleCompleted: {
    backgroundColor: colors.success,
  },
  circleCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  circlePending: {
    backgroundColor: colors.surfaceSubtle,
  },
  stepLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepLabelActive: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  line: {
    flex: 1,
    height: 2,
    marginTop: -16,
    marginHorizontal: spacing.xs,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  linePending: {
    backgroundColor: colors.border,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
  },
  cancelledText: {
    ...typography.bodyBold,
    color: colors.statusCancelledText,
    marginLeft: spacing.sm,
  },
});
