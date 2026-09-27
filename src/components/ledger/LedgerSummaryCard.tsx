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
  advanceBalance,
  totalInvoiced,
  paymentsReceived,
  overdueAmount = 0,
  totalGave = 0,
  totalGot = 0,
  partyName,
  debitLabel,
  creditLabel,
  perspective = 'ADMIN',
}) => {
  const isVendor = perspective === 'VENDOR';
  const resolvedDebitLabel = debitLabel || (isVendor ? 'Total Purchases' : 'Invoiced');
  const resolvedCreditLabel = creditLabel || (isVendor ? 'Total Paid' : 'Collected');

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
    advanceBalance !== undefined && advanceBalance > 0
      ? advanceBalance
      : rawBalance < 0
      ? Math.abs(rawBalance)
      : 0;

  const isDue = outstanding > 0;
  const hasAdvance = !isDue && advance > 0;

  let heroLabel = 'ACCOUNT BALANCE';
  let heroAmount = '₹0.00';
  let statusText = 'Settled';
  let statusTextColor = colors.textSecondary;
  let statusBgColor = colors.surfaceSubtle;
  let amountColor = colors.textPrimary;

  if (isDue) {
    heroLabel = isVendor ? 'TOTAL AMOUNT PAYABLE' : 'OUTSTANDING DUE';
    heroAmount = `₹${fmt(outstanding)}`;
    statusText = isVendor ? 'Payment Due' : 'Pending Due';
    statusTextColor = '#B45309';
    statusBgColor = '#FEF3C7';
    amountColor = isVendor ? colors.brandGreen : colors.debit;
  } else if (hasAdvance) {
    heroLabel = isVendor ? 'ADVANCE BALANCE AVAILABLE' : 'ADVANCE HELD';
    heroAmount = `₹${fmt(advance)}`;
    statusText = 'Advance Paid';
    statusTextColor = '#15803D';
    statusBgColor = '#DCFCE7';
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
            <Text style={styles.metricLabel}>{resolvedDebitLabel}</Text>
            <Text style={styles.metricValue}>₹{fmt(invoiced)}</Text>
          </View>

          <View style={styles.metricDot} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{resolvedCreditLabel}</Text>
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
    fontSize: 10,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    marginHorizontal: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
