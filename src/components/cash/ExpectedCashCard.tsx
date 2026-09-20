import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

interface ExpectedCashCardProps {
  amount: number;
  date?: string;
  subtitle?: string;
}

export const ExpectedCashCard: React.FC<ExpectedCashCardProps> = ({
  amount,
  date,
  subtitle = "Calculated from today's order collections",
}) => {
  const formattedDate = formatDate(date || new Date());

  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconBadge}>
          <Ionicons name="wallet-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>EXPECTED CASH IN HAND</Text>
          <Text style={styles.subtext}>{subtitle}</Text>
        </View>
        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>

      <Text style={styles.amountText}>
        ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandGreen,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  labelGroup: {
    flex: 1,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  subtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    gap: 4,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  amountText: {
    ...typography.hero,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
});
