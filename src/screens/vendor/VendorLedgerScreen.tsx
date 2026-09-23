import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useVendorStore } from '../../store/useVendorStore';
import { Header } from '../../components/common/Header';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { LedgerRow } from '../../components/ledger/LedgerRow';
import { TransactionDetailModal } from '../../components/ledger/TransactionDetailModal';
import { EmptyState } from '../../components/common/EmptyState';
import { LedgerEntry } from '../../types';
import { formatTransaction } from '../../utils/transactionFormatter';
import { colors, typography, spacing } from '../../theme';

type FilterType = 'ALL' | 'INVOICES' | 'PAYMENTS' | 'CREDITS' | 'ADJUSTMENTS';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'INVOICES', label: 'Invoices' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'CREDITS', label: 'Credits' },
  { key: 'ADJUSTMENTS', label: 'Adjustments' },
];

export const VendorLedgerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getLedgerForParty, getVendorAccountSummary } = useLedgerStore();
  const { activeVendorId, currentUser } = useAuthStore();
  const { getVendorById } = useVendorStore();

  const effectiveVendorId = activeVendorId || currentUser?.vendorId || 'vendor-1';
  const vendor = getVendorById(effectiveVendorId) || {
    id: effectiveVendorId,
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '',
    address: '',
    area: '',
    currentBalance: 0,
    creditLimit: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const entries = getLedgerForParty(effectiveVendorId);
  const accountSummary = getVendorAccountSummary(effectiveVendorId, vendor);

  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<LedgerEntry | null>(null);

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'ALL') return true;
    const formatted = formatTransaction(entry, 'VENDOR');

    if (filter === 'INVOICES') return formatted.category === 'invoice';
    if (filter === 'PAYMENTS') return formatted.category === 'payment';
    if (filter === 'CREDITS') return formatted.category === 'credit_note' || formatted.category === 'refund';
    if (filter === 'ADJUSTMENTS') return formatted.category === 'adjustment' || formatted.category === 'opening_balance';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Khata"
        subtitle={vendor.shopName}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {/* Summary card */}
            <LedgerSummaryCard
              currentOutstanding={accountSummary.currentOutstanding}
              currentBalance={accountSummary.lastLedgerBalance}
              totalInvoiced={accountSummary.totalDebits}
              paymentsReceived={accountSummary.totalCredits}
              overdueAmount={accountSummary.overdueAmount}
              partyName={vendor.shopName}
              perspective="VENDOR"
            />

            {/* Horizontal Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
              style={{ marginBottom: spacing.sm }}
            >
              {FILTERS.map((f) => {
                const isActive = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredEntries.length > 0 && (
              <View style={styles.transactionsHeader}>
                <Text style={styles.transactionsTitle}>
                  TRANSACTIONS ({filteredEntries.length})
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <LedgerRow
              entry={item}
              perspective="VENDOR"
              onPress={() => setSelectedTransaction(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            iconName="book-outline"
            title="No Transactions"
            description="No records found for the selected filter."
          />
        }
      />

      {/* Transaction Details Modal */}
      <TransactionDetailModal
        visible={Boolean(selectedTransaction)}
        entry={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        perspective="VENDOR"
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
  headerWrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
  },
  filterScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.textInverse,
  },
  transactionsHeader: {
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  transactionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  rowWrap: {
    backgroundColor: colors.surface,
  },
});
