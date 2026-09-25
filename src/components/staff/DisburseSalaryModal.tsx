import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StaffSalarySlip } from '../../types';
import { Button } from '../common/Button';
import { useStaffPayrollStore, getTodayDateString } from '../../store/useStaffPayrollStore';
import { colors, typography, spacing } from '../../theme';

interface DisburseSalaryModalProps {
  visible: boolean;
  slip: StaffSalarySlip | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DisburseSalaryModal: React.FC<DisburseSalaryModalProps> = ({
  visible,
  slip,
  onClose,
  onSuccess,
}) => {
  const { disburseSalary } = useStaffPayrollStore();

  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (slip) {
      const remainingPayable = Math.max(0, slip.netPayableSalary - (slip.paidAmount || 0));
      setPaidAmount(remainingPayable > 0 ? remainingPayable.toString() : slip.netPayableSalary.toString());
      setPaymentDate(getTodayDateString());
      setPaymentMode(slip.paymentMode || 'CASH');
      setTransactionRef(slip.transactionRef || '');
      setNotes(slip.notes || '');
    }
  }, [slip]);

  if (!slip) return null;

  const handleSubmit = async () => {
    const numAmount = parseFloat(paidAmount.replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid disbursed amount.');
      return;
    }

    if (!paymentDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate.trim())) {
      Alert.alert('Validation Error', 'Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    setLoading(true);
    try {
      await disburseSalary({
        slipId: slip.id,
        paidAmount: numAmount,
        paymentMode,
        paymentDate: paymentDate.trim(),
        transactionRef: transactionRef.trim(),
        notes: notes.trim(),
      });

      Alert.alert(
        'Salary Disbursed',
        `₹${numAmount.toLocaleString('en-IN')} paid to ${slip.staffName} for ${slip.month}.`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record salary payout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Disburse Salary</Text>
              <Text style={styles.modalSub}>{slip.staffName} • Month: {slip.month}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {/* Payslip summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Base Earned Pay:</Text>
                <Text style={styles.summaryVal}>₹{slip.earnedSalary.toLocaleString('en-IN')}</Text>
              </View>
              {slip.bonusOrIncentive > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bonus / Incentive:</Text>
                  <Text style={[styles.summaryVal, { color: colors.brandGreen }]}>
                    +₹{slip.bonusOrIncentive.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              {slip.advanceDeducted > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Advance Recovered:</Text>
                  <Text style={[styles.summaryVal, { color: colors.danger }]}>
                    -₹{slip.advanceDeducted.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryRowNet]}>
                <Text style={styles.summaryLabelNet}>Net Payable Salary:</Text>
                <Text style={styles.summaryValNet}>₹{slip.netPayableSalary.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Payout Amount */}
            <Text style={styles.inputLabel}>Paid Amount (₹) *</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={paidAmount}
                onChangeText={setPaidAmount}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Payment Date */}
            <Text style={styles.inputLabel}>Disbursement Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.textInput}
              value={paymentDate}
              onChangeText={setPaymentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />

            {/* Payment Mode */}
            <Text style={styles.inputLabel}>Payment Method *</Text>
            <View style={styles.modeRow}>
              {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => {
                const isSelected = paymentMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Ionicons
                      name={
                        mode === 'CASH'
                          ? 'cash-outline'
                          : mode === 'UPI'
                          ? 'phone-portrait-outline'
                          : 'business-outline'
                      }
                      size={15}
                      color={isSelected ? colors.brandGreen : colors.textMuted}
                    />
                    <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}>
                      {mode === 'CASH' ? 'Cash' : mode === 'UPI' ? 'UPI' : 'Bank'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Transaction Ref */}
            <Text style={styles.inputLabel}>Transaction / Reference ID (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. UPI Ref / Cheque No"
              placeholderTextColor={colors.textMuted}
              value={transactionRef}
              onChangeText={setTransactionRef}
            />

            {/* Notes */}
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              multiline
              numberOfLines={2}
              placeholder="Additional notes"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Action Buttons */}
            <View style={styles.modalActionButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={styles.modalCancelBtn}
                disabled={loading}
              />
              <Button
                title={loading ? 'Processing...' : 'Confirm Payment'}
                variant="primary"
                onPress={handleSubmit}
                style={styles.modalSubmitBtn}
                disabled={loading}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
  },
  modalSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalScroll: {
    marginTop: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowNet: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  summaryLabelNet: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryValNet: {
    ...typography.h2,
    fontSize: 18,
    color: colors.brandGreen,
  },
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    ...typography.h2,
    fontSize: 20,
    color: colors.brandGreen,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    ...typography.h2,
    fontSize: 22,
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  textInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: 6,
  },
  modeBtnActive: {
    borderColor: colors.brandGreen,
    backgroundColor: colors.brandGreenLight,
  },
  modeBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: colors.brandGreen,
  },
  notesInput: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 1,
  },
});
