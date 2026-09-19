import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { OrderCard } from '../../components/orders/OrderCard';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { OrderStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const VendorOrdersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getOrdersByVendor } = useOrderStore();
  const { activeVendorId } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const vendorOrders = getOrdersByVendor(activeVendorId);

  const filters = ['ALL', 'PENDING', 'APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  const filteredOrders = vendorOrders.filter((order) => {
    if (selectedFilter === 'ALL') return true;
    return order.status === selectedFilter;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Order History"
        subtitle={`${vendorOrders.length} Orders Placed`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {/* Filter Tabs */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List (Zomato Inspired) */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            showVendorName={false}
            showOrderId={true}
            onPress={() =>
              navigation.navigate('VendorOrderDetail', { orderId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            iconName="receipt-outline"
            title="No Orders Found"
            description="You don't have any orders matching the selected status filter."
            actionTitle="BROWSE CATALOG"
            onAction={() => navigation.navigate('ProductCatalog')}
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
