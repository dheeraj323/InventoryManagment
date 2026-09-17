import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../types';
import { Card } from '../common/Card';
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
  const formattedDate = new Date(order.orderDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card style={styles.card} onPress={onPress} outlined elevation="sm">
      <View style={styles.headerRow}>
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderNum}>{order.orderNumber}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
        <StatusBadge status={order.status} size="sm" />
      </View>

      {showVendorName && (
        <View style={styles.vendorRow}>
          <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.vendorName} numberOfLines={1}>
            {order.shopName} ({order.vendorName})
          </Text>
        </View>
      )}

      <View style={styles.itemsSummary}>
        <Text style={styles.itemSummaryText} numberOfLines={2}>
          {order.items.map((i) => `${i.productName} (${i.orderedQty}x)`).join(', ')}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.totalLabel}>Total Bill</Text>
          <Text style={styles.totalAmount}>${order.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.actionPill}>
          <Text style={styles.actionText}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNum: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  vendorName: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  itemsSummary: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginVertical: spacing.xs,
  },
  itemSummaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  totalAmount: {
    ...typography.currency,
    color: colors.textPrimary,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...typography.captionBold,
    color: colors.primary,
    marginRight: 2,
  },
});
