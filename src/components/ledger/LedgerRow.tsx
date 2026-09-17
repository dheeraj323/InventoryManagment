import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LedgerEntry } from '../../types';
import { colors, typography, spacing } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export interface LedgerRowProps {
  entry: LedgerEntry;
  onPress?: () => void;
  showPartyName?: boolean;
}

export const LedgerRow: React.FC<LedgerRowProps> = ({
  entry,
  onPress,
  showPartyName = false,
}) => {
  const isDebit = entry.type === 'DEBIT'; // You Gave / Invoice
  const dateFormatted = new Date(entry.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          <Text style={styles.refNo}>{entry.referenceNo}</Text>
          {entry.editedAt && (
            <View style={styles.editedBadge}>
              <Ionicons name="create-outline" size={10} color={colors.textMuted} />
              <Text style={styles.editedText}>Edited</Text>
            </View>
          )}
        </View>
        {showPartyName && (
          <Text style={styles.partyName} numberOfLines={1}>
            {entry.partyName}
          </Text>
        )}
        <Text style={styles.note} numberOfLines={1}>
          {entry.note}
        </Text>
        <Text style={styles.date}>{dateFormatted}</Text>
      </View>

      <View style={styles.rightCol}>
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>{isDebit ? 'YOU GAVE' : 'YOU GOT'}</Text>
          <Text style={[styles.amount, isDebit ? styles.debitText : styles.creditText]}>
            {isDebit ? '-' : '+'}${entry.amount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceText}>
            Bal: ${entry.runningBalance.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  leftCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refNo: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editedText: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 2,
  },
  partyName: {
    ...typography.captionBold,
    color: colors.accent,
    marginTop: 2,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  amount: {
    ...typography.h3,
    fontSize: 16,
  },
  debitText: {
    color: colors.debit,
  },
  creditText: {
    color: colors.credit,
  },
  balanceContainer: {
    marginTop: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  balanceText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
