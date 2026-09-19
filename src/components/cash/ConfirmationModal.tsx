import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../common/Button';
import { colors, typography, spacing } from '../../theme';

interface ConfirmationModalProps {
  visible: boolean;
  staffName: string;
  expectedCash: number;
  handedOverCash: number;
  notes?: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  staffName,
  expectedCash,
  handedOverCash,
  notes,
  loading,
  onConfirm,
  onCancel,
}) => {
  const variance = handedOverCash - expectedCash;
  const isBalanced = variance === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Top Drag Handle */}
              <View style={styles.dragHandle} />

              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
                </View>
                <Text style={styles.title}>Confirm Cash Handover</Text>
                <Text style={styles.subtitle}>
                  Review reconciliation details before final submission to admin.
                </Text>
              </View>

              <ScrollView style={styles.detailsBox} showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Staff Executive</Text>
                  <Text style={styles.detailValue}>{staffName}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expected Cash</Text>
                  <Text style={styles.detailValue}>
                    ₹{expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Actual Handed Over</Text>
                  <Text style={styles.detailValueBold}>
                    ₹{handedOverCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Variance Status</Text>
                  <Text
                    style={[
                      styles.detailValueBold,
                      isBalanced
                        ? { color: colors.brandGreen }
                        : variance > 0
                        ? { color: '#D97706' }
                        : { color: colors.danger },
                    ]}
                  >
                    {isBalanced
                      ? 'Exact Match (₹0.00)'
                      : variance > 0
                      ? `+₹${variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Excess`
                      : `-₹${Math.abs(variance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Shortage`}
                  </Text>
                </View>

                {notes ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.notesRow}>
                      <Text style={styles.detailLabel}>Bag / Notes</Text>
                      <Text style={styles.notesContent}>{notes}</Text>
                    </View>
                  </>
                ) : null}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.buttonGroup}>
                <Button
                  title="Confirm & Submit"
                  onPress={onConfirm}
                  loading={loading}
                  size="lg"
                  style={styles.submitBtn}
                />
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={loading}
                >
                  <Text style={styles.cancelBtnText}>Edit Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.borderRadiusXl,
    borderTopRightRadius: spacing.borderRadiusXl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
  },
  detailsBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  notesRow: {
    paddingVertical: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  detailValueBold: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  notesContent: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buttonGroup: {
    gap: spacing.xs,
  },
  submitBtn: {
    backgroundColor: colors.navy,
    borderRadius: spacing.borderRadiusXl,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelBtnText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
