import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { Input } from '../common/Input';
import { Vendor } from '../../types';
import { colors, typography, spacing } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

export interface AdjustCreditLimitModalProps {
  visible: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  onSave: (vendorId: string, newLimit: number, reason: string) => Promise<void> | void;
}

export const AdjustCreditLimitModal: React.FC<AdjustCreditLimitModalProps> = ({
  visible,
  vendor,
  onClose,
  onSave,
}) => {
  const [limitStr, setLimitStr] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendor && visible) {
      setLimitStr((vendor.creditLimit || 0).toString());
      setReason('');
      setError('');
    }
  }, [vendor, visible]);

  const handleConfirm = async () => {
    if (!vendor) return;
    const num = parseFloat(limitStr);
    if (isNaN(num) || num < 0) {
      setError('Please enter a valid credit limit (0 or more).');
      return;
    }
    if (!reason.trim()) {
      setError('Audit reason is mandatory when adjusting credit limits.');
      return;
    }

    setLoading(true);
    try {
      await onSave(vendor.id, num, reason.trim());
      onClose();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'Failed to update credit limit. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) return null;

  return (
    <ConfirmationModal
      visible={visible}
      title="Adjust Credit Limit"
      message={`Modify trade credit limit for ${vendor.shopName} (${vendor.name}). All credit adjustments are recorded in the immutable audit trail.`}
      confirmTitle="Update Credit Limit"
      onConfirm={handleConfirm}
      onCancel={onClose}
      loading={loading}
    >
      <View style={styles.formContainer}>
        <Input
          label="New Credit Limit (₹)"
          value={limitStr}
          onChangeText={setLimitStr}
          keyboardType="numeric"
          prefix="₹"
        />

        <Input
          label="Mandatory Audit Reason *"
          value={reason}
          onChangeText={(v) => {
            setReason(v);
            if (error) setError('');
          }}
          multiline
          numberOfLines={2}
          error={error}
        />

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Current Outstanding: ₹{(vendor.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    </ConfirmationModal>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    marginTop: spacing.sm,
  },
  warningBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
