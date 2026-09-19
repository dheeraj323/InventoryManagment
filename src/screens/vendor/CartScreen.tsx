import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useVendorStore } from '../../store/useVendorStore';
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
  const { activeVendorId } = useAuthStore();
  const { getPartyRunningBalance } = useLedgerStore();
  const { getVendorById } = useVendorStore();

  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<{
    item: OrderItem;
    maxStock?: number;
  } | null>(null);

  const vendor = getVendorById(activeVendorId) || {
    id: activeVendorId || 'vendor-1',
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '',
    address: '',
    area: '',
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const runningBalance = getPartyRunningBalance(vendor.id);
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
          title="Order Crate"
          subtitle="0 Items in Crate"
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="cart-outline"
            title="Your Order Crate is Empty"
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
        title="Order Crate"
        subtitle={`${items.length} SKUs · ${totalUnits} Units`}
        showBack
        onBackPress={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={styles.clearHeaderBtn}
            onPress={() => setShowClearModal(true)}
            accessibilityLabel="Clear all items from crate"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.clearText}>Clear Crate</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. Cutoff Banner ────────────────────────────────────── */}
        <View style={styles.cutoffBanner}>
          <Ionicons name="time-outline" size={16} color="#B45309" />
          <Text style={styles.cutoffText}>{BUSINESS_RULES.ORDER_CUTOFF_LABEL}</Text>
        </View>

        {/* ── 2. Itemized Order Crate Section ──────────────────────── */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>ORDERED ITEMS ({items.length} SKUs)</Text>
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

        {/* ── 4. Financial Khata Account Summary ─────────────────── */}
        <Card
          style={styles.card}
          outlined
          elevation="sm"
        >
          <View style={styles.creditHeader}>
            <Ionicons
              name="book-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.creditTitle}>
              Vendor Khata Account
            </Text>
          </View>

          <View style={styles.creditMetaGrid}>
            <View style={styles.creditMetaCol}>
              <Text style={styles.creditMetaLabel}>Current Pending Due</Text>
              <Text
                style={[
                  styles.creditMetaVal,
                  { color: runningBalance > 0 ? colors.debit : colors.brandGreen },
                ]}
              >
                ₹{Math.abs(runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.creditMetaCol}>
              <Text style={styles.creditMetaLabel}>Account Status</Text>
              <Text style={[styles.creditMetaVal, { color: runningBalance > 0 ? colors.warning : colors.brandGreen }]}>
                {runningBalance > 0 ? 'Pending Dues' : 'Settled'}
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Bottom Fixed Action Bar ─────────────────────────────── */}
      <View style={styles.footerContainer}>
        <Button
          title="Proceed to Delivery & Checkout"
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

      {/* ── Discard / Clear Crate Confirmation Modal ────────────── */}
      <ConfirmationModal
        visible={showClearModal}
        title="Clear Order Crate?"
        message="Are you sure you want to remove all wholesale items from your order crate? This action cannot be undone."
        confirmTitle="Yes, Clear Crate"
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
  cutoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  cutoffText: {
    ...typography.captionBold,
    color: '#92400E',
    fontSize: 11,
    flex: 1,
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
  exceedsCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  creditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 6,
  },
  creditTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  creditTitleDanger: {
    color: colors.danger,
  },
  creditMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  creditMetaCol: {
    flex: 1,
  },
  creditMetaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  creditMetaVal: {
    ...typography.captionBold,
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.xs,
    gap: 6,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
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
