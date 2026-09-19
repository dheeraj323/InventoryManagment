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
import { useLedgerStore } from '../../store/useLedgerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PaymentMethod, OrderItem } from '../../types';
import { colors, typography, spacing } from '../../theme';

export const ActualPaymentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { orderId, updatedItems, calculatedTotal } = route.params || {};
  const { getOrderById, recordDelivery } = useOrderStore();
  const { addEntry } = useLedgerStore();
  const { activeStaffId, currentUser } = useAuthStore();

  const order = getOrderById(orderId);

  const [actualMethod, setActualMethod] = useState<PaymentMethod>(
    order?.preferredPaymentMode || 'CASH'
  );

  const [amountCollectedStr, setAmountCollectedStr] = useState<string>(
    order?.preferredPaymentMode === 'PAY_LATER' ? '0' : (calculatedTotal || 0).toString()
  );

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Payment Collection" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirmDeliveryAndPayment = () => {
    setErrorMsg('');
    const collectedNum = parseFloat(amountCollectedStr);
    if (isNaN(collectedNum) || collectedNum < 0) {
      setErrorMsg('Please enter a valid collected amount (0 or positive).');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // 1. Record delivery in order store
      recordDelivery(
        order.id,
        updatedItems || order.items,
        actualMethod,
        collectedNum,
        notes
      );

      // 2. If cash/online collected, record CREDIT ledger entry (You Got)
      if (collectedNum > 0) {
        addEntry({
          partyId: order.vendorId,
          partyName: order.shopName,
          partyType: 'VENDOR',
          type: 'CREDIT', // Payment received
          amount: collectedNum,
          referenceNo: `RCPT-${Date.now().toString().slice(-4)}`,
          orderId: order.id,
          date: new Date().toISOString(),
          note: `${actualMethod} collected by ${currentUser?.name || 'Staff'}`,
          paymentMethod: actualMethod,
          createdBy: currentUser?.name || 'Staff',
          createdRole: 'STAFF',
        });
      }

      setLoading(false);

      // 3. Return to Staff Dashboard
      navigation.reset({
        index: 0,
        routes: [{ name: 'StaffDashboard' }],
      });
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Record Actual Payment"
        subtitle={`Order #${order.orderNumber}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Preferred vs Actual Payment Warning */}
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.noticeText}>
            Vendor Preferred: {PAYMENT_METHOD_LABELS[order.preferredPaymentMode]}. Record the actual payment method received at shop counter.
          </Text>
        </View>

        {/* Payment Method Selector */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>ACTUAL PAYMENT METHOD RECEIVED</Text>

          {(['CASH', 'ONLINE', 'PAY_LATER', 'PARTIALLY_PAID', 'PENDING'] as PaymentMethod[]).map(
            (method) => {
              const isSelected = actualMethod === method;
              return (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodOption,
                    isSelected ? styles.methodOptionSelected : null,
                  ]}
                  onPress={() => {
                    setActualMethod(method);
                    if (method === 'PAY_LATER' || method === 'PENDING') {
                      setAmountCollectedStr('0');
                    } else if (method === 'CASH' || method === 'ONLINE') {
                      setAmountCollectedStr((calculatedTotal || order.totalAmount).toString());
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioCircle}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.methodName}>{PAYMENT_METHOD_LABELS[method]}</Text>
                </TouchableOpacity>
              );
            }
          )}
        </Card>

        {/* Amount Collected Input */}
        <Card style={styles.card} outlined elevation="sm">
          <Text style={styles.cardTitle}>COLLECTED AMOUNT RECORD</Text>
          <Input
            label="Actual Cash/Online Amount Collected (₹)"
            value={amountCollectedStr}
            onChangeText={setAmountCollectedStr}
            keyboardType="numeric"
            prefix="₹"
          />
          <Input
            label="Proof / Transaction Ref / Delivery Notes"
            placeholder="e.g. Handed cash to Suresh or UPI Txn ID"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </Card>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Confirm Delivery Button */}
      <View style={styles.footerContainer}>
        <Button
          title="Confirm Delivery & Record Payment"
          onPress={handleConfirmDeliveryAndPayment}
          loading={loading}
          size="lg"
          style={styles.submitBtn}
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  noticeText: {
    ...typography.captionBold,
    color: colors.accent,
    marginLeft: spacing.sm,
    flex: 1,
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
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  methodOptionSelected: {
    borderColor: colors.primary,
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
  methodName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
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
  },
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.navy,
    borderRadius: spacing.borderRadiusXl,
  },
});
