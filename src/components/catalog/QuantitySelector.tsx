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
  const isEditable = Boolean(onPressQuantity && !isLoading);

  return (
    <View style={[styles.container, isSm ? styles.containerSm : null]}>
      <TouchableOpacity
        style={[styles.button, isSm ? styles.buttonSm : null, (isMin || isLoading) ? styles.disabledBtn : null]}
        onPress={onDecrease}
        disabled={isMin || isLoading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Ionicons name="remove" size={isSm ? 14 : 18} color={isMin || isLoading ? colors.textMuted : colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressQuantity}
        disabled={!isEditable}
        style={[
          styles.qtyContainer,
          isSm ? styles.qtyContainerSm : null,
          isEditable ? styles.qtyContainerEditable : null,
        ]}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`Quantity: ${quantity}. Tap to type custom quantity`}
        accessibilityHint="Opens wholesale keypad to enter exact bulk quantity"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.qtyInner}>
            <Text style={[styles.qtyText, isSm ? styles.qtyTextSm : null]}>
              {quantity}
            </Text>
            {isEditable && (
              <Ionicons
                name="pencil"
                size={isSm ? 9 : 11}
                color={colors.primary}
                style={styles.pencilIcon}
              />
            )}
          </View>
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
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
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
    width: 34,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  buttonSm: {
    width: 26,
    height: 32,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  qtyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: '100%',
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceSubtle,
  },
  qtyContainerSm: {
    minWidth: 38,
    paddingHorizontal: 4,
  },
  qtyContainerEditable: {
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  qtyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  qtyText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  qtyTextSm: {
    fontSize: 13,
  },
  pencilIcon: {
    opacity: 0.8,
    marginLeft: 1,
  },
});
