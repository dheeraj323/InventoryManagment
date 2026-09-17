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
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTracker } from '../../components/orders/StatusTracker';
import { OrderItemRow } from '../../components/orders/OrderItemRow';
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { colors, typography, spacing } from '../../theme';

export const VendorOrderDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById } = useOrderStore();
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

  const orderDateFormatted = new Date(order.orderDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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
            <Text style={styles.infoVal}>${order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tax / GST (5%)</Text>
            <Text style={styles.infoVal}>${order.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Invoice Amount</Text>
            <Text style={styles.totalVal}>${order.totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Amount Paid</Text>
            <Text style={[styles.infoVal, { color: colors.success }]}>
              ${order.paidAmount.toFixed(2)}
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
              ${order.balanceDue.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Delivery Details */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>DELIVERY & CONTACT DETAILS</Text>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.accent} />
            <Text style={styles.detailText}>
              Delivery Date: {order.deliveryDate}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color={colors.accent} />
            <Text style={styles.detailText}>
              {order.shopName} ({order.address})
            </Text>
          </View>
          {order.assignedStaffName && (
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={16} color={colors.accent} />
              <Text style={styles.detailText}>
                Assigned Staff: {order.assignedStaffName}
              </Text>
            </View>
          )}
          {order.notes && (
            <View style={styles.detailItem}>
              <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
              <Text style={styles.detailText}>Notes: {order.notes}</Text>
            </View>
          )}
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
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  detailText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
});
