import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '../common/Button';
import { colors, spacing } from '../../theme';

interface PaymentCollectionButtonProps {
  amount: number;
  onPress: () => void;
  loading?: boolean;
  isFullyPaidByAdvance?: boolean;
  customTitle?: string;
}

export const PaymentCollectionButton: React.FC<PaymentCollectionButtonProps> = ({
  amount,
  onPress,
  loading = false,
  isFullyPaidByAdvance = false,
  customTitle,
}) => {
  const formattedAmount = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const buttonTitle =
    customTitle ||
    (isFullyPaidByAdvance
      ? 'Confirm Delivery (Paid by Advance)'
      : `Record Payment Collection  ${formattedAmount}`);

  return (
    <View style={styles.footerContainer}>
      <Button
        title={buttonTitle}
        onPress={onPress}
        loading={loading}
        size="lg"
        style={[styles.submitBtn, isFullyPaidByAdvance && styles.advanceBtn]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  footerContainer: {
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.navy,
    borderRadius: spacing.borderRadiusXl,
  },
  advanceBtn: {
    backgroundColor: colors.brandGreen,
  },
});
