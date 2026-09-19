import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

export interface LedgerSummaryCardProps {
  currentBalance: number; // Positive = Receivable (Vendor owes), Negative = Advance (Prepaid)
  totalGave?: number;
  totalGot?: number;
  partyName?: string;
  debitLabel?: string; // Defaults to 'Total Billed'
  creditLabel?: string; // Defaults to 'Total Paid'
}

export const LedgerSummaryCard: React.FC<LedgerSummaryCardProps> = ({
  currentBalance,
  totalGave = 0,
  totalGot = 0,
  partyName,
  debitLabel = 'Total Billed',
  creditLabel = 'Total Paid',
}) => {
  const isReceivable = currentBalance >= 0;
  const accentColor = isReceivable ? colors.debit : colors.brandGreen;
  const accentBg = isReceivable ? colors.debitLight : colors.brandGreenLight;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      {/* Party name label */}
      {partyName && (
        <Text style={styles.partyName} numberOfLines={1}>
          {partyName}
        </Text>
      )}

      {/* Hero balance row */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>
            {isReceivable ? 'Net Outstanding Due' : 'Settled / Advance'}
          </Text>
          <Text style={[styles.heroAmount, { color: accentColor }]}>
            ₹{Math.abs(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: accentBg }]}>
          <Text style={[styles.statusChipText, { color: accentColor }]}>
            {isReceivable ? 'Pending Due' : 'Paid / Advance'}
          </Text>
        </View>
      </View>

      {/* Divider + stats row — only shown when there's actual data */}
      {(totalGave > 0 || totalGot > 0) && (
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>{debitLabel}</Text>
            <Text style={[styles.statAmount, { color: colors.debit }]}>
              ₹{totalGave.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>{creditLabel}</Text>
            <Text style={[styles.statAmount, { color: colors.brandGreen }]}>
              ₹{totalGot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.xl,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  partyName: {
    ...typography.captionBold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  heroLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 4,
  },
  heroAmount: {
    ...typography.hero,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusFull,
  },
  statusChipText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 3,
  },
  statAmount: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
});
