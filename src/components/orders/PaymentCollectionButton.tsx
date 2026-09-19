import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '../common/Button';
import { colors, spacing } from '../../theme';

interface PaymentCollectionButtonProps {
  amount: number;
  onPress: () => void;
  loading?: boolean;
}

export const PaymentCollectionButton: React.FC<PaymentCollectionButtonProps> = ({
  amount,
  onPress,
  loading = false,
}) => {
  const formattedAmount = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.footerContainer}>
      <Button
        title={`Record Payment Collection  ${formattedAmount}`}
        onPress={onPress}
        loading={loading}
        size="lg"
        style={styles.submitBtn}
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
});
