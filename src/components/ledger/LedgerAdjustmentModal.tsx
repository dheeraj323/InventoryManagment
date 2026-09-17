import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { Input } from '../common/Input';
import { LedgerEntry } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface LedgerAdjustmentModalProps {
  visible: boolean;
  entry: LedgerEntry | null;
  onClose: () => void;
  onSave: (entryId: string, newAmount: number, reason: string) => void;
}

export const LedgerAdjustmentModal: React.FC<LedgerAdjustmentModalProps> = ({
  visible,
  entry,
  onClose,
  onSave,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (entry) {
      setAmountStr(entry.amount.toString());
      setReason('');
      setError('');
    }
  }, [entry]);

  const handleConfirm = () => {
    const num = parseFloat(amountStr);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!reason.trim()) {
      setError('Audit reason is mandatory for manual ledger edits.');
      return;
    }
    if (!entry) return;

    onSave(entry.id, num, reason.trim());
    onClose();
  };

  if (!entry) return null;

  return (
    <ConfirmationModal
      visible={visible}
      title="Edit Ledger Entry"
      message={`Manually adjust amount for Txn ${entry.referenceNo} (${entry.partyName}). Every edit is logged in Audit History.`}
      confirmTitle="Save & Audit Log"
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <View style={styles.formContainer}>
        <Input
          label="New Amount ($)"
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="numeric"
          prefix="$"
        />
        <Input
          label="Mandatory Audit Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Approved discount waiver by Admin"
          multiline
          numberOfLines={2}
          error={error}
        />
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Notice: Edits will record your user identity, timestamp, and reason into the immutable system audit trail.
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
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: colors.statusPendingText,
    fontSize: 11,
  },
});
