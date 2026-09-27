import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { openGoogleMapsView } from '../../utils/locationUtils';
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

  const handleCallStaff = () => {
    if (order.assignedStaffPhone) {
      Linking.openURL(`tel:${order.assignedStaffPhone}`);
    }
  };

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

        {/* Delivery Destination & Google Maps Pin */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>DELIVERY DESTINATION</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
            <Ionicons name="location-sharp" size={20} color={colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>{order.shopName}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                {order.address || 'No street address specified'}
              </Text>
              {(order.locationUrl || (order.latitude !== undefined && order.longitude !== undefined)) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DEF7EC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brandGreen }}>Google Maps Pin Attached</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openGoogleMapsView({
                      latitude: order.latitude,
                      longitude: order.longitude,
                      locationUrl: order.locationUrl,
                      address: order.address,
                      shopName: order.shopName,
                    })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Ionicons name="eye-outline" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>View Pin</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Delivery Executive Info — Only visible to vendor after delivery staff has been assigned */}
        {order.assignedStaffName &&
        (order.status === 'OUT_FOR_DELIVERY' ||
          order.status === 'DELIVERED' ||
          order.status === 'PARTIALLY_DELIVERED') ? (
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardTitle}>DELIVERY EXECUTIVE</Text>
            <View style={styles.staffRow}>
              <View style={styles.staffAvatar}>
                <Ionicons name="bicycle" size={22} color={colors.primary} />
              </View>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{order.assignedStaffName}</Text>
                <Text style={styles.staffSubText}>
                  {order.status === 'OUT_FOR_DELIVERY'
                    ? 'Out for delivery with your order'
                    : 'Delivered your order'}
                </Text>
              </View>
              {order.assignedStaffPhone ? (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleCallStaff}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={15} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ) : null}

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
          {order.tax > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tax / GST</Text>
              <Text style={styles.infoVal}>₹{order.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Order Amount</Text>
            <Text style={styles.infoVal}>₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          {order.advanceAdjusted && order.advanceAdjusted > 0 ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.brandGreen, fontWeight: '700' }]}>Advance Adjusted</Text>
              <Text style={[styles.infoVal, { color: colors.brandGreen, fontWeight: '700' }]}>
                - ₹{order.advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ) : null}
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>
              {order.advanceAdjusted ? 'Final Bill Amount' : 'Total Invoice Amount'}
            </Text>
            <Text style={styles.totalVal}>
              ₹{(order.finalBillAmount !== undefined ? order.finalBillAmount : Math.max(0, order.totalAmount - (order.advanceAdjusted || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Amount Paid at Counter</Text>
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
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreen,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
