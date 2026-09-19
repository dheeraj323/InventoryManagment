import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

export interface QuantityModalProps {
  visible: boolean;
  productName: string;
  unit: string;
  unitPrice: number;
  initialQty: number;
  maxStock?: number;
  onConfirm: (newQty: number) => void;
  onClose: () => void;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  visible,
  productName,
  unit,
  unitPrice,
  initialQty,
  maxStock,
  onConfirm,
  onClose,
}) => {
  const [qtyStr, setQtyStr] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQtyStr(initialQty > 0 ? initialQty.toString() : '1');
      setError('');
    }
  }, [visible, initialQty]);

  const currentNumericQty = parseInt(qtyStr, 10) || 0;
  const lineTotal = currentNumericQty * unitPrice;

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setQtyStr(cleaned);

    const val = parseInt(cleaned, 10) || 0;
    if (maxStock !== undefined && val > maxStock) {
      setError(`Maximum available stock is ${maxStock} units.`);
    } else {
      setError('');
    }
  };

  const handleStep = (delta: number) => {
    const base = parseInt(qtyStr, 10) || 0;
    let next = base + delta;
    if (next < 0) next = 0;
    if (maxStock !== undefined && next > maxStock) {
      next = maxStock;
      setError(`Capped to available stock (${maxStock}).`);
    } else {
      setError('');
    }
    setQtyStr(next.toString());
  };

  const handleAddPreset = (increment: number) => {
    const base = parseInt(qtyStr, 10) || 0;
    let next = base + increment;
    if (maxStock !== undefined && next > maxStock) {
      next = maxStock;
      setError(`Capped to available stock (${maxStock}).`);
    } else {
      setError('');
    }
    setQtyStr(next.toString());
  };

  const handleSetMax = () => {
    if (maxStock !== undefined) {
      setQtyStr(maxStock.toString());
      setError('');
    }
  };

  const handleConfirm = () => {
    const parsed = parseInt(qtyStr, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid quantity.');
      return;
    }
    if (maxStock !== undefined && parsed > maxStock) {
      setError(`Cannot order more than available stock (${maxStock}).`);
      return;
    }

    onConfirm(parsed);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetContainer}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.bottomSheet}>
                {/* Drag Handle */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerTextGroup}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text style={styles.productSub}>
                      ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {unit.split(' ')[0]}
                      {maxStock !== undefined && ` · ${maxStock} in stock`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Main Stepper & Direct Input Row */}
                <View style={styles.stepperSection}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, currentNumericQty <= 0 && styles.stepperBtnDisabled]}
                    onPress={() => handleStep(-1)}
                    disabled={currentNumericQty <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={currentNumericQty <= 0 ? colors.textMuted : colors.textPrimary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.inputContainer, error ? styles.inputContainerError : null]}
                    onPress={() => inputRef.current?.focus()}
                    activeOpacity={1}
                  >
                    <TextInput
                      ref={inputRef}
                      style={styles.textInput}
                      value={qtyStr}
                      onChangeText={handleTextChange}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      autoFocus
                      maxLength={5}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={styles.unitSuffix}>{unit}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.stepperBtn,
                      maxStock !== undefined && currentNumericQty >= maxStock && styles.stepperBtnDisabled,
                    ]}
                    onPress={() => handleStep(1)}
                    disabled={maxStock !== undefined && currentNumericQty >= maxStock}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={
                        maxStock !== undefined && currentNumericQty >= maxStock
                          ? colors.textMuted
                          : colors.textPrimary
                      }
                    />
                  </TouchableOpacity>
                </View>

                {/* Error Notice if any */}
                {error ? <Text style={styles.errorNotice}>{error}</Text> : null}

                {/* Quick Presets Strip */}
                <View style={styles.presetSection}>
                  <Text style={styles.presetHeading}>QUICK ADD</Text>
                  <View style={styles.presetRow}>
                    {[10, 25, 50, 100].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={styles.presetPill}
                        onPress={() => handleAddPreset(num)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.presetText}>+{num}</Text>
                      </TouchableOpacity>
                    ))}
                    {maxStock !== undefined && maxStock > 0 && (
                      <TouchableOpacity
                        style={[styles.presetPill, styles.presetPillMax]}
                        onPress={handleSetMax}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.presetMaxText}>Max</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Bottom Action Footer */}
                <SafeAreaView style={styles.footer}>
                  <View style={styles.totalBlock}>
                    <Text style={styles.totalLabel}>Line Total</Text>
                    <Text style={styles.totalAmount}>
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      currentNumericQty === 0 && styles.removeBtn,
                    ]}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.confirmBtnText}>
                      {currentNumericQty === 0 ? 'Remove' : 'Set Quantity'}
                    </Text>
                    {currentNumericQty > 0 && (
                      <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                    )}
                  </TouchableOpacity>
                </SafeAreaView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 43, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: spacing.md,
  },
  productName: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  productSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  stepperBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    height: 48,
    minWidth: 130,
    paddingHorizontal: spacing.md,
  },
  inputContainerError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  textInput: {
    ...typography.h2,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 44,
    padding: 0,
  },
  unitSuffix: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  errorNotice: {
    ...typography.caption,
    color: colors.danger,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  presetSection: {
    marginBottom: spacing.lg,
  },
  presetHeading: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  presetPillMax: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  presetMaxText: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalBlock: {
    flex: 1,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  totalAmount: {
    ...typography.currency,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  removeBtn: {
    backgroundColor: colors.danger,
  },
  confirmBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 13,
  },
});
