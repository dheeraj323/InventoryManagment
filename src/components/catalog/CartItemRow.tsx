import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderItem } from '../../types';
import { QuantitySelector } from './QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export interface CartItemRowProps {
  item: OrderItem;
  onUpdateQty: (delta: number) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onUpdateQty,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <Text style={styles.name}>{item.productName}</Text>
        <Text style={styles.unit}>
          {item.unit} • ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / unit
        </Text>
      </View>

      <View style={styles.rightCol}>
        <QuantitySelector
          quantity={item.orderedQty}
          onIncrease={() => onUpdateQty(1)}
          onDecrease={() => onUpdateQty(-1)}
          size="sm"
        />
        <Text style={styles.totalText}>
          ₹{(item.orderedQty * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftCol: {
    flex: 1,
    marginRight: spacing.md,
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
  rightCol: {
    alignItems: 'flex-end',
  },
  totalText: {
    ...typography.currency,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 4,
  },
});
