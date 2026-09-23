import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { BUSINESS_RULES } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { CartItemRow } from '../../components/catalog/CartItemRow';
import { QuantityModal } from '../../components/catalog/QuantityModal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const CartScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { items, updateQty, setQty, removeItem, getSubtotal, getTax, getTotal, getItemCount, clearCart } = useCartStore();
  const { products } = useInventoryStore();

  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<{
    item: OrderItem;
    maxStock?: number;
  } | null>(null);

  const totalUnits = getItemCount();
  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  // Helper to lookup product SKU by productId
  const getProductSku = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    return prod?.sku;
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Order Cart"
          subtitle="0 Items in Cart"
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="cart-outline"
            title="Your Order Cart is Empty"
            description="Add wholesale products from our catalog to build your store order."
            actionTitle="Browse Wholesale Catalog"
            onAction={() => navigation.navigate('ProductCatalog')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Header
        title="Order Cart"
        subtitle={`${items.length} Products · ${totalUnits} Units`}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.clearHeaderBtn}
            onPress={() => setShowClearModal(true)}
            accessibilityLabel="Clear all items from cart"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.clearText}>Clear Cart</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. Itemized Order Cart Section ──────────────────────── */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>ORDERED ITEMS ({items.length} Items)</Text>
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() => navigation.navigate('ProductCatalog')}
            >
              <Ionicons name="add-circle-outline" size={14} color={colors.accent} />
              <Text style={styles.addMoreText}>Add Products</Text>
            </TouchableOpacity>
          </View>

          {items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return (
              <CartItemRow
                key={item.productId}
                item={item}
                sku={product?.sku}
                max={product?.stockQty}
                onUpdateQty={(delta) => updateQty(item.productId, delta)}
                onRemove={() => removeItem(item.productId)}
                onPressQuantity={() =>
                  setSelectedItemForModal({
                    item,
                    maxStock: product?.stockQty,
                  })
                }
              />
            );
          })}
        </Card>

        {/* ── 3. Financial Bill Breakdown ─────────────────────────── */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>BILL BREAKDOWN</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Ordered Units</Text>
            <Text style={styles.summaryVal}>{totalUnits} Units</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>GST / Tax ({Math.round(BUSINESS_RULES.TAX_RATE * 100)}%)</Text>
            <Text style={styles.summaryVal}>
              ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Estimated Total</Text>
              <Text style={styles.totalSub}>Inclusive of taxes</Text>
            </View>
            <Text style={styles.totalVal}>
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </Card>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Bottom Fixed Action Bar ─────────────────────────────── */}
      <View style={styles.footerContainer}>
        <Button
          title="Proceed to Payment & Checkout"
          onPress={() => navigation.navigate('CheckoutScreen')}
          size="lg"
          icon={<Ionicons name="arrow-forward" size={18} color={colors.textInverse} />}
        />
      </View>

      {/* ── Direct Numeric Bulk Quantity Keypad Modal ────────────── */}
      {selectedItemForModal && (
        <QuantityModal
          visible={!!selectedItemForModal}
          productName={selectedItemForModal.item.productName}
          unit={selectedItemForModal.item.unit}
          unitPrice={selectedItemForModal.item.unitPrice}
          initialQty={selectedItemForModal.item.orderedQty}
          maxStock={selectedItemForModal.maxStock}
          onConfirm={(newQty) => {
            if (newQty <= 0) {
              removeItem(selectedItemForModal.item.productId);
            } else {
              setQty(selectedItemForModal.item.productId, newQty);
            }
          }}
          onClose={() => setSelectedItemForModal(null)}
        />
      )}

      {/* ── Discard / Clear Cart Confirmation Modal ────────────── */}
      <ConfirmationModal
        visible={showClearModal}
        title="Clear Order Cart?"
        message="Are you sure you want to remove all wholesale items from your order cart? This action cannot be undone."
        confirmTitle="Yes, Clear Cart"
        cancelTitle="Keep Items"
        variant="danger"
        onConfirm={() => {
          clearCart();
          setShowClearModal(false);
        }}
        onCancel={() => setShowClearModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.screenPadding,
    justifyContent: 'center',
  },
  clearHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 12,
  },
  scrollContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addMoreText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  totalLabel: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  totalSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  totalVal: {
    ...typography.currencyLarge,
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  footerContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
