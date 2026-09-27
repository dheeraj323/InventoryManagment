import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { OrderCard } from '../../components/orders/OrderCard';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderStatus } from '../../types';
import { isToday, isFutureDate, isOrderDeliveredToday } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

export const TodayDeliveriesScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const { getOrdersByStaff } = useOrderStore();
  const { activeStaffId, currentUser } = useAuthStore();

  const [selectedFilter, setSelectedFilter] = useState<'PENDING' | 'DELIVERED' | 'ALL'>(
    route?.params?.filter || 'PENDING'
  );

  useEffect(() => {
    if (route?.params?.filter) {
      setSelectedFilter(route.params.filter);
    }
  }, [route?.params?.filter, route?.params?.timestamp]);

  const effectiveStaffId = activeStaffId || currentUser?.staffId || currentUser?.uid || currentUser?.id || '';
  const allStaffOrders = getOrdersByStaff(effectiveStaffId);

  const isDeliveryCompleted = (status: OrderStatus) =>
    status === 'DELIVERED' || status === 'PARTIALLY_DELIVERED';
  const isDeliveryPending = (status: OrderStatus) =>
    status !== 'DELIVERED' &&
    status !== 'PARTIALLY_DELIVERED' &&
    status !== 'CANCELLED' &&
    status !== 'PENDING';

  // Active uncompleted deliveries on route (approved yesterday before midnight or today, excluding future scheduled)
  const pendingOrders = allStaffOrders.filter(
    (o) => isDeliveryPending(o.status) && !isFutureDate(o.requestedDeliveryDate || o.deliveryDate)
  );
  // Only deliveries completed TODAY
  const completedOrders = allStaffOrders.filter(
    (o) => isDeliveryCompleted(o.status) && isOrderDeliveredToday(o)
  );

  // Today's total route orders = pending deliveries + today's completed deliveries
  const todayAssignedOrders = allStaffOrders.filter((o) => {
    if (o.status === 'CANCELLED') return false;
    if (isFutureDate(o.requestedDeliveryDate || o.deliveryDate)) return false;
    if (isDeliveryCompleted(o.status)) {
      return isOrderDeliveredToday(o);
    }
    return true;
  });
  const assignedOrders = todayAssignedOrders;

  const filteredOrders =
    selectedFilter === 'PENDING'
      ? pendingOrders
      : selectedFilter === 'DELIVERED'
      ? completedOrders
      : assignedOrders;

  const filters: { key: 'PENDING' | 'DELIVERED' | 'ALL'; label: string; count: number }[] = [
    { key: 'PENDING', label: 'Pending', count: pendingOrders.length },
    { key: 'DELIVERED', label: 'Completed', count: completedOrders.length },
    { key: 'ALL', label: 'All', count: assignedOrders.length },
  ];

  const getSubtitle = () => {
    if (selectedFilter === 'PENDING') {
      return `${pendingOrders.length} Pending ${pendingOrders.length === 1 ? 'Delivery' : 'Deliveries'}`;
    }
    if (selectedFilter === 'DELIVERED') {
      return `${completedOrders.length} Completed ${completedOrders.length === 1 ? 'Delivery' : 'Deliveries'}`;
    }
    return `${assignedOrders.length} Assigned ${assignedOrders.length === 1 ? 'Shipment' : 'Shipments'}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="Today's Deliveries"
        subtitle={getSubtitle()}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        rightAction={
          <TouchableOpacity
            style={styles.spotDeliveryHeaderBtn}
            onPress={() => navigation.navigate('DirectDelivery')}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color={colors.textInverse} />
            <Text style={styles.spotDeliveryHeaderBtnText}>+ Spot Sale</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterWrapper}>
        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const isActive = selectedFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                onPress={() => setSelectedFilter(filter.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            showVendorName
            showDeliverAction
            onPress={() =>
              navigation.navigate('DeliveryDetail', { orderId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            iconName={selectedFilter === 'PENDING' ? 'checkmark-circle-outline' : 'bicycle-outline'}
            title={
              selectedFilter === 'PENDING'
                ? 'No Pending Deliveries'
                : selectedFilter === 'DELIVERED'
                ? 'No Completed Deliveries'
                : 'No Deliveries Assigned'
            }
            description={
              selectedFilter === 'PENDING'
                ? 'All assigned deliveries have been delivered or there are no pending shipments.'
                : selectedFilter === 'DELIVERED'
                ? 'You have not completed any deliveries yet today.'
                : 'You currently have no delivery shipments assigned for today\'s route.'
            }
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
  },
  spotDeliveryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  spotDeliveryHeaderBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 11,
  },
});
