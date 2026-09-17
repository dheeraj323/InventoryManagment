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
    creditLimit: 10000,
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const entries = getLedgerForParty(vendor.id);
  const runningBalance = getPartyRunningBalance(vendor.id);

  const [filter, setFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');

  const filteredEntries = entries.filter((e) => {
    if (filter === 'ALL') return true;
    return e.type === filter;
  });

  const totalGave = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalGot = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`${vendor.shopName} Ledger`}
        subtitle="Khatabook Transaction History"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            <LedgerSummaryCard
              currentBalance={runningBalance}
              totalGave={totalGave}
              totalGot={totalGot}
              partyName={vendor.shopName}
            />

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {(['ALL', 'DEBIT', 'CREDIT'] as const).map((type) => {
                const isActive = filter === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, isActive ? styles.chipActive : null]}
                    onPress={() => setFilter(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive ? styles.chipTextActive : null,
                      ]}
                    >
                      {type === 'ALL'
                        ? 'All Txns'
                        : type === 'DEBIT'
                        ? 'You Gave (Debit)'
                        : 'You Got (Credit)'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => <LedgerRow entry={item} />}
        ListEmptyComponent={
          <EmptyState
            iconName="book-outline"
            title="No Transactions Found"
            description="There are no transaction ledger records available for the selected filter."
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
    padding: spacing.screenPadding,
  },
  headerComponent: {
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 10,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
});
