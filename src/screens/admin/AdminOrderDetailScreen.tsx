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
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTracker } from '../../components/orders/StatusTracker';
import { OrderItemRow } from '../../components/orders/OrderItemRow';
import { OrderStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const AdminOrderDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById, updateOrderStatus } = useOrderStore();
  const order = getOrderById(orderId);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Order Detail" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleUpdateStatus = (status: OrderStatus) => {
    updateOrderStatus(order.id, status);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Order #${order.orderNumber}`}
        subtitle={`Vendor: ${order.shopName}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Tracker */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.statusHeader}>
            <Text style={styles.cardTitle}>ORDER FULFILLMENT STATUS</Text>
            <StatusBadge status={order.status} />
          </View>
          <StatusTracker status={order.status} />

          {/* Admin Status Override Actions */}
          <Text style={styles.adminActionTitle}>ADMIN STATUS OVERRIDE</Text>
          <View style={styles.statusBtnRow}>
            {order.status === 'PENDING' && (
              <>
                <Button
                  title="Approve Order"
                  onPress={() => handleUpdateStatus('APPROVED')}
                  size="sm"
                  style={styles.statusBtn}
                />
                <Button
                  title="Reject / Cancel"
                  onPress={() => handleUpdateStatus('CANCELLED')}
                  variant="danger"
                  size="sm"
                  style={styles.statusBtn}
                />
              </>
            )}

            {order.status === 'APPROVED' && (
              <Button
                title="Dispatch / Out for Delivery"
                onPress={() => handleUpdateStatus('OUT_FOR_DELIVERY')}
                size="sm"
                style={styles.statusBtn}
              />
            )}
          </View>
        </Card>

        {/* Vendor Profile & Delivery Details */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>CUSTOMER VENDOR PROFILE</Text>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.detailText}>Proprietor: {order.vendorName}</Text>
          <Text style={styles.detailText}>Phone: {order.phone}</Text>
          <Text style={styles.detailText}>Address: {order.address}</Text>
          <Text style={styles.detailText}>Delivery Date: {order.deliveryDate}</Text>
          {order.assignedStaffName && (
            <Text style={styles.detailText}>
              Delivery Executive: {order.assignedStaffName}
            </Text>
          )}
        </Card>

        {/* Itemized Invoice Breakdown */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>ORDER ITEMS BREAKDOWN</Text>
          {order.items.map((item) => (
            <OrderItemRow
              key={item.id}
              item={item}
              showDeliveredQty={
                order.status === 'DELIVERED' || order.status === 'PARTIALLY_DELIVERED'
              }
            />
          ))}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>${order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax / GST (5%)</Text>
            <Text style={styles.summaryVal}>${order.tax.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Bill</Text>
            <Text style={styles.totalVal}>${order.totalAmount.toFixed(2)}</Text>
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
    marginBottom: spacing.xs,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  adminActionTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  statusBtnRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  statusBtn: {
    marginRight: spacing.xs,
    flex: 1,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  detailText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
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
  },
  summaryVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
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
