import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { QuantityStepper } from './QuantityStepper';
import { OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

interface ProductQuantityCardProps {
  items: OrderItem[];
  onUpdateQty: (itemId: string, delta: number) => void;
  onAddProducts?: () => void;
  onRemoveItem?: (itemId: string) => void;
  vanStockMap?: Record<string, number>;
}

export const ProductQuantityCard: React.FC<ProductQuantityCardProps> = ({
  items,
  onUpdateQty,
  onAddProducts,
  onRemoveItem,
  vanStockMap,
}) => {
  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeaderTitle}>VERIFY DELIVERED QUANTITIES</Text>
          <Text style={styles.instructionText}>
            Adjust delivered quantities or add extra products handed over.
          </Text>
        </View>
        {onAddProducts && (
          <TouchableOpacity
            style={styles.addProductsHeaderBtn}
            onPress={onAddProducts}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add products to delivery"
          >
            <Ionicons name="add-circle" size={16} color={colors.primary} />
            <Text style={styles.addProductsBtnText}>Add Items</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyItemsBlock}>
          <Text style={styles.emptyItemsText}>No items in delivery.</Text>
          {onAddProducts && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={onAddProducts}>
              <Ionicons name="add" size={16} color={colors.textInverse} />
              <Text style={styles.emptyAddBtnText}>Add Products</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        items.map((item, index) => {
          const ordered = item.orderedQty || 0;
          const isExtra = item.deliveredQty > ordered && ordered > 0;
          const isNewlyAdded = ordered === 0;
          const isMissing = item.deliveredQty < ordered;
          const missingQty = Math.max(0, ordered - item.deliveredQty);
          const extraQty = isExtra ? item.deliveredQty - ordered : 0;
          const vanStock = vanStockMap ? vanStockMap[item.productId] : undefined;

          return (
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
                  {isNewlyAdded
                    ? `Added at delivery • ₹${item.unitPrice.toLocaleString('en-IN')}/unit`
                    : `Ordered: ${ordered} × (${item.unit}) • ₹${item.unitPrice.toLocaleString('en-IN')}/unit`}
                </Text>

                <View style={styles.badgeWrapRow}>
                  {vanStock !== undefined && (
                    <View style={styles.vanStockBadge}>
                      <Ionicons name="car-outline" size={11} color={colors.textSecondary} />
                      <Text style={styles.vanStockBadgeText}>In Van: {vanStock}</Text>
                    </View>
                  )}

                  {isMissing ? (
                    <View style={styles.missingBadgePill}>
                      <Text style={styles.missingBadgeText}>
                        Missing: {missingQty}
                      </Text>
                    </View>
                  ) : isExtra ? (
                    <View style={styles.extraBadgePill}>
                      <Ionicons name="arrow-up-circle" size={12} color={colors.brandGreen} />
                      <Text style={styles.extraBadgeText}>
                        +{extraQty} Extra
                      </Text>
                    </View>
                  ) : isNewlyAdded ? (
                    <View style={styles.newBadgePill}>
                      <Ionicons name="sparkles" size={11} color={colors.accent} />
                      <Text style={styles.newBadgeText}>Added at Handover</Text>
                    </View>
                  ) : (
                    <View style={styles.completeBadgePill}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.brandGreen} />
                      <Text style={styles.completeBadgeText}>Full Qty</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.qtyControlCol}>
                <View style={styles.qtyHeaderRow}>
                  <Text style={styles.deliveredLabel}>Delivered Qty</Text>
                  {isNewlyAdded && onRemoveItem && (
                    <TouchableOpacity
                      onPress={() => onRemoveItem(item.id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <QuantityStepper
                  quantity={item.deliveredQty}
                  max={vanStock}
                  onIncrease={() => onUpdateQty(item.id, 1)}
                  onDecrease={() => onUpdateQty(item.id, -1)}
                />
              </View>
            </View>
          );
        })
      )}
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
  qtyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deliveredLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  addProductsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusMd,
  },
  addProductsBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  badgeWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  vanStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    alignSelf: 'flex-start',
  },
  vanStockBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  extraBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandGreenLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    alignSelf: 'flex-start',
  },
  extraBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 10,
  },
  newBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  newBadgeText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 10,
  },
  completeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.borderRadiusSm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  completeBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  emptyItemsBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyItemsText: {
    ...typography.body,
    color: colors.textMuted,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusMd,
  },
  emptyAddBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
});
