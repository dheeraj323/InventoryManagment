import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { colors, typography, spacing } from '../../theme';

export interface OrderCardProps {
  order: Order;
  onPress: () => void;
  showVendorName?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  showVendorName = true,
}) => {
  const itemCount = order.items.reduce((sum, i) => sum + i.orderedQty, 0);
  const formattedDate = new Date(order.orderDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isPendingDelivery = order.status === 'OUT_FOR_DELIVERY' || order.status === 'PENDING' || order.status === 'APPROVED';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Top row: order number + date + status */}
      <View style={styles.headerRow}>
        <View style={styles.orderIdBlock}>
          <Text style={styles.orderNum}>#{order.orderNumber}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
        <StatusBadge status={order.status} size="sm" />
      </View>

      {showVendorName && (
        <View style={styles.vendorRow}>
          <Ionicons name="storefront" size={14} color={colors.accent} />
          <Text style={styles.vendorName} numberOfLines={1}>
            {order.shopName} · {order.vendorName}
          </Text>
        </View>
      )}

      {/* Items summary */}
      <Text style={styles.itemsSummary} numberOfLines={2}>
        {order.items.map((i) => `${i.productName} ×${i.orderedQty}`).join('  ·  ')}
      </Text>

      {/* Footer: total + action pill */}
      <View style={styles.footerRow}>
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>ORDER TOTAL</Text>
          <Text style={styles.totalAmount}>
            ₹{order.totalAmount.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={[styles.viewPill, isPendingDelivery && styles.deliverNowPill]}>
          <Text style={[styles.viewText, isPendingDelivery && styles.deliverNowText]}>
            {isPendingDelivery ? 'Deliver Now' : 'View Details'}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={13}
            color={isPendingDelivery ? colors.brandGreen : colors.accent}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderIdBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  orderNum: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  vendorName: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 1,
  },
  itemsSummary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalBlock: {},
  totalLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 1,
  },
  totalAmount: {
    ...typography.currency,
    color: colors.textPrimary,
    fontSize: 15,
  },
  viewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
    gap: 3,
  },
  deliverNowPill: {
    backgroundColor: colors.brandGreenLight,
  },
  viewText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },
  deliverNowText: {
    color: colors.brandGreen,
  },
});
