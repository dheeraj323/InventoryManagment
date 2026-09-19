import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { colors, typography, spacing } from '../../theme';

interface SettlementSuccessViewProps {
  visible: boolean;
  settlementNumber: string;
  handedOverCash: number;
  onDone: () => void;
  onViewHistory: () => void;
}

export const SettlementSuccessView: React.FC<SettlementSuccessViewProps> = ({
  visible,
  settlementNumber,
  handedOverCash,
  onDone,
  onViewHistory,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color={colors.brandGreen} />
          </View>

          <Text style={styles.title}>Handover Submitted!</Text>
          <Text style={styles.subtitle}>
            Your cash handover has been recorded and submitted for admin audit verification.
          </Text>

          <View style={styles.receiptBox}>
            <Text style={styles.refLabel}>SETTLEMENT REFERENCE</Text>
            <Text style={styles.refVal}>{settlementNumber}</Text>

            <View style={styles.divider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Handed Over Cash</Text>
              <Text style={styles.receiptAmount}>
                ₹{handedOverCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.receiptLabel}>Status</Text>
              <StatusBadge
                customLabel="Pending Verification"
                customBg="#FEF3C7"
                customColor="#D97706"
                size="sm"
              />
            </View>
          </View>

          <Button
            title="Done"
            onPress={onDone}
            size="lg"
            style={styles.doneBtn}
          />

          <TouchableOpacity style={styles.historyBtn} onPress={onViewHistory}>
            <Text style={styles.historyBtnText}>View Settlement Records</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusXl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  receiptBox: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  refLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
  },
  refVal: {
    ...typography.h3,
    color: colors.primary,
    marginTop: 2,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  receiptRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  receiptAmount: {
    ...typography.currency,
    color: colors.textPrimary,
  },
  doneBtn: {
    backgroundColor: colors.navy,
    width: '100%',
    borderRadius: spacing.borderRadiusXl,
  },
  historyBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  historyBtnText: {
    ...typography.button,
    color: colors.accent,
  },
});
