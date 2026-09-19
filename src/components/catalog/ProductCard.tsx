import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Product } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { QuantitySelector } from './QuantitySelector';
import { colors, typography, spacing } from '../../theme';

export interface ProductCardProps {
  product: Product;
  quantityInCart: number;
  onAddToCart: () => void;
  onUpdateQty: (delta: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantityInCart,
  onAddToCart,
  onUpdateQty,
}) => {
  const isLowStock = product.stockQty <= product.lowStockThreshold;

  return (
    <Card style={styles.card} outlined elevation="sm">
      <View style={styles.row}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>
              {product.name.charAt(0)}
            </Text>
          </View>
        )}

        <View style={styles.detailsCol}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.unit}>{product.unit}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            {isLowStock ? (
              <View style={styles.stockBadgeDanger}>
                <Text style={styles.stockTextDanger}>Only {product.stockQty} left</Text>
              </View>
            ) : (
              <Text style={styles.stockTextInStock}>In Stock ({product.stockQty})</Text>
            )}
          </View>
        </View>

        <View style={styles.actionCol}>
          {quantityInCart > 0 ? (
            <QuantitySelector
              quantity={quantityInCart}
              onIncrease={() => onUpdateQty(1)}
              onDecrease={() => onUpdateQty(-1)}
              max={product.stockQty}
              size="sm"
            />
          ) : (
            <Button
              title="ADD"
              onPress={onAddToCart}
              size="sm"
              variant="outline"
              disabled={product.stockQty === 0}
              fullWidth={false}
              style={styles.addBtn}
            />
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.surfaceSubtle,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.h2,
    color: colors.textMuted,
  },
  detailsCol: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  category: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    ...typography.currency,
    color: colors.primary,
  },
  stockBadgeDanger: {
    marginLeft: spacing.sm,
    backgroundColor: colors.statusCancelledBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockTextDanger: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.danger,
  },
  stockTextInStock: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  actionCol: {
    alignItems: 'flex-end',
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    height: 32,
  },
});
