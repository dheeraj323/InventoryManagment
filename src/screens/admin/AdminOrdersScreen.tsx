import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useOrderStore } from '../../store/useOrderStore';
import { OrderCard } from '../../components/orders/OrderCard';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

export const AdminOrdersScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { orders } = useOrderStore();

  const getInitialFilter = () => {
    const explicit = route?.params?.initialFilter || route?.params?.filter || route?.params?.status;
    if (explicit) return explicit;
    const hasPending = orders.some((o) => o.status === 'PENDING');
    return hasPending ? 'PENDING' : 'ALL';
  };

  const [selectedFilter, setSelectedFilter] = useState<string>(getInitialFilter);

  // When explicit route params are provided or updated
  useEffect(() => {
    const explicit = route?.params?.initialFilter || route?.params?.filter || route?.params?.status;
    if (explicit) {
      setSelectedFilter(explicit);
    }
  }, [route?.params?.initialFilter, route?.params?.filter, route?.params?.status]);

  // When screen gains focus (e.g. tapping Orders tab), if there are pending orders and no explicit filter was passed, auto-select PENDING
  useFocusEffect(
    useCallback(() => {
      const explicit = route?.params?.initialFilter || route?.params?.filter || route?.params?.status;
      if (!explicit) {
        const hasPending = orders.some((o) => o.status === 'PENDING');
        if (hasPending) {
          setSelectedFilter('PENDING');
        }
      }
    }, [orders, route?.params?.initialFilter, route?.params?.filter, route?.params?.status])
  );

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const approvedCount = orders.filter((o) => o.status === 'APPROVED').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;

  const filters = [
    { key: 'ALL', label: 'All', count: orders.length },
    { key: 'PENDING', label: 'Pending', count: pendingCount },
    { key: 'APPROVED', label: 'Approved', count: approvedCount },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', count: outForDeliveryCount },
    { key: 'DELIVERED', label: 'Delivered', count: deliveredCount },
    { key: 'CANCELLED', label: 'Cancelled', count: cancelledCount },
  ];

  const filteredOrders = orders.filter((order) => {
    if (selectedFilter === 'ALL') return true;
    return order.status === selectedFilter;
  });

  const getSubtitle = () => {
    if (selectedFilter === 'PENDING') {
      return `${pendingCount} Pending ${pendingCount === 1 ? 'Order' : 'Orders'} Awaiting Action`;
    }
    return `${orders.length} Total Orders Recorded`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Order Management"
        subtitle={getSubtitle()}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
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
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            showVendorName
            onPress={() =>
              navigation.navigate('AdminOrderDetail', { orderId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            iconName="receipt-outline"
            title={
              selectedFilter === 'PENDING'
                ? 'No Pending Orders'
                : 'No Orders Found'
            }
            description={
              selectedFilter === 'PENDING'
                ? 'Great job! There are no pending orders awaiting approval.'
                : 'There are no orders matching the selected status filter.'
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
    fontSize: 10,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
  },
});
