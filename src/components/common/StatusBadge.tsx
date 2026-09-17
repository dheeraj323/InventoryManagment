import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ORDER_STATUS_CONFIG, PAYMENT_METHOD_LABELS } from '../../constants/rules';
import { OrderStatus, PaymentMethod } from '../../types';
import { colors, typography, spacing } from '../../theme';

export interface StatusBadgeProps {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  customLabel?: string;
  customBg?: string;
  customColor?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  paymentMethod,
  customLabel,
  customBg,
  customColor,
  size = 'md',
}) => {
  let label = customLabel || 'N/A';
  let bgColor = customBg || colors.surfaceSubtle;
  let textColor = customColor || colors.textSecondary;

  if (status && ORDER_STATUS_CONFIG[status]) {
    const config = ORDER_STATUS_CONFIG[status];
    label = config.label;
    bgColor = config.bg;
    textColor = config.color;
  } else if (paymentMethod) {
    label = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;
    if (paymentMethod === 'CASH' || paymentMethod === 'ONLINE') {
      bgColor = colors.statusDeliveredBg;
      textColor = colors.statusDeliveredText;
    } else if (paymentMethod === 'PAY_LATER') {
      bgColor = colors.statusApprovedBg;
      textColor = colors.statusApprovedText;
    } else if (paymentMethod === 'PARTIALLY_PAID') {
      bgColor = colors.statusPartialBg;
      textColor = colors.statusPartialText;
    } else {
      bgColor = colors.statusPendingBg;
      textColor = colors.statusPendingText;
    }
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor },
        isSmall ? styles.badgeSm : null,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
          isSmall ? styles.textSm : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadiusFull,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    ...typography.captionBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textSm: {
    fontSize: 10,
    lineHeight: 14,
  },
});
