import React, { useState, useEffect } from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StaffAdvance } from '../../types';
import { Button } from '../common/Button';
import { useStaffPayrollStore, getTodayDateString } from '../../store/useStaffPayrollStore';
import { colors, typography, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

interface RepayAdvanceModalProps {
  visible: boolean;
  advance: StaffAdvance | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RepayAdvanceModal: React.FC<RepayAdvanceModalProps> = ({
  visible,
  advance,
  onClose,
  onSuccess,
}) => {
  const { repayAdvance } = useStaffPayrollStore();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [repayType, setRepayType] = useState<'CASH_RETURN' | 'ONLINE_RETURN' | 'SALARY_DEDUCTION'>('CASH_RETURN');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && advance) {
      setError('');
      const remaining = advance.remainingAmount ?? (advance.amount - (advance.amountRepaid || 0));
      setAmount(remaining.toString());
      setDate(getTodayDateString());
      setNotes('');
      setRepayType('CASH_RETURN');
    }
  }, [visible, advance]);

  if (!advance) return null;

  const remaining = advance.remainingAmount ?? (advance.amount - (advance.amountRepaid || 0));
  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const newRemaining = Math.max(0, remaining - numAmount);

  const handleFullRepayment = () => {
    setAmount(remaining.toString());
    if (error) setError('');
  };

  const handleDatePreset = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  const handleSubmit = async () => {
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid repayment amount greater than 0.');
      return;
    }
    if (numAmount > remaining) {
      setError(
        `Entered amount ₹${numAmount.toLocaleString('en-IN')} exceeds the outstanding advance of ₹${remaining.toLocaleString('en-IN')}.`
      );
      return;
    }
    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await repayAdvance({
        advanceId: advance.id,
        amount: numAmount,
        date: date.trim(),
        type: repayType,
        notes: notes.trim(),
      });

      Alert.alert(
        'Repayment Recorded',
        `₹${numAmount.toLocaleString('en-IN')} repayment recorded for ${advance.staffName}.`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'Failed to record repayment. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                {/* Drag Handle */}
                <View style={styles.sheetHandleWrap}>
                  <View style={styles.sheetHandle} />
                </View>

                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="checkmark-done" size={20} color={colors.brandGreen} />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Record Repayment</Text>
                      <Text style={styles.modalSubtitle}>
                        {advance.staffName} • {advance.advanceNumber}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Error Banner */}
                  {error ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={18} color={colors.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Advance summary card */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Advance Given:</Text>
                      <Text style={styles.summaryVal}>₹{advance.amount.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Already Repaid to Date:</Text>
                      <Text style={[styles.summaryVal, { color: colors.brandGreen }]}>
                        ₹{(advance.amountRepaid || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                      <Text style={styles.summaryLabelTotal}>Current Outstanding Due:</Text>
                      <Text style={styles.summaryValTotal}>₹{remaining.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  {/* Repayment Amount */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionLabel}>Repayment Amount (₹) *</Text>
                      <TouchableOpacity onPress={handleFullRepayment} style={styles.fullDueChip}>
                        <Ionicons name="sparkles" size={12} color={colors.accent} />
                        <Text style={styles.fullDueChipText}>
                          Pay Full Due (₹{remaining.toLocaleString('en-IN')})
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.amountInputWrap}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={(v) => {
                          setAmount(v);
                          if (error) setError('');
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                      {amount ? (
                        <TouchableOpacity
                          onPress={() => setAmount('')}
                          style={styles.clearAmountBtn}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Date */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionLabel}>Repayment Date *</Text>
                      <View style={styles.datePresets}>
                        <TouchableOpacity
                          onPress={() => handleDatePreset(0)}
                          style={[
                            styles.datePresetBtn,
                            date === getTodayDateString() && styles.datePresetBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.datePresetText,
                              date === getTodayDateString() && styles.datePresetTextActive,
                            ]}
                          >
                            Today
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDatePreset(1)}
                          style={styles.datePresetBtn}
                        >
                          <Text style={styles.datePresetText}>Yesterday</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.dateInputWrap}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={colors.textSecondary}
                        style={styles.inputLeftIcon}
                      />
                      <TextInput
                        style={styles.dateInput}
                        value={date}
                        onChangeText={setDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Repayment Type */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Settlement Channel *</Text>
                    <View style={styles.modeGrid}>
                      {(
                        [
                          {
                            type: 'CASH_RETURN',
                            label: 'Cash Return',
                            icon: 'cash-outline',
                          },
                          {
                            type: 'ONLINE_RETURN',
                            label: 'UPI / Online',
                            icon: 'phone-portrait-outline',
                          },
                          {
                            type: 'SALARY_DEDUCTION',
                            label: 'Salary Deduct',
                            icon: 'receipt-outline',
                          },
                        ] as const
                      ).map((m) => {
                        const isSelected = repayType === m.type;
                        return (
                          <TouchableOpacity
                            key={m.type}
                            style={[
                              styles.modeCard,
                              isSelected && styles.modeCardActive,
                            ]}
                            onPress={() => setRepayType(m.type)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={m.icon}
                              size={16}
                              color={isSelected ? colors.brandGreen : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.modeLabel,
                                isSelected && styles.modeLabelActive,
                              ]}
                            >
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Notes */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Remarks / Reference (Optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      multiline
                      numberOfLines={2}
                      placeholder="e.g. Returned in hand cash after route completion"
                      placeholderTextColor={colors.textMuted}
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </View>

                  {/* Impact preview */}
                  {numAmount > 0 && (
                    <View style={styles.postRepayCard}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Remaining Balance After Payment:</Text>
                        <Text
                          style={[
                            styles.summaryVal,
                            { color: newRemaining === 0 ? colors.brandGreen : colors.textPrimary },
                          ]}
                        >
                          {newRemaining === 0 ? '₹0 (Fully Settled ✓)' : `₹${newRemaining.toLocaleString('en-IN')}`}
                        </Text>
                      </View>
                    </View>
                  )}
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
                      loading
                        ? 'Processing...'
                        : numAmount > 0
                        ? `Confirm ₹${numAmount.toLocaleString('en-IN')}`
                        : 'Confirm Repayment'
                    }
                    variant="primary"
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading || numAmount <= 0 || numAmount > remaining}
                    style={styles.submitBtn}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.debitLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.captionBold,
    color: colors.danger,
    flex: 1,
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: colors.surface2,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowTotal: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  summaryLabelTotal: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryValTotal: {
    ...typography.h3,
    fontSize: 15,
    color: colors.danger,
  },
  sectionContainer: {
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullDueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fullDueChipText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  currencyPrefix: {
    ...typography.h2,
    fontSize: 22,
    color: colors.brandGreen,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    ...typography.h2,
    fontSize: 24,
    color: colors.textPrimary,
    height: '100%',
    padding: 0,
  },
  clearAmountBtn: {
    padding: 4,
  },
  datePresets: {
    flexDirection: 'row',
    gap: 6,
  },
  datePresetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePresetBtnActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  datePresetText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  datePresetTextActive: {
    ...typography.captionBold,
    color: colors.accent,
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  dateInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
    padding: 0,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
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
    fontSize: 11,
  },
  modeLabelActive: {
    color: colors.brandGreen,
  },
  notesInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 52,
    textAlignVertical: 'top',
    marginTop: spacing.xs,
  },
  postRepayCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
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
  submitBtn: {
    flex: 2,
    backgroundColor: colors.brandGreen,
  },
});
