import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderItem } from '../../types';
import { QuantitySelector } from './QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export interface CartItemRowProps {
  item: OrderItem;
  sku?: string;
  max?: number;
  onUpdateQty: (delta: number) => void;
  onRemove?: () => void;
  onPressQuantity?: () => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  sku,
  max,
  onUpdateQty,
  onRemove,
  onPressQuantity,
}) => {
  return (
    <View style={styles.container}>
      {/* Left Details */}
      <View style={styles.leftCol}>
        <Text style={styles.name} numberOfLines={2}>
          {item.productName}
        </Text>
        <Text style={styles.unit}>
          {sku ? `${sku} · ` : ''}{item.unit} • ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / unit
        </Text>
        <Text style={styles.lineTotal}>
          Line Total: <Text style={styles.lineTotalVal}>₹{(item.orderedQty * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Text>
      </View>

      {/* Right Controls & Remove */}
      <View style={styles.rightCol}>
        <QuantitySelector
          quantity={item.orderedQty}
          onIncrease={() => onUpdateQty(1)}
          onDecrease={() => onUpdateQty(-1)}
          onPressQuantity={onPressQuantity}
          max={max}
          size="sm"
        />
        {onRemove && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Remove ${item.productName} from order`}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        )}
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
    fontSize: 14,
    color: colors.textPrimary,
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
  },
  lineTotal: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 11,
  },
  lineTotalVal: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  removeText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 10,
  },
});

