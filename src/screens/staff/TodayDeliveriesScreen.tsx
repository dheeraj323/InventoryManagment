import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { OrderCard } from '../../components/orders/OrderCard';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

export const TodayDeliveriesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getOrdersByStaff } = useOrderStore();
  const { activeStaffId } = useAuthStore();

  const assignedOrders = getOrdersByStaff(activeStaffId);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Today's Deliveries"
        subtitle={`${assignedOrders.length} Assigned Shipments`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={assignedOrders}
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
            iconName="bicycle-outline"
            title="No Deliveries Assigned"
            description="You currently have no delivery shipments assigned for today's route."
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
  listContent: {
    padding: spacing.screenPadding,
  },
});
