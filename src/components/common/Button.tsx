import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { colors, typography, spacing, shadows } from '../../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    };

    if (fullWidth) {
      base.width = '100%';
    }

    // Size variations — lg gets XL radius for a modern feel
    if (size === 'sm') {
      base.paddingVertical = spacing.sm;
      base.paddingHorizontal = spacing.md;
      base.borderRadius = spacing.borderRadiusMd;
    } else if (size === 'lg') {
      base.paddingVertical = spacing.lg + 2;
      base.paddingHorizontal = spacing.xxl;
      base.borderRadius = spacing.borderRadiusXl;
    } else {
      base.paddingVertical = spacing.md;
      base.paddingHorizontal = spacing.lg;
      base.borderRadius = spacing.borderRadiusLg;
    }

    // Variant variations
    switch (variant) {
      case 'secondary':
        base.backgroundColor = colors.surfaceSubtle;
        base.borderWidth = 1;
        base.borderColor = colors.border;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1.5;
        base.borderColor = colors.primary;
        break;
      case 'danger':
        base.backgroundColor = colors.danger;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      case 'primary':
      default:
        base.backgroundColor = colors.primary;
        if (size === 'lg') {
          Object.assign(base, shadows.sm);
        }
        break;
    }

    if (disabled) {
      base.opacity = 0.45;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let textBase: TextStyle = {
      ...typography.bodyBold,
      textAlign: 'center',
    };

    if (size === 'sm') {
      textBase.fontSize = 13;
    } else if (size === 'lg') {
      textBase.fontSize = 15;
      textBase.fontWeight = '700';
      textBase.letterSpacing = 0.2;
    }

    switch (variant) {
      case 'secondary':
        textBase.color = colors.textPrimary;
        break;
      case 'outline':
        textBase.color = colors.primary;
        break;
      case 'danger':
        textBase.color = colors.textInverse;
        break;
      case 'ghost':
        textBase.color = colors.primary;
        break;
      case 'primary':
      default:
        textBase.color = colors.textInverse;
        break;
    }

    return textBase;
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'outline' || variant === 'secondary' || variant === 'ghost'
              ? colors.primary
              : colors.textInverse
          }
        />
      ) : (
        <>
          {icon && <View style={{ marginRight: spacing.sm }}>{icon}</View>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
