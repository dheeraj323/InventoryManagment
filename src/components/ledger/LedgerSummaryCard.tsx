import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors, typography, spacing } from '../../theme';

export interface LedgerSummaryCardProps {
  currentBalance: number; // Positive = Receivable (You will get), Negative = Advance (You will give)
  totalGave?: number;
  totalGot?: number;
  partyName?: string;
}

export const LedgerSummaryCard: React.FC<LedgerSummaryCardProps> = ({
  currentBalance,
  totalGave = 0,
  totalGot = 0,
  partyName,
}) => {
  const isReceivable = currentBalance >= 0;

  return (
    <Card style={styles.card} outlined elevation="md">
      {partyName && <Text style={styles.partyTitle}>{partyName}</Text>}
      <View style={styles.mainRow}>
        <View>
          <Text style={styles.label}>
            {isReceivable ? "YOU'LL GET (RECEIVABLE)" : "YOU'LL GIVE (PAYABLE)"}
          </Text>
          <Text
            style={[
              styles.netBalance,
              isReceivable ? styles.debitColor : styles.creditColor,
            ]}
          >
            ${Math.abs(currentBalance).toFixed(2)}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            isReceivable ? styles.debitBg : styles.creditBg,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              isReceivable ? styles.debitColor : styles.creditColor,
            ]}
          >
            {isReceivable ? 'Pending Due' : 'Settled / Advance'}
          </Text>
        </View>
      </View>

      {(totalGave > 0 || totalGot > 0) && (
        <View style={styles.dividerRow}>
          <View style={styles.subStat}>
            <Text style={styles.subStatLabel}>Total You Gave (Debit)</Text>
            <Text style={[styles.subStatVal, styles.debitColor]}>
              ${totalGave.toFixed(2)}
            </Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.subStat}>
            <Text style={styles.subStatLabel}>Total You Got (Credit)</Text>
            <Text style={[styles.subStatVal, styles.creditColor]}>
              ${totalGot.toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  partyTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  netBalance: {
    ...typography.currencyLarge,
    color: colors.textInverse,
    marginTop: 2,
  },
  debitColor: {
    color: '#F87171', // Bright Red for Dark Card
  },
  creditColor: {
    color: '#4ADE80', // Bright Green for Dark Card
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusFull,
  },
  debitBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  creditBg: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusPillText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  subStat: {
    flex: 1,
  },
  subStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  subStatVal: {
    ...typography.bodyBold,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: spacing.sm,
  },
});
