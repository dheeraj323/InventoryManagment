import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../store/useOrderStore';
import { useVendorStore } from '../../store/useVendorStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { OrderItemRow } from '../../components/orders/OrderItemRow';
import {
  DeliveryAddressCard,
  ProductQuantityCard,
  BillSummaryCard,
  PaymentCollectionButton,
} from '../../components/orders';
import { OrderItem } from '../../types';
import { PAYMENT_METHOD_LABELS, BUSINESS_RULES } from '../../constants/rules';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';
import { StaffAddProductsModal } from '../../components/staff/StaffAddProductsModal';
import { colors, typography, spacing } from '../../theme';

export const DeliveryDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById, updateOrderStatus } = useOrderStore();
  const { getVendorById } = useVendorStore();
  const { activeStaffId, currentUser } = useAuthStore();
  const { todaySession, subscribeTodaySession, syncOutForDeliveryStock } = useStaffStockStore();

  const order = getOrderById(orderId);
  const vendor = order ? getVendorById(order.vendorId) : undefined;

  const effectiveStaffId =
    order?.assignedStaffId || activeStaffId || currentUser?.staffId || currentUser?.id || '';

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (effectiveStaffId) {
      const unsub = subscribeTodaySession(effectiveStaffId);
      return () => {
        if (unsub) unsub();
      };
    }
  }, [effectiveStaffId]);

  const vanStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (todaySession && todaySession.status === 'ACTIVE') {
      (todaySession.items || []).forEach((it) => {
        const stock = Math.max(0, it.currentStock ?? (it.loadedQty - it.deliveredQty));
        map[it.productId] = stock;
      });
    }
    return map;
  }, [todaySession]);

  const effectiveAddress = order?.address || vendor?.address || '';
  const effectiveLocationUrl = order?.locationUrl || vendor?.locationUrl;
  const effectiveLatitude = order?.latitude !== undefined ? order.latitude : vendor?.latitude;
  const effectiveLongitude = order?.longitude !== undefined ? order.longitude : vendor?.longitude;

  const [items, setItems] = useState<OrderItem[]>(() => {
    if (!order) return [];
    return order.items;
  });
  const [isAddProductsModalVisible, setIsAddProductsModalVisible] = useState(false);

  // Synchronize items with vanStockMap so deliveredQty can NEVER exceed physical van stock
  useEffect(() => {
    if (!order) return;
    setItems((prevItems) => {
      const sourceList = prevItems.length > 0 ? prevItems : (order.items || []);
      return sourceList.map((item) => {
        const availableVanStock = vanStockMap[item.productId] ?? 0;
        const targetDelivered =
          item.orderedQty > 0
            ? Math.min(item.deliveredQty > 0 ? item.deliveredQty : item.orderedQty, availableVanStock)
            : Math.min(item.deliveredQty, availableVanStock);
        const ordered = item.orderedQty || 0;
        const missing = Math.max(0, ordered - targetDelivered);
        return {
          ...item,
          deliveredQty: targetDelivered,
          missingDamagedQty: missing,
          totalAmount: targetDelivered * item.unitPrice,
        };
      });
    });
  }, [vanStockMap, order?.id]);

  const handleMarkOutForDelivery = async () => {
    if (!order || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateOrderStatus(order.id, 'OUT_FOR_DELIVERY');
      const allOrders = useOrderStore.getState().orders;
      if (effectiveStaffId) {
        await syncOutForDeliveryStock(effectiveStaffId, allOrders);
      }
    } catch (err) {
      console.warn('Error setting order out for delivery:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!order || order.status === 'PENDING' || order.status === 'CANCELLED') {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Delivery Record" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>
            {!order
              ? 'Order not found.'
              : order.status === 'CANCELLED'
              ? 'This delivery has been cancelled and is no longer assigned.'
              : 'This order is pending admin approval and is not ready for delivery.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted =
    order.status === 'DELIVERED' ||
    order.status === 'PARTIALLY_DELIVERED';

  const handleUpdateDeliveredQty = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const maxAllowed = vanStockMap[item.productId] ?? 0;
            const targetDelivered = item.deliveredQty + delta;
            const newDelivered = Math.min(maxAllowed, Math.max(0, targetDelivered));
            const ordered = item.orderedQty || 0;
            const newMissing = Math.max(0, ordered - newDelivered);
            return {
              ...item,
              deliveredQty: newDelivered,
              missingDamagedQty: newMissing,
              totalAmount: newDelivered * item.unitPrice,
            };
          }
          return item;
        })
        .filter((item) => !(item.orderedQty === 0 && item.deliveredQty === 0))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleSaveAddedProducts = (newItems: OrderItem[]) => {
    setItems(newItems);
  };

  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + item.deliveredQty * item.unitPrice,
    0
  );
  const calculatedTax = calculatedSubtotal * (BUSINESS_RULES.TAX_RATE || 0);
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const hasMissingOrDamaged = items.some(
    (i) => (i.missingDamagedQty || 0) > 0 || (i.damagedQty || 0) > 0
  );

  const hasOutOfVanStock = useMemo(() => {
    return items.some((it) => {
      const inVan = vanStockMap[it.productId] ?? 0;
      return (it.orderedQty || 0) > 0 && inVan < it.orderedQty;
    });
  }, [items, vanStockMap]);

  const handleProceedToPayment = () => {
    const totalDeliveredQty = items.reduce((sum, it) => sum + (it.deliveredQty || 0), 0);
    if (totalDeliveredQty === 0) {
      Alert.alert(
        'Cannot Proceed to Payment',
        'None of the ordered items are currently loaded in your vehicle stock (Delivered Units: 0). You must load stock into your van before fulfilling this delivery.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.navigate('ActualPayment', {
      orderId: order.id,
      updatedItems: items,
      calculatedTotal,
    });
  };

  // ── Render Completed / Delivered Order Summary ────────────────────────
  if (isCompleted) {
    const formattedDeliveredAt = order.deliveredAt
      ? formatDateTime(order.deliveredAt)
      : formatDate(order.orderDate);

    return (
      <SafeAreaView style={styles.container}>
        <Header
          title={`Order #${order.orderNumber}`}
          subtitle={`Delivered to ${order.shopName}`}
          showBack
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Fulfillment Status Card */}
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.statusHeader}>
              <View style={styles.statusTitleBlock}>
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color={colors.brandGreen}
                />
                <Text style={styles.statusTitle}>DELIVERY FULFILLED</Text>
              </View>
              <StatusBadge status={order.status} />
            </View>
            <Text style={styles.deliveredDateText}>
              Completed on: {formattedDeliveredAt}
            </Text>
          </Card>

          {/* 2. Customer & Address Profile */}
          <DeliveryAddressCard
            shopName={order.shopName}
            address={effectiveAddress}
            phone={order.phone}
            locationUrl={effectiveLocationUrl}
            latitude={effectiveLatitude}
            longitude={effectiveLongitude}
            routeName={order.routeName}
          />

          {/* 3. Delivered Items Summary */}
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardSectionTitle}>DELIVERED ITEMS ({order.items.length})</Text>
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} showDeliveredQty />
            ))}
          </Card>

          {/* 4. Payment Settlement Breakdown */}
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardSectionTitle}>PAYMENT SETTLEMENT</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Mode</Text>
              <Text style={styles.summaryVal}>
                {order.actualPaymentMode
                  ? PAYMENT_METHOD_LABELS[order.actualPaymentMode]
                  : PAYMENT_METHOD_LABELS[order.preferredPaymentMode]}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>
                ₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {order.tax > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST / Tax</Text>
                <Text style={styles.summaryVal}>
                  ₹{order.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total Invoice Amount</Text>
              <Text style={styles.totalVal}>
                ₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.paidLabel}>Amount Collected</Text>
              <Text style={styles.paidVal}>
                ₹{(order.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {order.balanceDue > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.dueLabel}>Balance Outstanding</Text>
                <Text style={styles.dueVal}>
                  ₹{order.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render Active Delivery Workflow ──────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Deliver Order #${order.orderNumber}`}
        subtitle={order.shopName}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Out for Delivery Status / Action Banner */}
        {order.status !== 'OUT_FOR_DELIVERY' ? (
          <View style={styles.dispatchActionCard}>
            <View style={styles.dispatchActionLeft}>
              <View style={styles.dispatchIconWrap}>
                <Ionicons name="bicycle" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.dispatchActionTitle}>Start Delivery Trip</Text>
                <Text style={styles.dispatchActionSubtitle}>
                  Mark as Out for Delivery to update On-Way vehicle stock tracker.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.dispatchBtn}
              onPress={handleMarkOutForDelivery}
              disabled={isUpdatingStatus}
              activeOpacity={0.8}
            >
              <Ionicons name="bicycle-outline" size={14} color={colors.textInverse} />
              <Text style={styles.dispatchBtnText}>
                {isUpdatingStatus ? 'Updating...' : 'Out for Delivery'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.onWayBadgeBanner}>
            <View style={styles.onWayIconWrap}>
              <Ionicons name="bicycle" size={18} color="#0284C7" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.onWayBadgeTitle}>OUT FOR DELIVERY (ON THE WAY)</Text>
              <Text style={styles.onWayBadgeSub}>
                Stock tracked as active in-transit delivery on vehicle record.
              </Text>
            </View>
          </View>
        )}

        {/* 1. Vendor Address & Phone Action */}
        <DeliveryAddressCard
          shopName={order.shopName}
          address={effectiveAddress}
          phone={order.phone}
          locationUrl={effectiveLocationUrl}
          latitude={effectiveLatitude}
          longitude={effectiveLongitude}
          routeName={order.routeName}
        />

        {/* Stock Warning Notice if any items are missing/insufficient in vehicle */}
        {hasOutOfVanStock && (
          <View style={styles.vanStockAlertCard}>
            <Ionicons name="warning" size={18} color="#D97706" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.vanStockAlertTitle}>Vehicle Stock Notice</Text>
              <Text style={styles.vanStockAlertDesc}>
                Stock not currently loaded in this van is capped to available vehicle stock (0). Items with 0 in-van stock cannot be delivered.
              </Text>
            </View>
          </View>
        )}

        {/* 2. Quantity Verification List */}
        <ProductQuantityCard
          items={items}
          onUpdateQty={handleUpdateDeliveredQty}
          onAddProducts={() => setIsAddProductsModalVisible(true)}
          onRemoveItem={handleRemoveItem}
          vanStockMap={vanStockMap}
        />

        {/* 3. Recalculated Bill Summary */}
        <BillSummaryCard
          originalTotal={order.totalAmount}
          deliveredSubtotal={calculatedSubtotal}
          tax={calculatedTax}
          payableTotal={calculatedTotal}
          hasPartialDelivery={hasMissingOrDamaged}
        />
      </ScrollView>

      {/* 4. Deep Navy Fixed Bottom CTA */}
      <PaymentCollectionButton
        amount={calculatedTotal}
        onPress={handleProceedToPayment}
      />

      {/* 5. Add Products Modal */}
      <StaffAddProductsModal
        visible={isAddProductsModalVisible}
        onClose={() => setIsAddProductsModalVisible(false)}
        currentItems={items}
        onSaveItems={handleSaveAddedProducts}
        vanStockMap={vanStockMap}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  deliveredDateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardSectionTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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
  totalLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  totalVal: {
    ...typography.h3,
    color: colors.primary,
  },
  paidLabel: {
    ...typography.body,
    color: colors.brandGreen,
  },
  paidVal: {
    ...typography.bodyBold,
    color: colors.brandGreen,
  },
  dueLabel: {
    ...typography.body,
    color: colors.debit,
  },
  dueVal: {
    ...typography.bodyBold,
    color: colors.debit,
  },
  dispatchActionCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: spacing.md,
  },
  dispatchActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dispatchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchActionTitle: {
    ...typography.bodyBold,
    color: '#1E40AF',
    fontSize: 13,
  },
  dispatchActionSubtitle: {
    ...typography.caption,
    color: '#3B82F6',
    fontSize: 11,
    marginTop: 1,
  },
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    gap: 6,
  },
  dispatchBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 12,
  },
  onWayBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: spacing.md,
  },
  onWayIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onWayBadgeTitle: {
    ...typography.captionBold,
    color: '#0369A1',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  onWayBadgeSub: {
    ...typography.caption,
    color: '#0284C7',
    fontSize: 10,
    marginTop: 1,
  },
  vanStockAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.md,
  },
  vanStockAlertTitle: {
    ...typography.captionBold,
    color: '#92400E',
    fontSize: 12,
  },
  vanStockAlertDesc: {
    ...typography.caption,
    color: '#B45309',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
