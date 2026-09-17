import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

export interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  max?: number;
  size?: 'sm' | 'md';
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  max,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  return (
    <View style={[styles.container, isSm ? styles.containerSm : null]}>
      <TouchableOpacity
        style={[styles.button, isSm ? styles.buttonSm : null]}
        onPress={onDecrease}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={isSm ? 14 : 18} color={colors.primary} />
      </TouchableOpacity>

      <Text style={[styles.qtyText, isSm ? styles.qtyTextSm : null]}>
        {quantity}
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          isSm ? styles.buttonSm : null,
          max && quantity >= max ? styles.disabledBtn : null,
        ]}
        onPress={onIncrease}
        disabled={max ? quantity >= max : false}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={isSm ? 14 : 18} color={colors.primary} />
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
