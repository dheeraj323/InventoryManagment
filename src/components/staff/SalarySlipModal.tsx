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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, StaffSalarySlip, MonthlyAttendanceSummary } from '../../types';
import { Button } from '../common/Button';
import { useStaffPayrollStore } from '../../store/useStaffPayrollStore';
import { colors, typography, spacing, shadows } from '../../theme';

interface SalarySlipModalProps {
  visible: boolean;
  staff: Staff | null;
  month: string; // YYYY-MM
  existingSlip?: StaffSalarySlip | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  visible,
  staff,
  month,
  existingSlip,
  onClose,
  onSuccess,
}) => {
  const { getMonthlyAttendanceSummary, saveSalarySlip, advancesList } = useStaffPayrollStore();

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [baseSalary, setBaseSalary] = useState('');
  const [totalWorkingDays, setTotalWorkingDays] = useState('30');
  const [presentDays, setPresentDays] = useState('0');
  const [halfDays, setHalfDays] = useState('0');
  const [absentDays, setAbsentDays] = useState('0');
  const [leaveDays, setLeaveDays] = useState('0');

  const [bonus, setBonus] = useState('0');
  const [allowances, setAllowances] = useState('0');
  const [advanceDeduction, setAdvanceDeduction] = useState('0');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const [deductionNotes, setDeductionNotes] = useState('');
  const [notes, setNotes] = useState('');

  // Total active advance for this staff
  const staffAdvances = advancesList.filter(
    (a) =>
      a.staffId === (staff?.staffId || staff?.id) &&
      (a.status === 'ACTIVE' || a.status === 'PARTIALLY_REPAID')
  );
  const totalAdvanceOutstanding = staffAdvances.reduce(
    (acc, a) => acc + (a.remainingAmount ?? (a.amount - (a.amountRepaid || 0))),
    0
  );

  // Fetch or initialize data
  useEffect(() => {
    if (!staff || !visible) return;

    const staffKey = staff.staffId || staff.id;
    const defaultSalary = staff.monthlySalary || 0;

    if (existingSlip) {
      setBaseSalary(existingSlip.baseSalary.toString());
      setTotalWorkingDays(existingSlip.totalWorkingDays.toString());
      setPresentDays(existingSlip.presentDays.toString());
      setHalfDays(existingSlip.halfDays.toString());
      setAbsentDays(existingSlip.absentDays.toString());
      setLeaveDays(existingSlip.leaveDays.toString());
      setBonus(existingSlip.bonusOrIncentive?.toString() || '0');
      setAllowances(existingSlip.allowances?.toString() || '0');
      setAdvanceDeduction(existingSlip.advanceDeducted?.toString() || '0');
      setOtherDeductions(existingSlip.otherDeductions?.toString() || '0');
      setDeductionNotes(existingSlip.deductionNotes || '');
      setNotes(existingSlip.notes || '');
    } else {
      setBaseSalary(defaultSalary > 0 ? defaultSalary.toString() : '');
      setBonus('0');
      setAllowances('0');
      setOtherDeductions('0');
      setDeductionNotes('');
      setNotes('');

      // Auto suggest advance deduction if active advance exists
      const suggestedAdvDeduct = Math.min(totalAdvanceOutstanding, Math.round(defaultSalary * 0.3));
      setAdvanceDeduction(suggestedAdvDeduct > 0 ? suggestedAdvDeduct.toString() : '0');

      // Auto pull attendance summary from Firestore
      setLoadingSummary(true);
      getMonthlyAttendanceSummary(staffKey, month)
        .then((summary: MonthlyAttendanceSummary) => {
          setTotalWorkingDays(summary.totalDaysInMonth.toString());
          setPresentDays(summary.presentDays.toString());
          setHalfDays(summary.halfDays.toString());
          setAbsentDays(summary.absentDays.toString());
          setLeaveDays(summary.leaveDays.toString());
        })
        .catch((err) => {
          console.warn('Error fetching monthly attendance:', err);
        })
        .finally(() => {
          setLoadingSummary(false);
        });
    }
  }, [staff, month, visible, existingSlip]);

  if (!staff) return null;

  // Real-time Calculations
  const numBase = parseFloat(baseSalary) || 0;
  const numTotalDays = parseInt(totalWorkingDays, 10) || 30;
  const numPresent = parseFloat(presentDays) || 0;
  const numHalf = parseFloat(halfDays) || 0;
  const numAbsent = parseFloat(absentDays) || 0;
  const numLeave = parseFloat(leaveDays) || 0;

  const payableDays = numPresent + numHalf * 0.5;
  const dailyRate = numTotalDays > 0 ? numBase / numTotalDays : 0;
  const earnedSalary = Math.round(payableDays * dailyRate);

  const numBonus = parseFloat(bonus) || 0;
  const numAllowances = parseFloat(allowances) || 0;
  const numAdvanceDeduct = parseFloat(advanceDeduction) || 0;
  const numOtherDeduct = parseFloat(otherDeductions) || 0;

  const totalGrossEarnings = earnedSalary + numBonus + numAllowances;
  const totalDeductions = numAdvanceDeduct + numOtherDeduct;
  const netPayable = Math.max(0, totalGrossEarnings - totalDeductions);

  const handleSave = async () => {
    if (numBase <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid base salary.');
      return;
    }

    if (numAdvanceDeduct > totalAdvanceOutstanding && totalAdvanceOutstanding > 0) {
      Alert.alert(
        'Warning',
        `Advance deduction (₹${numAdvanceDeduct.toLocaleString('en-IN')}) is greater than active advance balance (₹${totalAdvanceOutstanding.toLocaleString('en-IN')}).`
      );
    }

    setSaving(true);
    try {
      const slipData: StaffSalarySlip = {
        id: existingSlip?.id || `sal_${staff.staffId || staff.id}_${month}`,
        staffId: staff.staffId || staff.id,
        staffName: staff.name,
        month,
        baseSalary: numBase,
        salaryType: staff.salaryType || 'MONTHLY',
        dailyRate: Math.round(dailyRate),
        totalWorkingDays: numTotalDays,
        presentDays: numPresent,
        halfDays: numHalf,
        absentDays: numAbsent,
        leaveDays: numLeave,
        payableDays,
        earnedSalary,
        bonusOrIncentive: numBonus,
        allowances: numAllowances,
        advanceDeducted: numAdvanceDeduct,
        otherDeductions: numOtherDeduct,
        deductionNotes: deductionNotes.trim(),
        netPayableSalary: netPayable,
        paidAmount: existingSlip?.paidAmount || 0,
        status: existingSlip?.status || 'PENDING',
        paymentMode: existingSlip?.paymentMode,
        paymentDate: existingSlip?.paymentDate,
        transactionRef: existingSlip?.transactionRef,
        notes: notes.trim(),
      };

      await saveSalarySlip(slipData);
      Alert.alert('Success', `Salary slip for ${staff.name} saved successfully.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save salary slip.');
    } finally {
      setSaving(false);
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
              <Text style={styles.modalTitle}>
                {existingSlip ? 'Edit Salary Slip' : 'Generate Monthly Payslip'}
              </Text>
              <Text style={styles.modalSub}>{staff.name} • Month: {month}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {loadingSummary && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingBannerText}>Fetching attendance record for {month}...</Text>
              </View>
            )}

            {/* Base Salary & Total Days */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Base Salary (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={baseSalary}
                  onChangeText={setBaseSalary}
                  placeholder="15000"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Total Month Days</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={totalWorkingDays}
                  onChangeText={setTotalWorkingDays}
                />
              </View>
            </View>

            {/* Attendance Breakdown for Month */}
            <Text style={styles.sectionHeader}>Month Attendance Summary</Text>
            <View style={styles.attendanceGrid}>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.brandGreen }]}>Present</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={presentDays}
                  onChangeText={setPresentDays}
                />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: '#D97706' }]}>Half Day</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={halfDays}
                  onChangeText={setHalfDays}
                />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.danger }]}>Absent</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={absentDays}
                  onChangeText={setAbsentDays}
                />
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.accent }]}>Leave</Text>
                <TextInput
                  style={styles.gridInput}
                  keyboardType="numeric"
                  value={leaveDays}
                  onChangeText={setLeaveDays}
                />
              </View>
            </View>
            <Text style={styles.payableSummaryText}>
              Payable Days: <Text style={{ fontWeight: '700' }}>{payableDays}</Text> / {numTotalDays} (Earned Base: ₹{earnedSalary.toLocaleString('en-IN')})
            </Text>

            {/* Allowances & Bonuses */}
            <Text style={styles.sectionHeader}>Additions / Bonuses</Text>
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Bonus / Incentive (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={bonus}
                  onChangeText={setBonus}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Allowance / Fuel (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={allowances}
                  onChangeText={setAllowances}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Deductions & Advance Repayment */}
            <Text style={styles.sectionHeader}>Deductions & Advance Recoveries</Text>

            {totalAdvanceOutstanding > 0 && (
              <View style={styles.advOutstandingNotice}>
                <Ionicons name="alert-circle" size={16} color="#D97706" />
                <Text style={styles.advOutstandingText}>
                  Staff has <Text style={{ fontWeight: '700' }}>₹{totalAdvanceOutstanding.toLocaleString('en-IN')}</Text> active advance due.
                </Text>
              </View>
            )}

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Advance Deducted (₹)</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: '#FECACA' }]}
                  keyboardType="numeric"
                  value={advanceDeduction}
                  onChangeText={setAdvanceDeduction}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Other Deductions (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={otherDeductions}
                  onChangeText={setOtherDeductions}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {numOtherDeduct > 0 && (
              <TextInput
                style={[styles.textInput, { marginTop: 6 }]}
                placeholder="Reason for other deductions (e.g. damages, penalty)"
                placeholderTextColor={colors.textMuted}
                value={deductionNotes}
                onChangeText={setDeductionNotes}
              />
            )}

            {/* Net Calculation Summary Card */}
            <View style={styles.calcSummaryCard}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Earned Base Pay ({payableDays} days):</Text>
                <Text style={styles.calcVal}>₹{earnedSalary.toLocaleString('en-IN')}</Text>
              </View>
              {numBonus > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>+ Bonus / Incentive:</Text>
                  <Text style={[styles.calcVal, { color: colors.brandGreen }]}>+₹{numBonus.toLocaleString('en-IN')}</Text>
                </View>
              )}
              {numAllowances > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>+ Allowances:</Text>
                  <Text style={[styles.calcVal, { color: colors.brandGreen }]}>+₹{numAllowances.toLocaleString('en-IN')}</Text>
                </View>
              )}
              {numAdvanceDeduct > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>- Advance Deducted:</Text>
                  <Text style={[styles.calcVal, { color: colors.danger }]}>-₹{numAdvanceDeduct.toLocaleString('en-IN')}</Text>
                </View>
              )}
              {numOtherDeduct > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>- Other Deductions:</Text>
                  <Text style={[styles.calcVal, { color: colors.danger }]}>-₹{numOtherDeduct.toLocaleString('en-IN')}</Text>
                </View>
              )}
              <View style={[styles.calcRow, styles.calcRowNet]}>
                <Text style={styles.calcLabelNet}>NET PAYABLE SALARY:</Text>
                <Text style={styles.calcValNet}>₹{netPayable.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={styles.modalCancelBtn}
                disabled={saving}
              />
              <Button
                title={saving ? 'Saving...' : 'Save Payslip'}
                variant="primary"
                onPress={handleSave}
                style={styles.modalSubmitBtn}
                disabled={saving}
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
    maxHeight: '92%',
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
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  loadingBannerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionHeader: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 4,
    fontSize: 11,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  attendanceGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  gridItem: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  gridLabel: {
    ...typography.captionBold,
    fontSize: 10,
    marginBottom: 4,
  },
  gridInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    width: '100%',
    textAlign: 'center',
    paddingVertical: 4,
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  payableSummaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 11,
  },
  advOutstandingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 8,
    borderRadius: 8,
    gap: 6,
    marginBottom: 6,
  },
  advOutstandingText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 11,
  },
  calcSummaryCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcRowNet: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  calcLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  calcVal: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  calcLabelNet: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  calcValNet: {
    ...typography.h2,
    fontSize: 18,
    color: colors.brandGreen,
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
