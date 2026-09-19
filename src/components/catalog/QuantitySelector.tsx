import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

export interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  isLoading?: boolean;
  onPressQuantity?: () => void;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  min = 0,
  max,
  size = 'md',
  isLoading = false,
  onPressQuantity,
}) => {
  const isSm = size === 'sm';
  const isMin = quantity <= min;
  const isMax = max !== undefined && quantity >= max;

  return (
    <View style={[styles.container, isSm ? styles.containerSm : null]}>
      <TouchableOpacity
        style={[styles.button, isSm ? styles.buttonSm : null, (isMin || isLoading) ? styles.disabledBtn : null]}
        onPress={onDecrease}
        disabled={isMin || isLoading}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={isSm ? 14 : 18} color={isMin || isLoading ? colors.textMuted : colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressQuantity}
        disabled={!onPressQuantity || isLoading}
        style={styles.qtyContainer}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.qtyText, isSm ? styles.qtyTextSm : null]}>
            {quantity}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          isSm ? styles.buttonSm : null,
          (isMax || isLoading) ? styles.disabledBtn : null,
        ]}
        onPress={onIncrease}
        disabled={isMax || isLoading}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={isSm ? 14 : 18} color={isMax || isLoading ? colors.textMuted : colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  containerSm: {
    height: 32,
  },
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  buttonSm: {
    width: 28,
    height: 32,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  qtyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    paddingHorizontal: 4,
  },
  qtyText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  qtyTextSm: {
    fontSize: 13,
    minWidth: 24,
  },
});
