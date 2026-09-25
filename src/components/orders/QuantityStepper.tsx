import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

interface QuantityStepperProps {
  quantity: number;
  max?: number;
  min?: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  max,
  min = 0,
  onIncrease,
  onDecrease,
}) => {
  const isMinDisabled = quantity <= min;
  const isMaxDisabled = max !== undefined && quantity >= max;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, isMinDisabled && styles.btnDisabled]}
        onPress={onDecrease}
        disabled={isMinDisabled}
        activeOpacity={0.7}
        accessibilityLabel="Decrease delivered quantity"
      >
        <Ionicons
          name="remove"
          size={18}
          color={isMinDisabled ? colors.textMuted : colors.textPrimary}
        />
      </TouchableOpacity>

      <Text style={styles.quantityText}>{quantity}</Text>

      <TouchableOpacity
        style={[styles.btn, isMaxDisabled && styles.btnDisabled]}
        onPress={onIncrease}
        disabled={isMaxDisabled}
        activeOpacity={0.7}
        accessibilityLabel="Increase delivered quantity"
      >
        <Ionicons
          name="add"
          size={18}
          color={isMaxDisabled ? colors.textMuted : colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: spacing.borderRadiusMd,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  quantityText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm + 2,
    minWidth: 32,
    textAlign: 'center',
  },
});
