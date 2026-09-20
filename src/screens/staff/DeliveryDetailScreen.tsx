import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../store/useOrderStore';
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
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { formatDate, formatDateTime } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

export const DeliveryDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById } = useOrderStore();
  const order = getOrderById(orderId);

  const [items, setItems] = useState<OrderItem[]>(order ? order.items : []);

  if (!order || order.status === 'PENDING') {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Delivery Record" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>
            {!order
              ? 'Order not found.'
              : 'This order is pending admin approval and is not ready for delivery.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted =
    order.status === 'DELIVERED' ||
    order.status === 'PARTIALLY_DELIVERED' ||
    order.status === 'CANCELLED';

  const handleUpdateDeliveredQty = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newDelivered = Math.max(0, Math.min(item.orderedQty, item.deliveredQty + delta));
          const newMissing = Math.max(0, item.orderedQty - newDelivered);
          return {
            ...item,
            deliveredQty: newDelivered,
            missingDamagedQty: newMissing,
            totalAmount: newDelivered * item.unitPrice,
          };
        }
        return item;
      })
    );
  };

  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + item.deliveredQty * item.unitPrice,
    0
  );
  const calculatedTax = calculatedSubtotal * 0.05;
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const hasMissingOrDamaged = items.some((i) => i.missingDamagedQty > 0);

  const handleProceedToPayment = () => {
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
                  name={order.status === 'CANCELLED' ? 'close-circle' : 'checkmark-done-circle'}
                  size={20}
                  color={order.status === 'CANCELLED' ? colors.danger : colors.brandGreen}
                />
                <Text style={styles.statusTitle}>
                  {order.status === 'CANCELLED' ? 'DELIVERY CANCELLED' : 'DELIVERY FULFILLED'}
                </Text>
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
            address={order.address}
            phone={order.phone}
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

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST / Tax (5%)</Text>
              <Text style={styles.summaryVal}>
                ₹{order.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

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
        {/* 1. Vendor Address & Phone Action */}
        <DeliveryAddressCard
          shopName={order.shopName}
          address={order.address}
          phone={order.phone}
        />

        {/* 2. Quantity Verification List */}
        <ProductQuantityCard
          items={items}
          onUpdateQty={handleUpdateDeliveredQty}
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
});
