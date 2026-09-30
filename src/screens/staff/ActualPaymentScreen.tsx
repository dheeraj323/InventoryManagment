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
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

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
  const vendorAdvanceAvailable =
    vendor?.advanceBalance && vendor.advanceBalance > 0
      ? vendor.advanceBalance
      : vendor?.currentBalance && vendor.currentBalance < 0
      ? Math.abs(vendor.currentBalance)
      : 0;

  const totalAvailableAdvance = Math.max(
    order?.advanceAdjusted || 0,
    vendorAdvanceAvailable,
    order?.preferredPaymentMode === 'ADVANCE' ? (order?.totalAmount || totalOrderValue) : 0
  );
  const effectiveAdvanceAdjusted = Math.min(totalOrderValue, totalAvailableAdvance);
  const remainingPayable = Math.max(0, totalOrderValue - effectiveAdvanceAdjusted);
  const isFullyCoveredByAdvance =
    (order?.preferredPaymentMode === 'ADVANCE' || effectiveAdvanceAdjusted > 0) &&
    remainingPayable === 0;
  const isPartiallyCoveredByAdvance =
    effectiveAdvanceAdjusted > 0 && remainingPayable > 0;

  const [actualMethod, setActualMethod] = useState<PaymentMethod>(() => {
    if (isFullyCoveredByAdvance) return 'ADVANCE';
    if (order?.preferredPaymentMode === 'ADVANCE') return 'CASH';
    return order?.preferredPaymentMode || 'CASH';
  });

  const [amountCollectedStr, setAmountCollectedStr] = useState<string>(() => {
    if (isFullyCoveredByAdvance) return '0';
    if (order?.preferredPaymentMode === 'PAY_LATER' || order?.preferredPaymentMode === 'PENDING') {
      return '0';
    }
    return remainingPayable.toString();
  });

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
    const collectedNum = isFullyCoveredByAdvance ? 0 : parseFloat(amountCollectedStr);
    if (isNaN(collectedNum) || collectedNum < 0) {
      setErrorMsg('Please enter a valid collected amount (0 or positive).');
      return;
    }

    if (!isFullyCoveredByAdvance && (actualMethod === 'CASH' || actualMethod === 'ONLINE')) {
      if (collectedNum > remainingPayable + 0.01) {
        setErrorMsg(
          `Collected amount (₹${collectedNum.toLocaleString('en-IN')}) cannot exceed the remaining payable balance of ₹${remainingPayable.toLocaleString('en-IN')}.`
        );
        return;
      }
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
        isFullyCoveredByAdvance ? 'ADVANCE' : actualMethod,
        isFullyCoveredByAdvance ? 0 : collectedNum,
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
        getFriendlyErrorMessage(err, 'Failed to record delivery. Please try again.')
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
          {/* Notice Banner */}
          {isFullyCoveredByAdvance ? (
            <View style={[styles.noticeBanner, styles.advanceBannerGreen]}>
              <Ionicons name="wallet" size={20} color={colors.brandGreen} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.noticeTitle, { color: colors.brandGreen }]}>
                  100% Pre-Paid via Advance Deposit (₹{effectiveAdvanceAdjusted.toLocaleString('en-IN')})
                </Text>
                <Text style={[styles.noticeSub, { color: '#166534' }]}>
                  The entire bill of ₹{totalOrderValue.toLocaleString('en-IN')} is fully covered by vendor advance deposit. Do NOT collect cash or online payment from vendor.
                </Text>
              </View>
            </View>
          ) : isPartiallyCoveredByAdvance ? (
            <View style={[styles.noticeBanner, styles.advanceBannerAmber]}>
              <Ionicons name="wallet-outline" size={20} color="#0284C7" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.noticeTitle, { color: '#0369A1' }]}>
                  Partial Advance Applied: ₹{effectiveAdvanceAdjusted.toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.noticeSub, { color: '#0369A1' }]}>
                  Total Bill: ₹{totalOrderValue.toLocaleString('en-IN')} · Advance Deducted: -₹{effectiveAdvanceAdjusted.toLocaleString('en-IN')} · Collect Remaining: ₹{remainingPayable.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noticeBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
              <Text style={styles.noticeText}>
                Vendor Preferred: {PAYMENT_METHOD_LABELS[order.preferredPaymentMode] || order.preferredPaymentMode}. Record the actual payment method received at shop counter.
              </Text>
            </View>
          )}

          {/* Payment Method Section */}
          {isFullyCoveredByAdvance ? (
            <Card style={styles.card} outlined elevation="sm">
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>ACTUAL PAYMENT METHOD (LOCKED)</Text>
                <View style={styles.lockedPill}>
                  <Ionicons name="lock-closed" size={11} color={colors.brandGreen} />
                  <Text style={styles.lockedPillText}>Auto-Locked</Text>
                </View>
              </View>

              <View style={styles.lockedMethodBox}>
                <View style={styles.lockedIconWrap}>
                  <Ionicons name="wallet" size={20} color={colors.brandGreen} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.lockedMethodName}>Advance Deposit (Pre-Paid)</Text>
                  <Text style={styles.lockedMethodSub}>
                    Payment option is locked to ADVANCE so ledger entries are not double-credited.
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Card style={styles.card} outlined elevation="sm">
              <Text style={styles.cardTitle}>
                {isPartiallyCoveredByAdvance
                  ? `ACTUAL PAYMENT METHOD FOR REMAINING ₹${remainingPayable.toLocaleString('en-IN')}`
                  : 'ACTUAL PAYMENT METHOD RECEIVED'}
              </Text>

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
          )}

          {/* Amount Collected Section */}
          <Card style={styles.card} outlined elevation="sm">
            <Text style={styles.cardTitle}>
              {isFullyCoveredByAdvance ? 'COLLECTION RECORD' : 'COLLECTED AMOUNT RECORD'}
            </Text>

            {isFullyCoveredByAdvance ? (
              <View style={styles.zeroCollectionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.zeroCollectionLabel}>Amount Collected at Shop:</Text>
                  <Text style={styles.zeroCollectionValue}>₹0.00</Text>
                </View>
                <Text style={styles.zeroCollectionNote}>
                  Bill of ₹{totalOrderValue.toLocaleString('en-IN')} is already settled by advance deposit.
                </Text>
              </View>
            ) : (
              <Input
                label={
                  isPartiallyCoveredByAdvance
                    ? `Actual Cash/Online Collected for Remaining Balance (₹ max ${remainingPayable})`
                    : 'Actual Cash/Online Amount Collected (₹)'
                }
                value={amountCollectedStr}
                onChangeText={setAmountCollectedStr}
                keyboardType="numeric"
                prefix="₹"
              />
            )}

            <Input
              label="Proof / Handover Notes / Delivery Remarks"
              placeholder="e.g. Delivered to Suresh (Shop Owner)"
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
            title={
              isFullyCoveredByAdvance
                ? 'Confirm Delivery (Settled via Advance)'
                : 'Confirm Delivery & Record Payment'
            }
            onPress={handleConfirmDeliveryAndPayment}
            loading={loading}
            size="lg"
            style={[styles.submitBtn, isFullyCoveredByAdvance && styles.advanceSubmitBtn]}
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
  advanceBannerGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  advanceBannerAmber: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  noticeTitle: {
    ...typography.captionBold,
    fontSize: 12,
  },
  noticeSub: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BCF0DA',
  },
  lockedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brandGreen,
  },
  lockedMethodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  lockedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMethodName: {
    ...typography.bodyBold,
    color: colors.brandGreen,
    fontSize: 14,
  },
  lockedMethodSub: {
    ...typography.caption,
    color: '#166534',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  zeroCollectionBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginBottom: spacing.md,
  },
  zeroCollectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  zeroCollectionValue: {
    ...typography.bodyBold,
    color: colors.brandGreen,
    fontSize: 16,
  },
  zeroCollectionNote: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
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
  advanceSubmitBtn: {
    backgroundColor: colors.brandGreen,
  },
});
