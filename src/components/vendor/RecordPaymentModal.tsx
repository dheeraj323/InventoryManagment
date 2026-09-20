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

  const liveDue = dueAmount !== undefined ? dueAmount : (vendor?.currentBalance || 0);
  const numAmount = parseFloat(amountStr) || 0;
  const isOverpayment = liveDue > 0 && numAmount > liveDue;
  const isZeroDue = liveDue <= 0;

  const handleSave = async () => {
    if (!vendor) return;
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (isZeroDue) {
      setError(`Cannot record payment: ${vendor.shopName} has no pending dues (₹0.00).`);
      return;
    }

    if (numAmount > liveDue) {
      setError(
        `Amount ₹${numAmount.toLocaleString('en-IN')} exceeds the pending due of ₹${liveDue.toLocaleString('en-IN')}. Advance payments are not permitted.`
      );
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
                      <Text style={styles.title}>Record Payment</Text>
                      <Text style={styles.subtitle}>
                        {vendor.shopName} · {liveDue > 0
                          ? `Due: ₹${liveDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : 'No Dues Pending (₹0.00)'}
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
                  {/* Zero Due Notice */}
                  {isZeroDue && (
                    <View style={styles.zeroDueBanner}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.brandGreen} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={styles.zeroDueTitle}>All Dues Cleared (₹0.00)</Text>
                        <Text style={styles.zeroDueSub}>
                          This vendor has no outstanding balance. Advance payments or excess credit cannot be recorded.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Overpayment Real-time Warning */}
                  {isOverpayment && (
                    <View style={styles.overpaymentBanner}>
                      <Ionicons name="warning" size={20} color="#B45309" />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={styles.overpaymentTitle}>⚠️ Overpayment Warning</Text>
                        <Text style={styles.overpaymentSub}>
                          The entered amount (₹{numAmount.toLocaleString('en-IN')}) exceeds the outstanding due of ₹{liveDue.toLocaleString('en-IN')}. Advance balance is not allowed. Maximum payable is ₹{liveDue.toLocaleString('en-IN')}.
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
                      label="Payment Amount (₹) *"
                      keyboardType="numeric"
                      prefix="₹"
                      value={amountStr}
                      editable={!isZeroDue}
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
                    editable={!isZeroDue}
                    onChangeText={setReferenceNumber}
                  />

                  <Input
                    label="Notes / Remarks (Optional)"
                    value={notes}
                    editable={!isZeroDue}
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
                    title={isOverpayment ? 'Amount Exceeds Due' : `Record ₹${amountStr || '0'}`}
                    variant="primary"
                    onPress={handleSave}
                    loading={loading}
                    disabled={loading || isZeroDue || isOverpayment || numAmount <= 0}
                    style={{ flex: 2, backgroundColor: isOverpayment ? colors.danger : colors.brandGreen }}
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
