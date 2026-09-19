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
import { useCartStore } from '../../store/useCartStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useVendorStore } from '../../store/useVendorStore';
import { PAYMENT_METHOD_LABELS, BUSINESS_RULES } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PaymentMethod } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const CheckoutScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { items, getSubtotal, getTax, getTotal, clearCart } = useCartStore();
  const { createOrder } = useOrderStore();
  const { activeVendorId } = useAuthStore();
  const { getPartyRunningBalance, addEntry } = useLedgerStore();
  const { getVendorById } = useVendorStore();

  const vendor = getVendorById(activeVendorId) || {
    id: activeVendorId || 'vendor-1',
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '+91 99887 76655',
    address: 'Shop #12, Central Market, Sector 14, City',
    area: 'Sector 14',
    currentBalance: 3450,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };
  const runningBalance = getPartyRunningBalance(vendor.id);

  const totalAmount = getTotal();
  const subtotal = getSubtotal();
  const tax = getTax();

  // Next business day calculation
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDeliveryDate = tomorrow.toISOString().split('T')[0];

  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMethod>(
    vendor.payLaterEligible ? 'PAY_LATER' : 'CASH'
  );
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    setErrorMsg('');

    // Delivery date validation
    if (!deliveryDate.trim()) {
      setErrorMsg('Please enter a valid delivery date.');
      return;
    }

    setLoading(true);

    try {
      const newOrder = await createOrder({
        vendorId: vendor.id,
        vendorName: vendor.name,
        shopName: vendor.shopName,
        phone: vendor.phone,
        address: vendor.address,
        items,
        subtotal,
        tax,
        discount: 0,
        totalAmount,
        status: 'PENDING',
        preferredPaymentMode: selectedPaymentMode,
        paidAmount: selectedPaymentMode === 'CASH' || selectedPaymentMode === 'ONLINE' ? totalAmount : 0,
        balanceDue: selectedPaymentMode === 'PAY_LATER' ? totalAmount : 0,
        orderDate: new Date().toISOString(),
        deliveryDate,
        assignedStaffId: 'staff-1',
        assignedStaffName: 'Suresh Kumar',
        notes: notes.trim() || '',
      });

      // If Pay Later, record ledger debit entry immediately
      if (selectedPaymentMode === 'PAY_LATER') {
        await addEntry({
          partyId: vendor.id,
          partyName: vendor.shopName,
          partyType: 'VENDOR',
          type: 'DEBIT',
          amount: totalAmount,
          referenceNo: newOrder.orderNumber,
          orderId: newOrder.id,
          date: new Date().toISOString(),
          note: `Pay Later order ${newOrder.orderNumber}`,
          paymentMethod: 'PAY_LATER',
          createdBy: vendor.name,
          createdRole: 'VENDOR',
        });
      }

      clearCart();
      setLoading(false);

      navigation.reset({
        index: 0,
        routes: [
          { name: 'VendorDashboard' },
          { name: 'VendorOrderDetail', params: { orderId: newOrder.id } },
        ],
      });
    } catch (err: any) {
      console.error('Checkout place order error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Delivery & Payment"
        subtitle="Finalize Wholesale Order"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cutoff Window Reminder */}
        <View style={styles.cutoffBanner}>
          <Ionicons name="time-outline" size={16} color={colors.statusPendingText} />
          <Text style={styles.cutoffText}>{BUSINESS_RULES.ORDER_CUTOFF_LABEL}</Text>
        </View>

        {/* Delivery Details Section */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>DELIVERY SCHEDULE & ADDRESS</Text>
          <Input
            label="Requested Delivery Date (YYYY-MM-DD)"
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="YYYY-MM-DD"
            leftIcon={<Ionicons name="calendar-outline" size={18} color={colors.textMuted} />}
          />
          <View style={styles.addressBox}>
            <Ionicons name="location-outline" size={18} color={colors.accent} />
            <View style={styles.addressCol}>
              <Text style={styles.addressTitle}>{vendor.shopName}</Text>
              <Text style={styles.addressText}>{vendor.address}</Text>
            </View>
          </View>
          <Input
            label="Special Delivery Notes (Optional)"
            placeholder="e.g. Call before arrival or back gate entry"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Payment Preferences Section */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>SELECT PAYMENT METHOD</Text>

          {(['PAY_LATER', 'CASH', 'ONLINE'] as PaymentMethod[]).map((mode) => {
            const isSelected = selectedPaymentMode === mode;
            const isPayLaterDisabled = mode === 'PAY_LATER' && !vendor.payLaterEligible;

            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.paymentOption,
                  isSelected ? styles.paymentOptionSelected : null,
                  isPayLaterDisabled ? styles.paymentOptionDisabled : null,
                ]}
                onPress={() => {
                  if (!isPayLaterDisabled) setSelectedPaymentMode(mode);
                }}
                activeOpacity={0.8}
                disabled={isPayLaterDisabled}
              >
                <View style={styles.radioCircle}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                <View style={styles.paymentCol}>
                  <Text
                    style={[
                      styles.paymentName,
                      isPayLaterDisabled ? styles.disabledText : null,
                    ]}
                  >
                    {PAYMENT_METHOD_LABELS[mode]}
                  </Text>
                  {mode === 'PAY_LATER' && (
                    <Text style={styles.paymentSubtext}>
                      Add to shop Khata balance for periodic settlement.
                    </Text>
                  )}
                  {mode === 'CASH' && (
                    <Text style={styles.paymentSubtext}>
                      Pay cash on spot to delivery executive.
                    </Text>
                  )}
                  {mode === 'ONLINE' && (
                    <Text style={styles.paymentSubtext}>
                      UPI / Online transfer at time of delivery.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Order Grand Total summary */}
        <Card style={styles.card} outlined elevation="sm">
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total Amount</Text>
            <Text style={styles.totalVal}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </Card>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Place Order CTA Button */}
      <View style={styles.footerContainer}>
        <Button
          title={`Confirm & Place Order  ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          onPress={handlePlaceOrder}
          loading={loading}
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
  scrollContent: {
    padding: spacing.screenPadding,
  },
  cutoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  cutoffText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    marginLeft: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginBottom: spacing.md,
  },
  addressCol: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  addressTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accentLight,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surfaceSubtle,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentCol: {
    flex: 1,
  },
  paymentName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  disabledText: {
    color: colors.textMuted,
  },
  paymentSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  totalVal: {
    ...typography.currencyLarge,
    color: colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.captionBold,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
