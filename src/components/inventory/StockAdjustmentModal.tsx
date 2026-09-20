import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Product } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface StockAdjustmentModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (productId: string, newStock: number, reason?: string) => Promise<void> | void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  visible,
  onClose,
  product,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'ADD' | 'REMOVE'>('ADD');
  const [qtyStr, setQtyStr] = useState('10');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && product) {
      setMode('ADD');
      setQtyStr('10');
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, product]);

  if (!product) return null;

  const currentStock = product.stockQty || 0;
  const unitLabel = product.unit || 'units';
  const delta = parseInt(qtyStr, 10) || 0;
  const newStock = mode === 'ADD' ? currentStock + delta : currentStock - delta;

  const handleSetDelta = (val: number) => {
    const safe = Math.max(0, val);
    setQtyStr(safe.toString());
    setError(null);
  };

  const handleAddDelta = (add: number) => {
    const current = parseInt(qtyStr, 10) || 0;
    handleSetDelta(current + add);
  };

  const handleSubmit = async () => {
    if (delta <= 0) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }

    if (mode === 'REMOVE' && newStock < 0) {
      setError(`Cannot remove ${delta} ${unitLabel}. Current stock is only ${currentStock} ${unitLabel}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(product.id, Math.max(0, newStock), reason.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Error adjusting stock:', err);
      setError('Failed to update stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const presetValues = [5, 10, 25, 50, 100];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalSheet}>
                {/* Drag handle */}
                <View style={styles.dragHandleRow}>
                  <View style={styles.dragHandle} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerTextCol}>
                    <Text style={styles.title} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{product.category || 'General'}</Text>
                      </View>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.unitText}>{unitLabel}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Mode Selector Tabs */}
                  <View style={styles.segmentedControl}>
                    <TouchableOpacity
                      style={[
                        styles.segmentBtn,
                        mode === 'ADD' && styles.segmentBtnActiveAdd,
                      ]}
                      onPress={() => {
                        setMode('ADD');
                        setError(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="arrow-down-circle-outline"
                        size={18}
                        color={mode === 'ADD' ? colors.textInverse : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          mode === 'ADD' && styles.segmentTextActive,
                        ]}
                      >
                        Add Stock (Receive)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.segmentBtn,
                        mode === 'REMOVE' && styles.segmentBtnActiveRemove,
                      ]}
                      onPress={() => {
                        setMode('REMOVE');
                        setError(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="arrow-up-circle-outline"
                        size={18}
                        color={mode === 'REMOVE' ? colors.textInverse : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          mode === 'REMOVE' && styles.segmentTextActive,
                        ]}
                      >
                        Remove Stock
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quantity Stepper Block */}
                  <View style={styles.stepperSection}>
                    <Text style={styles.sectionLabel}>
                      {mode === 'ADD' ? 'QUANTITY TO ADD' : 'QUANTITY TO REMOVE'}
                    </Text>

                    <View style={styles.heroStepperRow}>
                      <TouchableOpacity
                        style={[
                          styles.circleStepBtn,
                          delta <= 0 && styles.circleStepBtnDisabled,
                        ]}
                        onPress={() => handleAddDelta(-1)}
                        disabled={delta <= 0}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="remove"
                          size={24}
                          color={delta > 0 ? colors.textPrimary : colors.textMuted}
                        />
                      </TouchableOpacity>

                      <View style={styles.qtyDisplayWrapper}>
                        <TextInput
                          style={styles.heroQtyInput}
                          value={qtyStr}
                          onChangeText={(val) => {
                            const sanitized = val.replace(/[^0-9]/g, '');
                            setQtyStr(sanitized);
                            setError(null);
                          }}
                          keyboardType="number-pad"
                          placeholder="0"
                          selectTextOnFocus
                        />
                        <Text style={styles.qtyUnitLabel}>{unitLabel}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.circleStepBtn}
                        onPress={() => handleAddDelta(1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={24} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>

                    {/* Preset Chips */}
                    <View style={styles.presetsRow}>
                      {presetValues.map((preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={styles.presetChip}
                          onPress={() => handleAddDelta(preset)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetChipText}>+{preset}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={styles.presetResetChip}
                        onPress={() => handleSetDelta(0)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.presetResetText}>Reset</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Dynamic Calculation Flow Line */}
                  <View
                    style={[
                      styles.calculationBar,
                      newStock < 0 ? styles.calculationBarError : null,
                    ]}
                  >
                    <Text style={styles.calcLabel}>Stock Forecast:</Text>
                    <View style={styles.calcFlow}>
                      <Text style={styles.calcCurrentVal}>{currentStock}</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={newStock < 0 ? colors.danger : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.calcNewVal,
                          mode === 'ADD' ? styles.calcAdd : styles.calcRemove,
                          newStock < 0 ? styles.calcError : null,
                        ]}
                      >
                        {newStock} {unitLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Removal Reason Input */}
                  {mode === 'REMOVE' && (
                    <View style={styles.reasonSection}>
                      <Text style={styles.sectionLabel}>REASON FOR REMOVAL (OPTIONAL)</Text>
                      <Input
                        placeholder="e.g. Damaged goods, inventory audit correction..."
                        value={reason}
                        onChangeText={setReason}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                  )}

                  {error && <Text style={styles.errorBanner}>{error}</Text>}
                </ScrollView>

                {/* Footer Action */}
                <View style={styles.footer}>
                  <Button
                    title={
                      mode === 'ADD'
                        ? `Add ${delta > 0 ? delta : ''} ${unitLabel} to Stock`
                        : `Remove ${delta > 0 ? delta : ''} ${unitLabel} from Stock`
                    }
                    variant={mode === 'ADD' ? 'primary' : 'danger'}
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={delta <= 0 || (mode === 'REMOVE' && newStock < 0)}
                    style={styles.submitBtn}
                    icon={
                      !submitting ? (
                        <Ionicons
                          name={mode === 'ADD' ? 'checkmark-circle' : 'remove-circle'}
                          size={18}
                          color={colors.textInverse}
                        />
                      ) : undefined
                    }
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  unitText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 16,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    padding: 4,
    borderRadius: spacing.borderRadiusLg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  segmentBtnActiveAdd: {
    backgroundColor: colors.primary,
  },
  segmentBtnActiveRemove: {
    backgroundColor: colors.danger,
  },
  segmentText: {
    ...typography.captionBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textInverse,
  },
  stepperSection: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  heroStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    width: '100%',
  },
  circleStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  circleStepBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  qtyDisplayWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    minWidth: 120,
  },
  heroQtyInput: {
    ...typography.hero,
    fontSize: 34,
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  qtyUnitLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    width: '100%',
  },
  presetChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  presetChipText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.primary,
  },
  presetResetChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetResetText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  calculationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  calculationBarError: {
    backgroundColor: colors.debitLight,
    borderColor: colors.danger,
  },
  calcLabel: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  calcFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calcCurrentVal: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  calcNewVal: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  calcAdd: {
    color: colors.credit,
  },
  calcRemove: {
    color: colors.danger,
  },
  calcError: {
    color: colors.danger,
  },
  reasonSection: {
    marginBottom: spacing.md,
  },
  errorBanner: {
    ...typography.captionBold,
    color: colors.danger,
    backgroundColor: colors.debitLight,
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  submitBtn: {
    width: '100%',
  },
});
