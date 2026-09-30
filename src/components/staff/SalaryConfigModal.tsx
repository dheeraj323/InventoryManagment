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
import { Staff } from '../../types';
import { Button } from '../common/Button';
import { useStaffPayrollStore } from '../../store/useStaffPayrollStore';
import { colors, typography, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

interface SalaryConfigModalProps {
  visible: boolean;
  staff: Staff | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SalaryConfigModal: React.FC<SalaryConfigModalProps> = ({
  visible,
  staff,
  onClose,
  onSuccess,
}) => {
  const { updateSalaryConfig } = useStaffPayrollStore();

  const [salaryType, setSalaryType] = useState<'MONTHLY' | 'DAILY'>('MONTHLY');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (staff) {
      setSalaryType(staff.salaryType || 'MONTHLY');
      const sal = staff.monthlySalary || 0;
      setMonthlySalary(sal > 0 ? sal.toString() : '');
      const dRate = staff.dailyRate || (sal > 0 ? Math.round(sal / 30) : 0);
      setDailyRate(dRate > 0 ? dRate.toString() : '');
    }
  }, [staff]);

  if (!staff) return null;

  const handleMonthlyChange = (text: string) => {
    setMonthlySalary(text);
    const num = parseFloat(text.replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      setDailyRate(Math.round(num / 30).toString());
    } else {
      setDailyRate('');
    }
  };

  const handleSubmit = async () => {
    const numSalary = parseFloat(monthlySalary.replace(/,/g, '')) || 0;
    const numDaily = parseFloat(dailyRate.replace(/,/g, '')) || (numSalary > 0 ? Math.round(numSalary / 30) : 0);

    if (numSalary <= 0 && numDaily <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid salary amount.');
      return;
    }

    setLoading(true);
    try {
      await updateSalaryConfig(
        staff.staffId || staff.id,
        staff.userId,
        numSalary,
        salaryType,
        numDaily
      );

      Alert.alert('Success', `Salary configuration updated for ${staff.name}.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', getFriendlyErrorMessage(err, 'Failed to update salary configuration. Please try again.'));
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
              <Text style={styles.modalTitle}>Set Staff Salary Rate</Text>
              <Text style={styles.modalSub}>{staff.name} • {staff.activeArea || 'Delivery Team'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {/* Pay Model Type */}
            <Text style={styles.inputLabel}>Salary Structure</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, salaryType === 'MONTHLY' && styles.typeBtnActive]}
                onPress={() => setSalaryType('MONTHLY')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={salaryType === 'MONTHLY' ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.typeBtnText, salaryType === 'MONTHLY' && styles.typeBtnTextActive]}>
                  Monthly Fixed Salary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, salaryType === 'DAILY' && styles.typeBtnActive]}
                onPress={() => setSalaryType('DAILY')}
              >
                <Ionicons
                  name="today-outline"
                  size={16}
                  color={salaryType === 'DAILY' ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.typeBtnText, salaryType === 'DAILY' && styles.typeBtnTextActive]}>
                  Daily Wage Rate
                </Text>
              </TouchableOpacity>
            </View>

            {/* Monthly Salary Input */}
            <Text style={styles.inputLabel}>Base Monthly Salary (₹) *</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={monthlySalary}
                onChangeText={handleMonthlyChange}
                placeholder="e.g. 15000"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Quick Suggestions */}
            <View style={styles.chipRow}>
              {['10000', '12000', '15000', '18000', '20000', '25000'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={styles.chip}
                  onPress={() => handleMonthlyChange(val)}
                >
                  <Text style={styles.chipText}>₹{parseInt(val, 10).toLocaleString('en-IN')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Daily Equivalent Rate */}
            <Text style={styles.inputLabel}>Calculated Daily Rate (₹ / Day)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={dailyRate}
                onChangeText={setDailyRate}
                placeholder="e.g. 500"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Text style={styles.helperText}>
              Used automatically to compute per-day attendance wage and half-day deductions.
            </Text>

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
                title={loading ? 'Saving...' : 'Save Salary Config'}
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
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
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
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2F6',
  },
  typeBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  typeBtnTextActive: {
    color: colors.primary,
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
    color: colors.primary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    ...typography.h2,
    fontSize: 20,
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  helperText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 1,
  },
});
