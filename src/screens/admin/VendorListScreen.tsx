import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../../store/useVendorStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useDebounce } from '../../hooks';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Vendor, VendorStatus } from '../../types';
import { colors, typography, spacing } from '../../theme';

type FilterKey = 'ALL' | 'WITH_DUES';

export const VendorListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { vendors } = useVendorStore();
  const { getVendorAccountSummary } = useLedgerStore();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');
  const debouncedSearch = useDebounce(search, 350);

  // Compute live account summaries for each vendor
  const vendorSummaries = useMemo(() => {
    return vendors.map((v) => {
      const summary = getVendorAccountSummary(v.id, v);
      const hasDues = summary.currentOutstanding > 0;

      return {
        vendor: v,
        summary,
        hasDues,
      };
    });
  }, [vendors, getVendorAccountSummary]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let totalReceivables = 0;
    let withDuesCount = 0;

    for (const item of vendorSummaries) {
      if (item.hasDues) {
        totalReceivables += item.summary.currentOutstanding;
        withDuesCount++;
      }
    }

    return {
      totalCount: vendors.length,
      totalReceivables,
      withDuesCount,
    };
  }, [vendorSummaries, vendors]);

  // Filtered Vendor List
  const filteredList = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return vendorSummaries.filter((item) => {
      const v = item.vendor;

      // Search Query Filter
      if (q.length > 0) {
        const matchesSearch =
          v.shopName.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          (v.ownerName && v.ownerName.toLowerCase().includes(q)) ||
          v.phone.includes(q);

        if (!matchesSearch) return false;
      }

      // Filter Key Selection
      if (selectedFilter === 'WITH_DUES') return item.hasDues;

      return true;
    });
  }, [vendorSummaries, debouncedSearch, selectedFilter]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const handleWhatsApp = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=${clean}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
        else Linking.openURL(`https://wa.me/${clean}`);
      })
      .catch(() => Linking.openURL(`https://wa.me/${clean}`));
  };

  const filterTabs = [
    { key: 'ALL' as FilterKey, label: 'All', count: metrics.totalCount, dotColor: undefined },
    { key: 'WITH_DUES' as FilterKey, label: 'With Dues', count: metrics.withDuesCount, dotColor: colors.warning },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Header
        title="Vendors"
        subtitle={`${vendors.length} Retail Partners`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      {/* ── Search & Filter Tabs ─────────────────────────────────── */}
      <View style={styles.topControlSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} />
          <TextInput
            placeholder="Search shop, owner, phone..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {filterTabs.map((tab) => {
            const isActive = selectedFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(tab.key)}
                activeOpacity={0.7}
              >
                {tab.dotColor && (
                  <View style={[styles.filterDot, { backgroundColor: tab.dotColor }]} />
                )}
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Vendor List ─────────────────────────────────────────── */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.vendor.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.receivablesBanner}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerLabel}>Total Outstanding Receivables</Text>
              <Text style={styles.bannerAmount}>₹{fmt(metrics.totalReceivables)}</Text>
            </View>
            <View style={styles.bannerRight}>
              <View style={styles.bannerBadge}>
                <Ionicons name="people-outline" size={14} color={colors.brandGreen} />
                <Text style={styles.bannerBadgeText}>
                  {metrics.withDuesCount} with dues
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const v = item.vendor;
          const outstanding = item.summary.currentOutstanding;

          return (
            <Card
              style={styles.vendorCard}
              onPress={() => navigation.navigate('VendorDetail', { vendorId: v.id })}
              outlined
              elevation="sm"
            >
              {/* Card Header: Shop Name + Contact */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {v.shopName}
                  </Text>
                  <Text style={styles.ownerText} numberOfLines={1}>
                    {v.name || v.ownerName || 'Retail Partner'}
                  </Text>
                </View>

                {/* Direct Call & WhatsApp Contact Shortcuts */}
                <View style={styles.contactRow}>
                  {Boolean(v.phone) && (
                    <>
                      <TouchableOpacity
                        style={styles.contactIconBtn}
                        onPress={() => handleCall(v.phone)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="call-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.contactIconBtn}
                        onPress={() => handleWhatsApp(v.phone)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color={colors.brandGreen} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Divider */}
              <View style={styles.cardDivider} />

              {/* Card Footer: Contact / Balance */}
              <View style={styles.cardFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.phoneLabel}>
                    {v.phone ? `Ph: ${v.phone}` : 'No phone provided'}
                  </Text>
                </View>

                <View style={styles.balanceCol}>
                  <Text style={styles.balanceLabel}>
                    {outstanding > 0 ? 'Balance Due' : 'Account Balance'}
                  </Text>
                  <Text
                    style={[
                      styles.balanceAmount,
                      outstanding > 0 ? styles.balanceDue : styles.balanceSettled,
                    ]}
                  >
                    {outstanding > 0 ? `₹${fmt(outstanding)}` : 'Settled (₹0)'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="storefront-outline"
            title={
              search.length > 0 || selectedFilter !== 'ALL'
                ? 'No matching vendors'
                : 'No vendors registered yet'
            }
            description={
              search.length > 0 || selectedFilter !== 'ALL'
                ? 'Try changing your search term or filter selection'
                : 'No retail shop partners found'
            }
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
  topControlSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.sm + 2,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  receivablesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bannerAmount: {
    ...typography.h2,
    color: colors.brandGreen,
    marginTop: 2,
  },
  bannerRight: {
    alignItems: 'flex-end',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  bannerBadgeText: {
    ...typography.captionBold,
    color: colors.brandGreen,
    fontSize: 11,
  },
  vendorCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  ownerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    ...typography.bodyBold,
    fontSize: 14,
    marginTop: 1,
  },
  balanceDue: {
    color: colors.brandGreen,
  },
  balanceSettled: {
    color: colors.textMuted,
  },
});
