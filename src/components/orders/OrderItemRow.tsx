import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface OrderItemRowProps {
  item: OrderItem;
  showDeliveredQty?: boolean;
}

export const OrderItemRow: React.FC<OrderItemRowProps> = ({
  item,
  showDeliveredQty = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.infoCol}>
        <Text style={styles.name}>{item.productName}</Text>
        <Text style={styles.unit}>
          {item.unit} • ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / unit
        </Text>
      </View>
      <View style={styles.qtyCol}>
        <Text style={styles.qtyText}>{item.orderedQty} x</Text>
        {showDeliveredQty && (
          <Text
            style={[
              styles.deliveredText,
              item.missingDamagedQty > 0 ? styles.missingText : null,
            ]}
          >
            Delivered: {item.deliveredQty}
            {item.missingDamagedQty > 0 ? ` (${item.missingDamagedQty} damaged)` : ''}
          </Text>
        )}
      </View>
      <View style={styles.totalCol}>
        <Text style={styles.totalText}>
          ₹{(item.deliveredQty * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoCol: {
    flex: 2,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  unit: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  qtyCol: {
    flex: 1,
    alignItems: 'center',
  },
  qtyText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  deliveredText: {
    ...typography.caption,
    color: colors.success,
    fontSize: 10,
  },
  missingText: {
    color: colors.danger,
  },
  totalCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
});
