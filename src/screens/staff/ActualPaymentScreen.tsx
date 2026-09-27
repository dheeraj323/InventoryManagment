import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../store/useOrderStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
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
  const { activeStaffId, currentUser } = useAuthStore();
  const { getVendorById } = useVendorStore();

  const order = getOrderById(orderId);
  const vendor = order ? getVendorById(order.vendorId) : null;
  const totalOrderValue = calculatedTotal || order?.totalAmount || 0;
  const advanceAdjusted = order?.advanceAdjusted || 0;
  const remainingPayable = Math.max(0, totalOrderValue - advanceAdjusted);

  const [actualMethod, setActualMethod] = useState<PaymentMethod>(
    order?.preferredPaymentMode || 'CASH'
  );

  const [amountCollectedStr, setAmountCollectedStr] = useState<string>(
    order?.preferredPaymentMode === 'PAY_LATER' || order?.preferredPaymentMode === 'ADVANCE'
      ? '0'
      : remainingPayable.toString()
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

  const handleConfirmDeliveryAndPayment = async () => {
    setErrorMsg('');
    const collectedNum = parseFloat(amountCollectedStr);
    if (isNaN(collectedNum) || collectedNum < 0) {
      setErrorMsg('Please enter a valid collected amount (0 or positive).');
      return;
    }

    setLoading(true);

    try {
      // recordDelivery delegates to financialTransactionService.finalizeDelivery
      // which atomically handles: order update, inventory restoration,
      // DEBIT ledger entry (invoice), CREDIT ledger entry (payment), vendor balance,
      // invoice document, and audit log — all in one Firestore transaction.
      await recordDelivery(
        order.id,
        updatedItems || order.items,
        actualMethod,
        collectedNum,
        notes
      );

      setLoading(false);

      // Navigate back to Staff Dashboard
      navigation.reset({
        index: 0,
        routes: [{ name: 'StaffDashboard' }],
      });
    } catch (err: any) {
      console.error('[ActualPaymentScreen] Delivery finalization error:', err);
      setErrorMsg(
        err.message || 'Failed to record delivery. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Record Actual Payment"
        subtitle={`Order #${order.orderNumber}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Preferred vs Actual Payment Warning */}
          <View style={styles.noticeBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <Text style={styles.noticeText}>
              Vendor Preferred: {PAYMENT_METHOD_LABELS[order.preferredPaymentMode] || order.preferredPaymentMode}. Record the actual payment method received at shop counter.
            </Text>
          </View>

          {advanceAdjusted > 0 && (
            <View style={[styles.noticeBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Ionicons name="wallet-outline" size={18} color={colors.brandGreen} />
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen }}>
                  Advance Applied: ₹{advanceAdjusted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={{ fontSize: 11, color: '#166534', marginTop: 1 }}>
                  Order Total: ₹{totalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Remaining Bill: ₹{remainingPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          )}

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
                        setAmountCollectedStr(remainingPayable.toString());
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
      </KeyboardAvoidingView>
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
