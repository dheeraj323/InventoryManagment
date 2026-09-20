import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LedgerEntry } from '../../types';
import { formatTransaction, FormattedTransaction } from '../../utils/transactionFormatter';
import { colors, typography, spacing } from '../../theme';

export interface LedgerRowProps {
  entry: LedgerEntry;
  onPress?: () => void;
  showPartyName?: boolean;
  perspective?: 'VENDOR' | 'ADMIN';
}

export const LedgerRow: React.FC<LedgerRowProps> = ({
  entry,
  onPress,
  showPartyName = false,
  perspective = 'ADMIN',
}) => {
  const t: FormattedTransaction = formatTransaction(entry, perspective);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.65}
    >
      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: t.iconBg }]}>
        <Ionicons name={t.iconName as any} size={17} color={t.iconColor} />
      </View>

      {/* Main Content (2 Clean Lines) */}
      <View style={styles.mainContent}>
        {/* Line 1: Title & Amount */}
        <View style={styles.rowTop}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title} numberOfLines={1}>
              {t.title}
            </Text>
            {t.auditInfo && (
              <View style={styles.editedDot} />
            )}
          </View>
          <Text style={[styles.amount, { color: t.color }]}>
            {t.amountWithSign}
          </Text>
        </View>

        {/* Line 2: Date/Time & Balance (Reference ID hidden from list view) */}
        <View style={styles.rowBottom}>
          <Text style={styles.subText} numberOfLines={1}>
            {t.dateFormatted} • {t.timeFormatted}
          </Text>
          <Text
            style={[
              styles.balanceText,
              t.balanceStatus === 'DUE'
                ? styles.balanceTextDue
                : styles.balanceTextSettled,
            ]}
            numberOfLines={1}
          >
            {t.balanceLabel}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
  },
  editedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
    marginLeft: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
    marginRight: spacing.sm,
  },
  balanceText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  balanceTextDue: {
    color: colors.textSecondary,
  },
  balanceTextAdvance: {
    color: colors.brandGreen,
  },
  balanceTextSettled: {
    color: colors.textMuted,
  },
});
