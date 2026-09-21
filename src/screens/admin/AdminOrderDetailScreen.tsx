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
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatusTracker } from '../../components/orders/StatusTracker';
import { OrderItemRow } from '../../components/orders/OrderItemRow';
import { DispatchStaffModal } from '../../components/orders/DispatchStaffModal';
import { OrderStatus, Staff } from '../../types';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

export const AdminOrderDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId, hideVendorProfile } = route.params || {};
  const { getOrderById, updateOrderStatus, assignStaffAndDispatch } = useOrderStore();
  const order = getOrderById(orderId);

  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatching, setDispatching] = useState(false);

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

  const handleConfirmDispatch = async (staff: Staff) => {
    setDispatching(true);
    try {
      await assignStaffAndDispatch(order.id, {
        staffId: staff.staffId || staff.id,
        name: staff.name,
        phone: staff.phone,
      });
      setDispatchModalVisible(false);
    } catch (err) {
      console.error('Error dispatching order to staff:', err);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Order #${order.orderNumber}`}
        subtitle={hideVendorProfile ? undefined : `Vendor: ${order.shopName}`}
        showBack
        onBackPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('AdminOrders');
          }
        }}
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
          <Text style={styles.adminActionTitle}>ADMIN STATUS & DISPATCH ACTIONS</Text>
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

            {(order.status === 'APPROVED' || order.status === 'OUT_FOR_DELIVERY') && (
              <Button
                title={
                  order.status === 'OUT_FOR_DELIVERY'
                    ? 'Reassign Delivery Staff'
                    : 'Dispatch / Out for Delivery'
                }
                onPress={() => setDispatchModalVisible(true)}
                size="sm"
                variant={order.status === 'OUT_FOR_DELIVERY' ? 'outline' : 'primary'}
                style={styles.statusBtn}
              />
            )}
          </View>
        </Card>

        {/* Assigned Delivery Executive Card */}
        {order.assignedStaffName ? (
          <Card style={styles.card} outlined elevation="sm">
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.cardTitle}>ASSIGNED DELIVERY EXECUTIVE</Text>
              <TouchableOpacity
                onPress={() => setDispatchModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.reassignText}>Change Staff</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.staffDisplayRow}>
              <View style={styles.staffAvatar}>
                <Ionicons name="bicycle" size={20} color={colors.primary} />
              </View>
              <View style={styles.staffTextCol}>
                <Text style={styles.staffNameText}>{order.assignedStaffName}</Text>
                <Text style={styles.staffSubText}>
                  {order.assignedStaffPhone ? `+91 ${order.assignedStaffPhone}` : 'Delivery Staff'}
                </Text>
              </View>
              <View style={styles.dispatchedBadge}>
                <Text style={styles.dispatchedBadgeText}>
                  {order.status === 'OUT_FOR_DELIVERY' ? 'ON ROUTE' : 'ASSIGNED'}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Vendor Profile & Delivery Details */}
        {!hideVendorProfile && (
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardTitle}>CUSTOMER VENDOR PROFILE</Text>
            <Text style={styles.shopName}>{order.shopName}</Text>
            <Text style={styles.detailText}>Proprietor: {order.vendorName}</Text>
            <Text style={styles.detailText}>Phone: {order.phone}</Text>
            {Boolean(order.address) && <Text style={styles.detailText}>Address: {order.address}</Text>}
            <Text style={styles.detailText}>Delivery Date: {formatDate(order.deliveryDate)}</Text>
          </Card>
        )}

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
            <Text style={styles.summaryVal}>₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax / GST (5%)</Text>
            <Text style={styles.summaryVal}>₹{order.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Bill</Text>
            <Text style={styles.totalVal}>₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </Card>
      </ScrollView>

      {/* Dispatch Staff Selection Modal */}
      <DispatchStaffModal
        visible={dispatchModalVisible}
        orderNumber={order.orderNumber}
        onClose={() => setDispatchModalVisible(false)}
        onConfirm={handleConfirmDispatch}
        isLoading={dispatching}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reassignText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  staffDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    gap: 12,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffTextCol: {
    flex: 1,
  },
  staffNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dispatchedBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dispatchedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
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
