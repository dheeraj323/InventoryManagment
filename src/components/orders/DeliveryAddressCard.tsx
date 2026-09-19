import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { colors, typography, spacing } from '../../theme';

interface DeliveryAddressCardProps {
  shopName: string;
  address: string;
  phone: string;
}

export const DeliveryAddressCard: React.FC<DeliveryAddressCardProps> = ({
  shopName,
  address,
  phone,
}) => {
  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch((err) =>
        console.error('Error opening dialer:', err)
      );
    }
  };

  return (
    <Card variant="flat" style={styles.card}>
      <Text style={styles.sectionHeaderTitle}>DELIVERY ADDRESS</Text>

      <View style={styles.contentRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={20} color={colors.accent} />
        </View>
        <View style={styles.addressCol}>
          <Text style={styles.shopName}>{shopName}</Text>
          <Text style={styles.addressText}>{address}</Text>
          <Text style={styles.phoneText}>Phone: {phone}</Text>
        </View>

        <TouchableOpacity
          style={styles.callBtn}
          onPress={handleCall}
          activeOpacity={0.8}
          accessibilityLabel={`Call ${shopName}`}
        >
          <Ionicons name="call" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  addressCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  shopName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  addressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  phoneText: {
    ...typography.captionBold,
    color: colors.accent,
    marginTop: 4,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
