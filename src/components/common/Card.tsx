import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { colors, spacing, shadows } from '../../theme';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevation?: 'none' | 'sm' | 'md';
  outlined?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevation = 'sm',
  outlined = true,
}) => {
  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.lg,
    ...(outlined ? { borderWidth: 1, borderColor: colors.border } : {}),
    ...(elevation !== 'none' ? shadows[elevation] : {}),
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[cardStyle, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
