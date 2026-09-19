import React, { useState } from 'react';
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
import { QuantitySelector } from '../../components/catalog/QuantitySelector';
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
    // Navigate to actual payment collection screen passing updated items & calculated total
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vendor Address & Contact */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>DELIVERY ADDRESS</Text>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={18} color={colors.accent} />
            <View style={styles.addressCol}>
              <Text style={styles.shopName}>{order.shopName}</Text>
              <Text style={styles.addressText}>{order.address}</Text>
              <Text style={styles.phoneText}>Phone: {order.phone}</Text>
            </View>
          </View>
        </Card>

        {/* Quantity Verification Table */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>VERIFY DELIVERED QUANTITIES</Text>
          <Text style={styles.instructionText}>
            Adjust delivered quantity if items are damaged or missing.
          </Text>

          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfoCol}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemUnit}>
                  Ordered: {item.orderedQty} x ({item.unit})
                </Text>
                {item.missingDamagedQty > 0 && (
                  <Text style={styles.missingBadge}>
                    Missing / Damaged: {item.missingDamagedQty}
                  </Text>
                )}
              </View>

              <View style={styles.qtyControlCol}>
                <Text style={styles.deliveredLabel}>Delivered Qty</Text>
                <QuantitySelector
                  quantity={item.deliveredQty}
                  onIncrease={() => handleUpdateDeliveredQty(item.id, 1)}
                  onDecrease={() => handleUpdateDeliveredQty(item.id, -1)}
                  max={item.orderedQty}
                  size="sm"
                />
              </View>
            </View>
          ))}
        </Card>

        {/* Updated Bill Total Card */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>RECALCULATED BILL TOTAL</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Original Bill Total</Text>
            <Text style={styles.summaryVal}>₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Actual Delivered Subtotal</Text>
            <Text style={styles.summaryVal}>₹{calculatedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax / GST (5%)</Text>
            <Text style={styles.summaryVal}>₹{calculatedTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>
              {hasMissingOrDamaged ? 'Partially Delivered Total' : 'Final Payable Total'}
            </Text>
            <Text style={styles.totalVal}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footerContainer}>
        <Button
          title={`Record Payment Collection  ₹${calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          onPress={handleProceedToPayment}
          size="lg"
        />
      </View>
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
  instructionText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  addressCol: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phoneText: {
    ...typography.captionBold,
    color: colors.accent,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  itemUnit: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  missingBadge: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 10,
    marginTop: 2,
  },
  qtyControlCol: {
    alignItems: 'flex-end',
  },
  deliveredLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  totalVal: {
    ...typography.currencyLarge,
    color: colors.primary,
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
