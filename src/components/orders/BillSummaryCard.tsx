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
}

export const BillSummaryCard: React.FC<BillSummaryCardProps> = ({
  originalTotal,
  deliveredSubtotal,
  tax,
  payableTotal,
  hasPartialDelivery,
}) => {
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

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Tax / GST (5%)</Text>
        <Text style={styles.summaryVal}>
          ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.totalLabel}>
            {hasPartialDelivery ? 'Partially Delivered Total' : 'Final Payable Total'}
          </Text>
          {hasPartialDelivery ? (
            <Text style={styles.partialSubtext}>Adjusted for missing/damaged items</Text>
          ) : null}
        </View>
        <Text style={styles.totalVal}>
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
