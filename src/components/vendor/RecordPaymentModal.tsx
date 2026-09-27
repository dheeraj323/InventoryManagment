import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Vendor, PaymentMethod } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface RecordPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  dueAmount?: number;
  onSave: (params: {
    vendorId: string;
    amount: number;
    paymentMode: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
  }) => Promise<void> | void;
}

type PaymentModeKey = 'CASH' | 'UPI' | 'BANK';

const PAYMENT_MODES: {
  key: PaymentModeKey;
  label: string;
  paymentMode: PaymentMethod;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'CASH', label: 'Cash', paymentMode: 'CASH', icon: 'cash-outline' },
  { key: 'UPI', label: 'UPI / QR', paymentMode: 'ONLINE', icon: 'qr-code-outline' },
  { key: 'BANK', label: 'Bank Transfer', paymentMode: 'ONLINE', icon: 'card-outline' },
];

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  onClose,
  vendor,
  dueAmount,
  onSave,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [selectedModeKey, setSelectedModeKey] = useState<PaymentModeKey>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const liveDue = dueAmount !== undefined ? Math.max(0, dueAmount) : Math.max(0, vendor?.currentBalance || 0);
  const currentAdvance = vendor?.advanceBalance || (vendor?.currentBalance && vendor.currentBalance < 0 ? Math.abs(vendor.currentBalance) : 0);
  const numAmount = parseFloat(amountStr) || 0;

  const dueCleared = Math.min(numAmount, liveDue);
  const advanceAdded = numAmount > liveDue ? numAmount - liveDue : 0;
  const newAdvanceTotal = currentAdvance + advanceAdded;
  const remainingDue = Math.max(0, liveDue - numAmount);

  const handleSave = async () => {
    if (!vendor) return;
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const selectedObj =
        PAYMENT_MODES.find((m) => m.key === selectedModeKey) || PAYMENT_MODES[0];

      await onSave({
        vendorId: vendor.id,
        amount: numAmount,
        paymentMode: selectedObj.paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim()
          ? `${selectedObj.label}: ${notes.trim()}`
          : selectedModeKey !== 'CASH'
          ? `Settled via ${selectedObj.label}`
          : undefined,
      });

      setAmountStr('');
      setSelectedModeKey('CASH');
      setReferenceNumber('');
      setNotes('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="cash-outline" size={20} color={colors.brandGreen} />
                    </View>
                    <View>
                      <Text style={styles.title}>Record Payment / Advance</Text>
                      <Text style={styles.subtitle}>
                        {vendor.shopName} · {liveDue > 0
                          ? `Due: ₹${liveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : currentAdvance > 0
                          ? `Advance: ₹${currentAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : 'Settled (₹0.00)'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Form Content */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Current Account Status Notice */}
                  {liveDue === 0 && currentAdvance > 0 && (
                    <View style={[styles.zeroDueBanner, { backgroundColor: colors.accentLight }]}>
                      <Ionicons name="wallet-outline" size={20} color={colors.accent} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[styles.zeroDueTitle, { color: colors.accent }]}>
                          Available Advance: ₹{currentAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.zeroDueSub}>
                          Any additional payment recorded will increase the vendor&apos;s advance balance for future orders.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Real-time Allocation Breakdown */}
                  {numAmount > 0 && (
                    <View style={styles.allocationCard}>
                      <Text style={styles.allocationHeader}>PAYMENT ALLOCATION BREAKDOWN</Text>
                      {liveDue > 0 && (
                        <View style={styles.allocRow}>
                          <Text style={styles.allocLabel}>Pending Due Cleared:</Text>
                          <Text style={[styles.allocVal, { color: colors.debit }]}>
                            ₹{dueCleared.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                      {advanceAdded > 0 && (
                        <View style={styles.allocRow}>
                          <Text style={styles.allocLabel}>Added to Advance Balance:</Text>
                          <Text style={[styles.allocVal, { color: colors.brandGreen, fontWeight: '700' }]}>
                            +₹{advanceAdded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                      <View style={styles.allocDivider} />
                      <View style={styles.allocRow}>
                        <Text style={styles.allocTotalLabel}>
                          {remainingDue > 0 ? 'Remaining Due:' : 'New Advance Balance:'}
                        </Text>
                        <Text
                          style={[
                            styles.allocTotalVal,
                            { color: remainingDue > 0 ? colors.debit : colors.brandGreen },
                          ]}
                        >
                          ₹{(remainingDue > 0 ? remainingDue : newAdvanceTotal).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                    </View>
                  )}

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  {/* Payment Mode Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Payment Method</Text>
                    <View style={styles.modeGrid}>
                      {PAYMENT_MODES.map((mode) => {
                        const isSelected = selectedModeKey === mode.key;
                        return (
                          <TouchableOpacity
                            key={mode.key}
                            style={[styles.modeCard, isSelected && styles.modeCardActive]}
                            onPress={() => setSelectedModeKey(mode.key)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={mode.icon}
                              size={18}
                              color={isSelected ? colors.brandGreen : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.modeLabel,
                                isSelected && styles.modeLabelActive,
                              ]}
                            >
                              {mode.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.amountInputWrap}>
                    <Input
                      label="Payment / Advance Amount (₹) *"
                      keyboardType="numeric"
                      prefix="₹"
                      value={amountStr}
                      onChangeText={(v) => {
                        setAmountStr(v);
                        if (error) setError('');
                      }}
                    />

                    {liveDue > 0 && (
                      <TouchableOpacity
                        style={styles.fullDueChip}
                        onPress={() => {
                          setAmountStr(liveDue.toString());
                          if (error) setError('');
                        }}
                      >
                        <Ionicons name="sparkles" size={12} color={colors.accent} />
                        <Text style={styles.fullDueChipText}>
                          Pay Full Due (₹{liveDue.toLocaleString('en-IN')})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Input
                    label="Reference / Transaction Number (Optional)"
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                  />

                  <Input
                    label="Notes / Remarks (Optional)"
                    value={notes}
                    onChangeText={setNotes}
                  />
                </ScrollView>

                {/* Footer Buttons */}
                <View style={styles.footer}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    style={styles.cancelBtn}
                    disabled={loading}
                  />
                  <Button
                    title={
                      numAmount > 0
                        ? advanceAdded > 0 && liveDue === 0
                          ? `Deposit Advance ₹${numAmount.toLocaleString('en-IN')}`
                          : `Record ₹${numAmount.toLocaleString('en-IN')}`
                        : 'Record Payment'
                    }
                    variant="primary"
                    onPress={handleSave}
                    loading={loading}
                    disabled={loading || numAmount <= 0}
                    style={{ flex: 2, backgroundColor: colors.brandGreen }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    marginLeft: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeCardActive: {
    backgroundColor: colors.brandGreenLight,
    borderColor: colors.brandGreen,
  },
  modeLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  modeLabelActive: {
    color: colors.brandGreen,
  },
  errorText: {
    ...typography.captionBold,
    color: colors.danger,
    backgroundColor: colors.debitLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  zeroDueBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brandGreenLight,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  zeroDueTitle: {
    ...typography.bodyBold,
    color: colors.brandGreen,
    fontSize: 13,
  },
  zeroDueSub: {
    ...typography.caption,
    color: '#166534',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  overpaymentBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  overpaymentTitle: {
    ...typography.bodyBold,
    color: '#92400E',
    fontSize: 13,
  },
  overpaymentSub: {
    ...typography.caption,
    color: '#78350F',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  allocationCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  allocationHeader: {
    ...typography.captionBold,
    fontSize: 10,
    color: '#15803D',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  allocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  allocLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  allocVal: {
    ...typography.bodyBold,
    fontSize: 12,
  },
  allocDivider: {
    height: 1,
    backgroundColor: '#DCFCE7',
    marginVertical: 6,
  },
  allocTotalLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  allocTotalVal: {
    ...typography.h3,
    fontSize: 15,
  },
  amountInputWrap: {
    marginBottom: spacing.xs,
  },
  fullDueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fullDueChipText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});
