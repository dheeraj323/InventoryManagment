import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { QuantityStepper } from './QuantityStepper';
import { OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

interface ProductQuantityCardProps {
  items: OrderItem[];
  onUpdateQty: (itemId: string, delta: number) => void;
}

export const ProductQuantityCard: React.FC<ProductQuantityCardProps> = ({
  items,
  onUpdateQty,
}) => {
  return (
    <Card variant="flat" style={styles.card}>
      <Text style={styles.sectionHeaderTitle}>VERIFY DELIVERED QUANTITIES</Text>
      <Text style={styles.instructionText}>
        Adjust delivered quantity if items are missing or damaged at shop hand-over.
      </Text>

      {items.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.itemRow,
            index < items.length - 1 && styles.itemDivider,
          ]}
        >
          <View style={styles.itemInfoCol}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <Text style={styles.itemUnit}>
              Ordered: {item.orderedQty} × ({item.unit}) • ₹{item.unitPrice.toLocaleString('en-IN')}/unit
            </Text>
            {item.missingDamagedQty > 0 ? (
              <View style={styles.missingBadgePill}>
                <Text style={styles.missingBadgeText}>
                  Missing / Damaged: {item.missingDamagedQty}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.qtyControlCol}>
            <Text style={styles.deliveredLabel}>Delivered Qty</Text>
            <QuantityStepper
              quantity={item.deliveredQty}
              max={item.orderedQty}
              onIncrease={() => onUpdateQty(item.id, 1)}
              onDecrease={() => onUpdateQty(item.id, -1)}
            />
          </View>
        </View>
      ))}
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
  },
  instructionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemInfoCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  itemUnit: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  missingBadgePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  missingBadgeText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 10,
  },
  qtyControlCol: {
    alignItems: 'flex-end',
  },
  deliveredLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
});
