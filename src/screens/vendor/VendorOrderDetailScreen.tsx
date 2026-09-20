import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTracker } from '../../components/orders/StatusTracker';
import { OrderItemRow } from '../../components/orders/OrderItemRow';
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { formatDateTime } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

export const VendorOrderDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById } = useOrderStore();
  const { activeVendorId, currentUser, activeRole } = useAuthStore();
  const order = getOrderById(orderId);

  const effectiveVendorId = activeVendorId || currentUser?.vendorId;
  const isVendorRole = activeRole === 'VENDOR' || currentUser?.role === 'VENDOR';
  const isForbidden = Boolean(isVendorRole && effectiveVendorId && order && order.vendorId !== effectiveVendorId);

  if (!order || isForbidden) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Order Detail" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>
            {isForbidden ? 'Unauthorized: You can only view orders placed by your store.' : 'Order not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const orderDateFormatted = formatDateTime(order.orderDate);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={order.orderNumber}
        subtitle={`Placed on ${orderDateFormatted}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Tracker Progress Card */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.statusHeader}>
            <Text style={styles.cardTitle}>LIVE STATUS TRACKER</Text>
            <StatusBadge status={order.status} />
          </View>
          <StatusTracker status={order.status} />
        </Card>

        {/* Itemized Order List */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>ORDERED ITEMS ({order.items.length})</Text>
          {order.items.map((item) => (
            <OrderItemRow
              key={item.id}
              item={item}
              showDeliveredQty={
                order.status === 'DELIVERED' || order.status === 'PARTIALLY_DELIVERED'
              }
            />
          ))}
        </Card>

        {/* Payment & Invoice Summary */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>PAYMENT & INVOICE BREAKDOWN</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Preferred Payment Mode</Text>
            <StatusBadge paymentMethod={order.preferredPaymentMode} size="sm" />
          </View>
          {order.actualPaymentMode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Actual Mode Recorded</Text>
              <Text style={styles.infoVal}>
                {PAYMENT_METHOD_LABELS[order.actualPaymentMode]}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subtotal</Text>
            <Text style={styles.infoVal}>₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tax / GST (5%)</Text>
            <Text style={styles.infoVal}>₹{order.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Invoice Amount</Text>
            <Text style={styles.totalVal}>₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Amount Paid</Text>
            <Text style={[styles.infoVal, { color: colors.success }]}>
              ₹{order.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Outstanding Balance Due</Text>
            <Text
              style={[
                styles.infoVal,
                { color: order.balanceDue > 0 ? colors.danger : colors.textSecondary },
              ]}
            >
              ₹{order.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </Card>
      </ScrollView>
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
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
  },
  infoVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    paddingVertical: spacing.xs,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  totalVal: {
    ...typography.currency,
    color: colors.primary,
  },
});
