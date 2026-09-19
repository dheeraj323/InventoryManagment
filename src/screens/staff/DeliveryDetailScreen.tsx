import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../../components/common/Header';
import {
  DeliveryAddressCard,
  ProductQuantityCard,
  BillSummaryCard,
  PaymentCollectionButton,
} from '../../components/orders';
import { OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const DeliveryDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params || {};
  const { getOrderById } = useOrderStore();
  const order = getOrderById(orderId);

  const [items, setItems] = useState<OrderItem[]>(order ? order.items : []);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Delivery Record" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
});

