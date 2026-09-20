import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

export interface LedgerSummaryCardProps {
  currentBalance?: number;
  currentOutstanding?: number;
  totalInvoiced?: number;
  paymentsReceived?: number;
  advanceBalance?: number;
  overdueAmount?: number;
  totalGave?: number;
  totalGot?: number;
  partyName?: string;
  debitLabel?: string;
  creditLabel?: string;
  perspective?: 'ADMIN' | 'VENDOR';
}

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const LedgerSummaryCard: React.FC<LedgerSummaryCardProps> = ({
  currentBalance,
  currentOutstanding: explicitOutstanding,
  totalInvoiced,
  paymentsReceived,
  advanceBalance: explicitAdvance,
  overdueAmount = 0,
  totalGave = 0,
  totalGot = 0,
  partyName,
  debitLabel = 'Invoiced',
  creditLabel = 'Collected',
  perspective = 'ADMIN',
}) => {
  const invoiced = totalInvoiced !== undefined ? totalInvoiced : totalGave;
  const collected = paymentsReceived !== undefined ? paymentsReceived : totalGot;

  const rawBalance = currentBalance !== undefined ? currentBalance : invoiced - collected;
  const outstanding =
    explicitOutstanding !== undefined
      ? explicitOutstanding
      : rawBalance > 0
      ? rawBalance
      : 0;
  const advance =
    explicitAdvance !== undefined
      ? explicitAdvance
      : rawBalance < 0
      ? Math.abs(rawBalance)
      : 0;

  const isDue = outstanding > 0;
  const isAdvance = advance > 0 && outstanding === 0;

  let heroLabel = 'ACCOUNT BALANCE';
  let heroAmount = '₹0.00';
  let statusText = 'Settled';
  let statusTextColor = colors.textSecondary;
  let statusBgColor = colors.surfaceSubtle;
  let amountColor = colors.textPrimary;

  if (isDue) {
    heroLabel = 'OUTSTANDING DUE';
    heroAmount = `₹${fmt(outstanding)}`;
    statusText = 'Pending Due';
    statusTextColor = '#B45309';
    statusBgColor = '#FEF3C7';
    amountColor = colors.textPrimary;
  } else if (isAdvance) {
    heroLabel = 'ADVANCE BALANCE';
    heroAmount = `₹${fmt(advance)}`;
    statusText = 'In Advance';
    statusTextColor = colors.brandGreen;
    statusBgColor = colors.brandGreenLight;
    amountColor = colors.brandGreen;
  }

  return (
    <View style={styles.card}>
      {/* Top row: Label & Status */}
      <View style={styles.topRow}>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
        <View style={[styles.statusChip, { backgroundColor: statusBgColor }]}>
          <Text style={[styles.statusChipText, { color: statusTextColor }]}>
            {statusText}
          </Text>
        </View>
      </View>

      {/* Main Hero Amount */}
      <Text style={[styles.heroAmount, { color: amountColor }]}>{heroAmount}</Text>

      {/* Footer Metrics Row */}
      {(invoiced > 0 || collected > 0) && (
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{debitLabel}</Text>
            <Text style={styles.metricValue}>₹{fmt(invoiced)}</Text>
          </View>

          <View style={styles.metricDot} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{creditLabel}</Text>
            <Text style={[styles.metricValue, { color: colors.brandGreen }]}>
              ₹{fmt(collected)}
            </Text>
          </View>

          {overdueAmount > 0 && (
            <>
              <View style={styles.metricDot} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Overdue</Text>
                <Text style={[styles.metricValue, { color: colors.debit }]}>
                  ₹{fmt(overdueAmount)}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusFull,
  },
  statusChipText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  heroAmount: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  metricValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 11,
  },
});
