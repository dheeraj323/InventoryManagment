import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useVendorStore } from '../../store/useVendorStore';
import { useCashStore } from '../../store/useCashStore';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

type TabType = 'VENDORS' | 'SUPPLIERS' | 'COLLECTIONS';

export const AdminFinanceScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { getVendorAccountSummary } = useLedgerStore();
  const { suppliers } = useInventoryStore();
  const { vendors } = useVendorStore();
  const { settlements, getPendingSettlements } = useCashStore();

  const [activeTab, setActiveTab] = useState<TabType>('VENDORS');
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState<'ALL' | 'DUE' | 'ADVANCE'>('ALL');

  // Compute vendor financial positions
  const vendorBalances = useMemo(() => {
    return vendors.map((v) => {
      const summary = getVendorAccountSummary(v.id, v);
      return {
        ...v,
        outstanding: summary.currentOutstanding,
        advance: summary.advanceBalance,
        rawBalance: summary.lastLedgerBalance,
      };
    });
  }, [vendors, getVendorAccountSummary]);

  // Total Market Receivables
  const totalReceivables = useMemo(() => {
    return vendorBalances.reduce((sum, v) => sum + v.outstanding, 0);
  }, [vendorBalances]);

  // Total Supplier Payables
  const totalPayables = useMemo(() => {
    return suppliers.reduce(
      (sum, s) => sum + (s.balancePayable || s.outstandingPayable || 0),
      0
    );
  }, [suppliers]);

  // Pending settlements count
  const pendingSettlements = getPendingSettlements();

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return vendorBalances.filter((v) => {
      const matchesSearch =
        v.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.phone || '').includes(searchQuery);

      if (!matchesSearch) return false;
      if (vendorFilter === 'DUE') return v.outstanding > 0;
      if (vendorFilter === 'ADVANCE') return v.advance > 0;
      return true;
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [vendorBalances, searchQuery, vendorFilter]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [suppliers, searchQuery]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Screen Header ─────────────────────────────────────────── */}
      <Header
        title="Finance"
        subtitle="Receivables & Payables"
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Top Financial Balances ────────────────────────────────── */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Receivables</Text>
            <Text style={[styles.summaryAmount, { color: colors.debit }]}>
              ₹{fmt(totalReceivables)}
            </Text>
            <Text style={styles.summarySub}>From {vendorBalances.filter((v) => v.outstanding > 0).length} retailers</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Payables</Text>
            <Text style={[styles.summaryAmount, { color: colors.textPrimary }]}>
              ₹{fmt(totalPayables)}
            </Text>
            <Text style={styles.summarySub}>To {suppliers.length} suppliers</Text>
          </View>
        </View>

        {/* ── Segmented Tabs ────────────────────────────────────────── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'VENDORS' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('VENDORS');
              setSearchQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'VENDORS' && styles.tabTextActive]}>
              Vendor Dues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'SUPPLIERS' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('SUPPLIERS');
              setSearchQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'SUPPLIERS' && styles.tabTextActive]}>
              Suppliers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'COLLECTIONS' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('COLLECTIONS');
              setSearchQuery('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'COLLECTIONS' && styles.tabTextActive]}>
              Settlements
            </Text>
            {pendingSettlements.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingSettlements.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 1: VENDOR RECEIVABLES                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'VENDORS' && (
          <View>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendor by shop name..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {Boolean(searchQuery) && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sub Filter Chips */}
            <View style={styles.filterChipRow}>
              {(
                [
                  { key: 'ALL', label: 'All' },
                  { key: 'DUE', label: 'Pending Dues' },
                  { key: 'ADVANCE', label: 'Advance' },
                ] as const
              ).map((f) => {
                const isActive = vendorFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setVendorFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Vendor List */}
            {filteredVendors.length > 0 ? (
              <View style={styles.cardGroup}>
                {filteredVendors.map((v, idx) => {
                  const hasDue = v.outstanding > 0;
                  const hasAdvance = v.advance > 0;

                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.listRow,
                        idx === filteredVendors.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() =>
                        navigation.navigate('VendorDetail', { vendorId: v.id, initialTab: 'LEDGER' })
                      }
                      activeOpacity={0.65}
                    >
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {v.shopName}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {v.name || 'Retailer'} {v.phone ? `· ${v.phone}` : ''}
                        </Text>
                      </View>

                      <View style={styles.rowRight}>
                        <Text
                          style={[
                            styles.amountText,
                            hasDue
                              ? { color: colors.debit }
                              : hasAdvance
                              ? { color: colors.brandGreen }
                              : { color: colors.textMuted },
                          ]}
                        >
                          {hasDue
                            ? `Due ₹${fmt(v.outstanding)}`
                            : hasAdvance
                            ? `Adv ₹${fmt(v.advance)}`
                            : 'Settled'}
                        </Text>
                        <Text style={styles.viewKhataLabel}>View Khata →</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                iconName="storefront-outline"
                title="No vendors found"
                description="No vendors match the current search or filter."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 2: SUPPLIERS                                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'SUPPLIERS' && (
          <View>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search supplier..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {Boolean(searchQuery) && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Supplier List */}
            {filteredSuppliers.length > 0 ? (
              <View style={styles.cardGroup}>
                {filteredSuppliers.map((s, idx) => {
                  const payable = s.balancePayable || s.outstandingPayable || 0;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.listRow,
                        idx === filteredSuppliers.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => navigation.navigate('Supplier')}
                      activeOpacity={0.65}
                    >
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {s.category || s.businessName || 'Supplier'}
                        </Text>
                      </View>

                      <View style={styles.rowRight}>
                        <Text style={[styles.amountText, { color: colors.textPrimary }]}>
                          ₹{fmt(payable)}
                        </Text>
                        <Text style={styles.viewKhataLabel}>Payable</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                iconName="business-outline"
                title="No suppliers found"
                description="No suppliers match the current search."
              />
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 3: SETTLEMENTS                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'COLLECTIONS' && (
          <View>
            <View style={styles.settleBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settleBannerTitle}>Staff Cash Handovers</Text>
                <Text style={styles.settleBannerSub}>
                  {pendingSettlements.length > 0
                    ? `${pendingSettlements.length} settlement(s) awaiting verification`
                    : 'All collected cash handovers are audited'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.settleBannerBtn}
                onPress={() => navigation.navigate('StaffSettlements')}
                activeOpacity={0.8}
              >
                <Text style={styles.settleBannerBtnText}>Audit Now</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardGroup}>
              {settlements.map((s, idx) => {
                const isVerified = s.status === 'VERIFIED';
                const dateFormatted = formatDate(
                  s.settlementDate || s.date || s.createdAt
                );

                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.listRow,
                      idx === settlements.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => navigation.navigate('StaffSettlements')}
                    activeOpacity={0.65}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {s.staffName || 'Delivery Staff'}
                      </Text>
                      <Text style={styles.rowSub}>
                        {dateFormatted} · Handover
                      </Text>
                    </View>

                    <View style={styles.rowRight}>
                      <Text style={[styles.amountText, { color: colors.textPrimary }]}>
                        ₹{fmt(s.handedOverCash || s.amountHandedOver || 0)}
                      </Text>
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: isVerified ? colors.brandGreen : '#B45309' },
                        ]}
                      >
                        {isVerified ? 'Verified' : 'Pending Audit'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {settlements.length === 0 && (
                <EmptyState
                  iconName="cash-outline"
                  title="No settlements recorded"
                  description="Staff cash handovers will appear here."
                />
              )}
            </View>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Top Summary
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  summarySub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },

  // Segmented Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: spacing.borderRadiusSm,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  tabBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },

  // Filter Chips
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  chipTextActive: {
    color: colors.textInverse,
  },

  // Card Group
  cardGroup: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewKhataLabel: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 10,
    marginTop: 2,
  },
  statusTagText: {
    ...typography.captionBold,
    fontSize: 10,
    marginTop: 2,
  },

  // Settlement Banner
  settleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  settleBannerTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 1,
  },
  settleBannerSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  settleBannerBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusSm,
  },
  settleBannerBtnText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 11,
  },
});
