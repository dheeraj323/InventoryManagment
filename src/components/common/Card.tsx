import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { colors, spacing, shadows } from '../../theme';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevation?: 'none' | 'sm' | 'md';
  outlined?: boolean;
  /**
   * variant controls the visual style:
   * - 'default'   — white bg, border, subtle shadow (original behaviour)
   * - 'flat'      — white bg, no border, no shadow (inside coloured sections)
   * - 'elevated'  — white bg, no border, stronger shadow
   * - 'tinted'    — surface2 bg, no border (Khatabook-style section backgrounds)
   */
  variant?: 'default' | 'flat' | 'elevated' | 'tinted';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevation = 'sm',
  outlined = true,
  variant = 'default',
}) => {
  const getCardStyle = (): ViewStyle => {
    const base: ViewStyle = {
      borderRadius: spacing.borderRadiusMd,
      padding: spacing.lg,
    };

    switch (variant) {
      case 'flat':
        base.backgroundColor = colors.surface;
        break;
      case 'elevated':
        base.backgroundColor = colors.surface;
        Object.assign(base, shadows.md);
        break;
      case 'tinted':
        base.backgroundColor = colors.surface2;
        break;
      case 'default':
      default:
        base.backgroundColor = colors.surface;
        if (outlined) {
          base.borderWidth = 1;
          base.borderColor = colors.border;
        }
        if (elevation !== 'none') {
          Object.assign(base, shadows[elevation]);
        }
        break;
    }

    return base;
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[getCardStyle(), style]}>{children}</View>;
};
