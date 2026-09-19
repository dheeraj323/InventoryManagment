import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

interface ReconciliationCardProps {
  expected: number;
  handedOver: number;
}

export const ReconciliationCard: React.FC<ReconciliationCardProps> = ({ expected, handedOver }) => {
  const variance = handedOver - expected;
  const isBalanced = variance === 0;
  const isExcess = variance > 0;
  const isShortage = variance < 0;

  const iconName = isBalanced ? 'checkmark-circle' : isExcess ? 'alert-circle' : 'warning';
  const themeColor = isBalanced ? colors.brandGreen : isExcess ? '#D97706' : colors.danger;
  const containerStyle = isBalanced
    ? styles.matchBanner
    : isExcess
    ? styles.excessBanner
    : styles.shortageBanner;

  return (
    <View style={[styles.banner, containerStyle]}>
      <Ionicons name={iconName} size={22} color={themeColor} style={styles.icon} />
      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: themeColor }]}>
          {isBalanced
            ? 'Cash Balanced (₹0.00)'
            : isExcess
            ? `Excess Cash: +₹${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            : `Shortage: -₹${Math.abs(variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        </Text>
        <Text style={styles.subtitle}>
          {isBalanced
            ? 'Physical cash matches expected collections exactly.'
            : isExcess
            ? 'Handed over cash is higher than expected collections. Requires admin review.'
            : 'Handed over cash is less than expected collections. Requires explanation in notes.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginVertical: spacing.md,
    borderWidth: 1,
  },
  matchBanner: {
    backgroundColor: colors.brandGreenLight,
    borderColor: '#A7F3D0',
  },
  excessBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  shortageBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  icon: {
    marginTop: 1,
  },
  textGroup: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
