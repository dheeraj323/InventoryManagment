import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { colors, typography, spacing } from '../../theme';

interface BillSummaryCardProps {
  originalTotal: number;
  deliveredSubtotal: number;
  tax: number;
  payableTotal: number;
  hasPartialDelivery: boolean;
  advanceAdjusted?: number;
  isAdvanceCovered?: boolean;
}

export const BillSummaryCard: React.FC<BillSummaryCardProps> = ({
  originalTotal,
  deliveredSubtotal,
  tax,
  payableTotal,
  hasPartialDelivery,
  advanceAdjusted = 0,
  isAdvanceCovered = false,
}) => {
  const calculatedTotal = deliveredSubtotal + tax;

  return (
    <Card variant="flat" style={styles.card}>
      <Text style={styles.sectionHeaderTitle}>RECALCULATED BILL SUMMARY</Text>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Original Order Total</Text>
        <Text style={styles.summaryValMuted}>
          ₹{originalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Delivered Items Subtotal</Text>
        <Text style={styles.summaryVal}>
          ₹{deliveredSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {tax > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax / GST</Text>
          <Text style={styles.summaryVal}>
            ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      {advanceAdjusted > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.brandGreen }]}>
            Advance Deducted (Pre-paid)
          </Text>
          <Text style={[styles.summaryVal, { color: colors.brandGreen }]}>
            - ₹{advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>
            {isAdvanceCovered
              ? 'Final Bill Amount (Settled)'
              : hasPartialDelivery
              ? 'Partially Delivered Payable'
              : 'Final Payable at Delivery'}
          </Text>
          {isAdvanceCovered ? (
            <Text style={[styles.partialSubtext, { color: colors.brandGreen }]}>
              ✓ 100% Pre-paid via Advance Deposit
            </Text>
          ) : hasPartialDelivery ? (
            <Text style={styles.partialSubtext}>Adjusted for delivered quantity</Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.totalVal,
            isAdvanceCovered ? { color: colors.brandGreen } : null,
          ]}
        >
          ₹{payableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  summaryValMuted: {
    ...typography.body,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  partialSubtext: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 1,
  },
  totalVal: {
    ...typography.hero,
    fontSize: 24,
    color: colors.primary,
  },
});
