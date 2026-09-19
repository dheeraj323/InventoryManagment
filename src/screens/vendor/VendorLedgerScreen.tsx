import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { LedgerRow } from '../../components/ledger/LedgerRow';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing } from '../../theme';

type FilterType = 'ALL' | 'DEBIT' | 'CREDIT';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DEBIT', label: 'Billed (Orders)' },
  { key: 'CREDIT', label: 'Paid (Payments)' },
];

export const VendorLedgerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getLedgerForParty, getPartyRunningBalance } = useLedgerStore();
  const { activeVendorId } = useAuthStore();
  const { getVendorById } = useVendorStore();

  const vendor = getVendorById(activeVendorId) || {
    id: activeVendorId || 'vendor-1',
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '',
    address: '',
    area: '',
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const entries = getLedgerForParty(vendor.id);
  const runningBalance = getPartyRunningBalance(vendor.id);

  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredEntries = entries.filter((e) => {
    if (filter === 'ALL') return true;
    return e.type === filter;
  });

  const totalBilled = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPaid = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Khata"
        subtitle={vendor.shopName}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Summary card */}
            <View style={styles.summaryWrap}>
              <LedgerSummaryCard
                currentBalance={runningBalance}
                totalGave={totalBilled}
                totalGot={totalPaid}
                debitLabel="Total Billed"
                creditLabel="Total Paid"
                partyName={vendor.shopName}
              />
            </View>

            {/* Segmented control filter */}
            <View style={styles.segmentContainer}>
              <View style={styles.segment}>
                {FILTERS.map((f) => {
                  const isActive = filter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.segTab, isActive && styles.segTabActive]}
                      onPress={() => setFilter(f.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.segTabText, isActive && styles.segTabTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Column labels */}
            {filteredEntries.length > 0 && (
              <View style={styles.columnLabels}>
                <Text style={styles.colLabel}>TRANSACTION</Text>
                <Text style={styles.colLabel}>AMOUNT</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <LedgerRow entry={item} perspective="VENDOR" />}
        ListEmptyComponent={
          <EmptyState
            iconName="book-outline"
            title="No Transactions"
            description="No records found for the selected filter."
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  summaryWrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // Segmented control
  segmentContainer: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusLg,
    padding: 3,
  },
  segTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: spacing.borderRadiusMd,
  },
  segTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segTabText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 12,
  },
  segTabTextActive: {
    color: colors.textPrimary,
  },

  // Column labels
  columnLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  colLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
});
