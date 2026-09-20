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
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useVendorStore } from '../../store/useVendorStore';
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Order, PaymentMethod } from '../../types';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

export const CheckoutScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { items, getSubtotal, getTax, getTotal, getItemCount, clearCart } = useCartStore();
  const { createOrder } = useOrderStore();
  const { activeVendorId, currentUser } = useAuthStore();
  const { getVendorAccountSummary } = useLedgerStore();
  const { getVendorById } = useVendorStore();

  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || 'vendor-1';
  const vendor = getVendorById(effectiveVendorId) || {
    id: effectiveVendorId,
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '+91 99887 76655',
    address: 'Shop #12, Central Market, Sector 14, City',
    area: 'Sector 14',
    currentBalance: 3450,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };
  const runningBalance = getVendorAccountSummary(effectiveVendorId, vendor);

  const totalAmount = getTotal();
  const subtotal = getSubtotal();
  const tax = getTax();
  const totalUnits = getItemCount();

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMethod>(
    vendor.preferredPaymentMode || 'PAY_LATER'
  );
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Warn (not block) when PAY_LATER order exceeds vendor credit limit
  const [creditWarning, setCreditWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    if (items.length === 0 || totalAmount <= 0) return;

    setErrorMsg('');
    setCreditWarning('');
    setLoading(true);

    // Credit limit pre-flight check for PAY_LATER orders
    // Non-blocking: order is still created but flagged pendingAdminOverride
    let pendingAdminOverrideLocal = false;
    if (selectedPaymentMode === 'PAY_LATER' && vendor.creditLimit && vendor.creditLimit > 0) {
      const outstanding = runningBalance.currentOutstanding;
      if (outstanding + totalAmount > vendor.creditLimit) {
        pendingAdminOverrideLocal = true;
        setCreditWarning(
          `⚠️ This order exceeds your credit limit. Outstanding: ₹${outstanding.toLocaleString('en-IN')}, ` +
          `Limit: ₹${vendor.creditLimit.toLocaleString('en-IN')}. The order will require Admin approval.`
        );
      }
    }

    try {
      const newOrder = await createOrder({
        vendorId: vendor.id,
        vendorName: vendor.name,
        shopName: vendor.shopName,
        phone: vendor.phone,
        address: vendor.address || '',
        items: [...items],
        subtotal,
        tax,
        discount: 0,
        totalAmount,
        status: 'PENDING',
        preferredPaymentMode: selectedPaymentMode,
        paidAmount: selectedPaymentMode === 'CASH' || selectedPaymentMode === 'ONLINE' ? totalAmount : 0,
        balanceDue: selectedPaymentMode === 'PAY_LATER' ? totalAmount : 0,
        orderDate: new Date().toISOString(),
        deliveryDate: new Date().toISOString().split('T')[0],
        assignedStaffId: 'staff-1',
        assignedStaffName: 'Suresh Kumar',
        notes: notes.trim() || '',
        pendingAdminOverride: pendingAdminOverrideLocal || undefined,
      });

      // Clear cart and show order placed success screen
      clearCart();
      setLoading(false);
      setPlacedOrder(newOrder);
    } catch (err: any) {
      console.error('Checkout place order error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please try again.');
      setLoading(false);
    }
  };

  // ── 1. Order Success Screen View ──────────────────────────────────────────
  if (placedOrder) {
    const itemCount = placedOrder.items.reduce((s, i) => s + i.orderedQty, 0);

    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Order Confirmed"
          subtitle={`Order #${placedOrder.orderNumber || placedOrder.id}`}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Success Banner Hero */}
          <View style={styles.successHero}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <Ionicons name="checkmark-sharp" size={44} color={colors.statusDeliveredText} />
              </View>
            </View>
            <Text style={styles.successTitle}>Order Placed Successfully!</Text>
            <Text style={styles.successSubtitle}>
              Thank you for your order. We have received your wholesale request and queued it for dispatch.
            </Text>
          </View>

          {/* Order Details Summary Card */}
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.orderSummaryHeader}>
              <View>
                <Text style={styles.orderNumberLabel}>ORDER REFERENCE</Text>
                <Text style={styles.orderNumberValue}>#{placedOrder.orderNumber || placedOrder.id}</Text>
              </View>
              <View style={styles.statusBadgePending}>
                <Ionicons name="time-outline" size={13} color={colors.statusPendingText} />
                <Text style={styles.statusBadgeText}>Pending Confirmation</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoVal}>{formatDate(placedOrder.orderDate)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expected Delivery</Text>
              <Text style={styles.infoVal}>{formatDate(placedOrder.deliveryDate)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Ordered Items</Text>
              <Text style={styles.infoVal}>{itemCount} Units ({placedOrder.items.length} SKUs)</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Mode</Text>
              <Text style={styles.infoVal}>{PAYMENT_METHOD_LABELS[placedOrder.preferredPaymentMode] || placedOrder.preferredPaymentMode}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalSub}>Inclusive of GST</Text>
              </View>
              <Text style={styles.totalVal}>
                ₹{placedOrder.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          {/* Delivery Store Card */}
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardTitle}>DELIVERY ADDRESS</Text>
            <View style={styles.deliveryShopRow}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
              <Text style={styles.deliveryShopName}>{placedOrder.shopName || vendor.shopName}</Text>
            </View>
            <Text style={styles.deliveryAddressText}>{placedOrder.address || vendor.address || 'Standard Registered Store Address'}</Text>
            <View style={styles.deliveryContactRow}>
              <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.deliveryPhoneText}>{placedOrder.phone || vendor.phone}</Text>
            </View>
          </Card>

          <View style={{ height: spacing.lg }} />
        </ScrollView>

        {/* Success Action Buttons */}
        <View style={styles.successFooterContainer}>
          <Button
            title="Go to Dashboard"
            onPress={() => navigation.navigate('VendorDashboardTab')}
            size="lg"
            icon={<Ionicons name="home-outline" size={18} color={colors.textInverse} />}
          />
          <Button
            title="View Order Details"
            variant="outline"
            onPress={() => navigation.navigate('VendorOrderDetail', { orderId: placedOrder.id })}
            size="lg"
            style={styles.viewOrderBtn}
            icon={<Ionicons name="receipt-outline" size={18} color={colors.primary} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── 2. Empty Cart Guard View ──────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Payment & Checkout"
          subtitle="Finalize Wholesale Order"
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <EmptyState
            iconName="cart-outline"
            title="Your Order Cart is Empty"
            description="You do not have any items ready for checkout. Please add products from the catalog to place an order."
            actionTitle="Browse Product Catalog"
            onAction={() => navigation.navigate('ProductCatalogTab')}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── 3. Active Checkout Form View ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Payment & Checkout"
        subtitle={`${items.length} Items · ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Order Items Summary Card */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.cardTitle}>ORDER ITEMS ({items.length})</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editCartLink}>Edit Cart</Text>
            </TouchableOpacity>
          </View>

          {items.map((item) => (
            <View key={item.productId} style={styles.cartPreviewRow}>
              <View style={styles.cartPreviewLeft}>
                <Text style={styles.cartPreviewName} numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text style={styles.cartPreviewUnit}>
                  {item.orderedQty} × ₹{item.unitPrice.toLocaleString('en-IN')} / {item.unit}
                </Text>
              </View>
              <Text style={styles.cartPreviewTotal}>
                ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </Card>

        {/* Payment Preferences Section */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>SELECT PAYMENT METHOD</Text>

          {(['PAY_LATER', 'CASH', 'ONLINE'] as PaymentMethod[]).map((mode) => {
            const isSelected = selectedPaymentMode === mode;

            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.paymentOption,
                  isSelected ? styles.paymentOptionSelected : null,
                ]}
                onPress={() => setSelectedPaymentMode(mode)}
                activeOpacity={0.8}
              >
                <View style={styles.radioCircle}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                <View style={styles.paymentCol}>
                  <Text style={styles.paymentName}>
                    {PAYMENT_METHOD_LABELS[mode]}
                  </Text>
                  {mode === 'PAY_LATER' && (
                    <Text style={styles.paymentSubtext}>
                      Add to shop Khata balance for periodic settlement.
                    </Text>
                  )}
                  {mode === 'CASH' && (
                    <Text style={styles.paymentSubtext}>
                      Pay cash on spot to delivery executive.
                    </Text>
                  )}
                  {mode === 'ONLINE' && (
                    <Text style={styles.paymentSubtext}>
                      UPI / Online transfer at time of delivery.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Bill Summary Breakdown */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>BILL BREAKDOWN</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Units</Text>
            <Text style={styles.infoVal}>{totalUnits} Units</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subtotal</Text>
            <Text style={styles.infoVal}>
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GST / Tax</Text>
            <Text style={styles.infoVal}>
              ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalSub}>Inclusive of all taxes</Text>
            </View>
            <Text style={styles.totalVal}>
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </Card>

        {creditWarning ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.statusPendingText} />
            <Text style={styles.warningBannerText}>{creditWarning}</Text>
          </View>
        ) : null}

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* Place Order CTA Button */}
      <View style={styles.footerContainer}>
        <Button
          title={`Confirm & Place Order  ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          onPress={handlePlaceOrder}
          loading={loading}
          disabled={loading || items.length === 0 || totalAmount <= 0}
          size="lg"
        />
      </View>
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
  scrollContent: {
    padding: spacing.screenPadding,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  editCartLink: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 12,
  },
  cartPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cartPreviewLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cartPreviewName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  cartPreviewUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  cartPreviewTotal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accentLight,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentCol: {
    flex: 1,
  },
  paymentName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  paymentSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoVal: {
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
    paddingTop: 4,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.captionBold,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  warningBannerText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  footerContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // ── Success View Styles ───────────────────────────────────────────
  successHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  successIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DCFCE7', // emerald light tint
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successIconInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderNumberLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  orderNumberValue: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 16,
    marginTop: 2,
  },
  statusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
  },
  statusBadgeText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    fontSize: 11,
  },
  deliveryShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  deliveryShopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  deliveryAddressText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  deliveryContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryPhoneText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  successFooterContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  viewOrderBtn: {
    marginTop: 2,
  },
});

