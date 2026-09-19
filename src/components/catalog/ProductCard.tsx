import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../../types';
import { Card } from '../common/Card';
import { QuantitySelector } from './QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export interface ProductCardProps {
  product: Product;
  quantityInCart: number;
  onAddToCart: () => void;
  onUpdateQty: (delta: number) => void;
  onPressQuantity?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantityInCart,
  onAddToCart,
  onUpdateQty,
  onPressQuantity,
}) => {
  const isOutOfStock = product.stockQty === 0;
  const isLowStock = !isOutOfStock && product.stockQty <= product.lowStockThreshold;

  return (
    <Card style={styles.card} outlined elevation="sm">
      {/* ── Top Metadata Row: Category ─────────────────────────── */}
      <View style={styles.topMetaRow}>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{product.category}</Text>
        </View>
      </View>

      {/* ── Product Title & Packaging Unit ──────────────────────── */}
      <View style={styles.contentBlock}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unitDetail}>
          Packaging: <Text style={styles.unitValue}>{product.unit}</Text>
        </Text>
      </View>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <View style={styles.cardDivider} />

      {/* ── Bottom Row: Pricing, Stock & Action Button ──────────── */}
      <View style={styles.bottomRow}>
        <View style={styles.priceBlock}>
          <View style={styles.priceLine}>
            <Text style={styles.priceAmount}>
              ₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.unitSuffix}>/ {product.unit.split(' ')[0] || 'unit'}</Text>
          </View>

          {/* Stock Status Badge */}
          {isOutOfStock ? (
            <View style={[styles.stockBadge, styles.stockBadgeOut]}>
              <Text style={styles.stockTextOut}>Out of Stock</Text>
            </View>
          ) : isLowStock ? (
            <View style={[styles.stockBadge, styles.stockBadgeLow]}>
              <View style={[styles.stockDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.stockTextLow}>Low Stock ({product.stockQty} left)</Text>
            </View>
          ) : (
            <View style={[styles.stockBadge, styles.stockBadgeIn]}>
              <View style={[styles.stockDot, { backgroundColor: colors.brandGreen }]} />
              <Text style={styles.stockTextIn}>In Stock ({product.stockQty})</Text>
            </View>
          )}
        </View>

        {/* Action Area: Add button or Quantity controls */}
        <View style={styles.actionBlock}>
          {quantityInCart > 0 ? (
            <QuantitySelector
              quantity={quantityInCart}
              onIncrease={() => onUpdateQty(1)}
              onDecrease={() => onUpdateQty(-1)}
              onPressQuantity={onPressQuantity}
              max={product.stockQty}
              size="sm"
            />
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
              onPress={onAddToCart}
              disabled={isOutOfStock}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to order`}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="add"
                size={16}
                color={isOutOfStock ? colors.textMuted : colors.textInverse}
              />
              <Text
                style={[
                  styles.addBtnText,
                  isOutOfStock && styles.addBtnTextDisabled,
                ]}
              >
                ADD
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  categoryChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
  },
  categoryText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  skuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skuText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: undefined,
  },
  contentBlock: {
    marginVertical: 2,
  },
  productName: {
    ...typography.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  unitDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
    fontSize: 12,
  },
  unitValue: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    opacity: 0.8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceBlock: {
    flex: 1,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  priceAmount: {
    ...typography.currency,
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  unitSuffix: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  stockBadgeIn: {
    backgroundColor: colors.brandGreenLight,
  },
  stockBadgeLow: {
    backgroundColor: '#FEF3C7',
  },
  stockBadgeOut: {
    backgroundColor: colors.surfaceSubtle,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockTextIn: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.brandGreen,
  },
  stockTextLow: {
    ...typography.captionBold,
    fontSize: 10,
    color: '#B45309',
  },
  stockTextOut: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  actionBlock: {
    marginLeft: spacing.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusMd,
    gap: 4,
    minHeight: 34,
  },
  addBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  addBtnTextDisabled: {
    color: colors.textMuted,
  },
});
