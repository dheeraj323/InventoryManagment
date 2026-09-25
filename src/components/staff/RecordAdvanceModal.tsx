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
import { Staff } from '../../types';
import { Button } from '../common/Button';
import { useStaffPayrollStore, getTodayDateString } from '../../store/useStaffPayrollStore';
import { colors, typography, spacing } from '../../theme';

interface RecordAdvanceModalProps {
  visible: boolean;
  staffList: Staff[];
  preselectedStaff?: Staff | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecordAdvanceModal: React.FC<RecordAdvanceModalProps> = ({
  visible,
  staffList,
  preselectedStaff,
  onClose,
  onSuccess,
}) => {
  const { giveAdvance } = useStaffPayrollStore();

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [showStaffPicker, setShowStaffPicker] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeStaffList = staffList.filter(
    (s) => s.status === 'ACTIVE' || (s.active !== false && s.status !== 'SUSPENDED')
  );

  useEffect(() => {
    if (visible) {
      setError('');
      setShowStaffPicker(false);
      setStaffSearchQuery('');
      if (preselectedStaff) {
        setSelectedStaffId(preselectedStaff.staffId || preselectedStaff.id);
      } else if (activeStaffList.length > 0) {
        setSelectedStaffId(activeStaffList[0].staffId || activeStaffList[0].id);
      }
      setDate(getTodayDateString());
      setAmount('');
      setNotes('');
    }
  }, [visible, preselectedStaff, staffList]);

  const selectedStaffObj = staffList.find(
    (s) => (s.staffId || s.id) === selectedStaffId
  );

  const filteredStaffList = activeStaffList.filter((s) =>
    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
    (s.phone && s.phone.includes(staffSearchQuery))
  );

  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const currentOutstanding = selectedStaffObj?.totalAdvanceOutstanding || 0;
  const newProjectedBalance = currentOutstanding + numAmount;
  const monthlySalary = selectedStaffObj?.monthlySalary || 0;

  const handleQuickAdd = (addition: number) => {
    const current = parseFloat(amount.replace(/,/g, '')) || 0;
    setAmount((current + addition).toString());
    if (error) setError('');
  };

  const handleSetAmount = (val: number) => {
    setAmount(val.toString());
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
      setError('Please enter a valid advance amount (₹) greater than 0.');
      return;
    }
    if (!selectedStaffObj) {
      setError('Please select a staff member.');
      return;
    }
    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await giveAdvance({
        staffId: selectedStaffObj.staffId || selectedStaffObj.id,
        staffName: selectedStaffObj.name,
        amount: numAmount,
        date: date.trim(),
        reason: notes.trim() || 'Salary Advance',
        paymentMode: 'CASH',
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        'Advance Recorded',
        `₹${numAmount.toLocaleString('en-IN')} advance recorded for ${selectedStaffObj.name}.`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record advance.');
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
                {/* Sheet Handle */}
                <View style={styles.sheetHandleWrap}>
                  <View style={styles.sheetHandle} />
                </View>

                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="cash-outline" size={20} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Give Staff Advance</Text>
                      <Text style={styles.modalSubtitle}>
                        Record salary advance disbursement
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

                  {/* Staff Selection Section */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionLabel}>Staff Member</Text>
                      {activeStaffList.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setShowStaffPicker(!showStaffPicker)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.changeStaffBtn}>
                            {showStaffPicker ? 'Close List' : 'Change Staff'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Selected Staff Card */}
                    {selectedStaffObj && (
                      <TouchableOpacity
                        style={styles.selectedStaffCard}
                        onPress={() => {
                          if (activeStaffList.length > 1) {
                            setShowStaffPicker(!showStaffPicker);
                          }
                        }}
                        activeOpacity={activeStaffList.length > 1 ? 0.7 : 1}
                      >
                        <View style={styles.staffAvatar}>
                          <Text style={styles.staffAvatarText}>
                            {selectedStaffObj.name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.staffDetails}>
                          <Text style={styles.staffName}>{selectedStaffObj.name}</Text>
                          {selectedStaffObj.phone && (
                            <Text style={styles.staffPhone}>{selectedStaffObj.phone}</Text>
                          )}
                        </View>
                        <View style={styles.staffDueContainer}>
                          <Text style={styles.staffDueLabel}>Existing Advance</Text>
                          <Text
                            style={[
                              styles.staffDueValue,
                              currentOutstanding > 0 && { color: colors.danger },
                            ]}
                          >
                            ₹{currentOutstanding.toLocaleString('en-IN')}
                          </Text>
                        </View>
                        {activeStaffList.length > 1 && (
                          <Ionicons
                            name={showStaffPicker ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textSecondary}
                            style={styles.staffChevron}
                          />
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Expandable Staff Picker Dropdown */}
                    {showStaffPicker && (
                      <View style={styles.staffPickerContainer}>
                        {activeStaffList.length > 4 && (
                          <View style={styles.searchWrap}>
                            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                            <TextInput
                              style={styles.searchInput}
                              placeholder="Search staff..."
                              placeholderTextColor={colors.textMuted}
                              value={staffSearchQuery}
                              onChangeText={setStaffSearchQuery}
                            />
                          </View>
                        )}
                        <ScrollView
                          nestedScrollEnabled
                          style={styles.staffPickerScroll}
                          showsVerticalScrollIndicator={false}
                        >
                          {filteredStaffList.map((s) => {
                            const staffKey = s.staffId || s.id;
                            const isSelected = selectedStaffId === staffKey;
                            const hasDue = (s.totalAdvanceOutstanding || 0) > 0;
                            return (
                              <TouchableOpacity
                                key={staffKey}
                                style={[
                                  styles.staffPickerItem,
                                  isSelected && styles.staffPickerItemActive,
                                ]}
                                onPress={() => {
                                  setSelectedStaffId(staffKey);
                                  setShowStaffPicker(false);
                                  setStaffSearchQuery('');
                                  if (error) setError('');
                                }}
                              >
                                <View style={styles.pickerItemLeft}>
                                  <Ionicons
                                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                    size={16}
                                    color={isSelected ? colors.accent : colors.textMuted}
                                  />
                                  <Text
                                    style={[
                                      styles.pickerItemName,
                                      isSelected && styles.pickerItemNameActive,
                                    ]}
                                  >
                                    {s.name}
                                  </Text>
                                </View>
                                {hasDue && (
                                  <Text style={styles.pickerItemDue}>
                                    Due: ₹{s.totalAdvanceOutstanding?.toLocaleString('en-IN')}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Advance Amount Input */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Advance Amount (₹) *</Text>
                    <View style={styles.amountInputWrap}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={amount}
                        onChangeText={(v) => {
                          setAmount(v);
                          if (error) setError('');
                        }}
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

                    {/* Quick Amount Suggestion Chips */}
                    <View style={styles.quickChipsRow}>
                      {[1000, 2000, 5000, 10000].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={styles.quickChip}
                          onPress={() => handleQuickAdd(val)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickChipText}>
                            +₹{val >= 1000 ? `${val / 1000}k` : val}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      {monthlySalary > 0 && (
                        <TouchableOpacity
                          style={[styles.quickChip, styles.salaryPresetChip]}
                          onPress={() => handleSetAmount(Math.round(monthlySalary / 2))}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.salaryPresetChipText}>50% Salary</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Disbursement Date */}
                  <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionLabel}>Date *</Text>
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

                  {/* Notes / Reason (Optional) */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Reason / Remarks (Optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="e.g. Personal emergency, vehicle repair, travel"
                      placeholderTextColor={colors.textMuted}
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </View>

                  {/* Financial Summary */}
                  {numAmount > 0 && (
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total After Advance:</Text>
                        <Text style={styles.summaryValueTotal}>
                          ₹{newProjectedBalance.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Footer */}
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
                        ? 'Saving...'
                        : numAmount > 0
                        ? `Give ₹${numAmount.toLocaleString('en-IN')}`
                        : 'Give Advance'
                    }
                    variant="primary"
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading || numAmount <= 0 || !selectedStaffObj}
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
    maxHeight: '88%',
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
    paddingTop: spacing.xs,
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
    backgroundColor: colors.accentLight,
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
    paddingBottom: spacing.lg,
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
  changeStaffBtn: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },
  selectedStaffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: spacing.borderRadiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  staffPhone: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  staffDueContainer: {
    alignItems: 'flex-end',
    marginRight: 4,
  },
  staffDueLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  staffDueValue: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 1,
  },
  staffChevron: {
    marginLeft: 2,
  },
  staffPickerContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    marginTop: 6,
    padding: 8,
    maxHeight: 180,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: 8,
    height: 34,
    marginBottom: 6,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 12,
    color: colors.textPrimary,
    padding: 0,
  },
  staffPickerScroll: {
    maxHeight: 130,
  },
  staffPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  staffPickerItemActive: {
    backgroundColor: colors.accentLight,
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerItemName: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  pickerItemNameActive: {
    ...typography.bodyBold,
    color: colors.accent,
  },
  pickerItemDue: {
    ...typography.caption,
    fontSize: 11,
    color: colors.danger,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 52,
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
    fontSize: 22,
    color: colors.textPrimary,
    height: '100%',
    padding: 0,
  },
  clearAmountBtn: {
    padding: 4,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  salaryPresetChip: {
    backgroundColor: colors.accentLight,
    borderColor: '#BFDBFE',
  },
  salaryPresetChipText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.accent,
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
  notesInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 44,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryCard: {
    backgroundColor: colors.surface2,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryValueTotal: {
    ...typography.h3,
    fontSize: 16,
    color: colors.danger,
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
    backgroundColor: colors.accent,
  },
});
