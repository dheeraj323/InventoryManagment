import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LedgerEntry } from '../../types';
import { colors, typography, spacing } from '../../theme';

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
  const isDebit = entry.type === 'DEBIT'; // Distributor gave goods / credit extended
  const accentColor = isDebit ? colors.debit : colors.brandGreen;

  const dateFormatted = new Date(entry.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
    >
      {/* Left indicator dot */}
      <View style={[styles.dot, { backgroundColor: accentColor }]} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.refNo} numberOfLines={1}>
            {entry.referenceNo}
          </Text>
          {entry.editedAt && (
            <View style={styles.editedTag}>
              <Text style={styles.editedText}>edited</Text>
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

      {/* Right: amount + running balance */}
      <View style={styles.rightCol}>
        <Text style={[styles.amountLabel, { color: accentColor }]}>
          {isDebit ? 'YOU GAVE' : 'YOU GOT'}
        </Text>
        <Text style={[styles.amount, { color: accentColor }]}>
          {isDebit ? '−' : '+'}₹{entry.amount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <View style={styles.balanceTag}>
          <Text style={styles.balanceText}>
            Bal ₹{entry.runningBalance.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.md,
    marginTop: 2,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  refNo: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  editedTag: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  editedText: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
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
    lineHeight: 17,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  rightCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  amountLabel: {
    ...typography.label,
    fontSize: 9,
    marginBottom: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  balanceTag: {
    marginTop: 4,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  balanceText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
