import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDebounce } from '../../hooks';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { SettlementDetailModal } from '../../components/cash';
import { CashSettlement } from '../../types';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing } from '../../theme';

type FilterType = 'ALL' | 'PENDING' | 'VERIFIED';

export const StaffSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, verifySettlement } = useCashStore();
  const { currentUser } = useAuthStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Summary Metrics
  const stats = useMemo(() => {
    let pendingCount = 0;
    let pendingAmount = 0;
    let verifiedCount = 0;
    let verifiedAmount = 0;

    for (const s of settlements) {
      const handed = s.handedOverCash || s.amountHandedOver || 0;
      if (s.status === 'PENDING_VERIFICATION') {
        pendingCount++;
        pendingAmount += handed;
      } else {
        verifiedCount++;
        verifiedAmount += handed;
      }
    }

    return {
      totalCount: settlements.length,
      totalAmount: pendingAmount + verifiedAmount,
      pendingCount,
      pendingAmount,
      verifiedCount,
      verifiedAmount,
    };
  }, [settlements]);

  // Filter & Search List
  const filteredSettlements = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    const sorted = [...settlements].sort((a, b) => {
      const timeA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : a.id.startsWith('set-')
        ? parseInt(a.id.replace('set-', ''), 10) || 0
        : 0;
      const timeB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : b.id.startsWith('set-')
        ? parseInt(b.id.replace('set-', ''), 10) || 0
        : 0;
      return timeB - timeA;
    });

    return sorted.filter((item) => {
      if (filter === 'PENDING' && item.status !== 'PENDING_VERIFICATION') return false;
      if (filter === 'VERIFIED' && item.status !== 'VERIFIED') return false;

      if (q.length > 0) {
        const staffMatch = item.staffName?.toLowerCase().includes(q) || false;
        const setNumMatch = item.settlementNumber?.toLowerCase().includes(q) || false;
        const notesMatch = item.notes?.toLowerCase().includes(q) || false;
        const dateMatch = item.date?.toLowerCase().includes(q) || false;

        if (!staffMatch && !setNumMatch && !notesMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [settlements, filter, debouncedSearch]);

  const handleVerify = (id: string) => {
    const target = settlements.find((s) => s.id === id);
    const staffName = target?.staffName || 'Staff';
    const amount = target?.handedOverCash || target?.amountHandedOver || 0;

    Alert.alert(
      'Verify Cash Handover',
      `Confirm receipt of ₹${fmt(amount)} physical cash from ${staffName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Sign Off',
          style: 'default',
          onPress: () => {
            verifySettlement(id, currentUser?.name || 'Admin');
          },
        },
      ]
    );
  };

  const filterTabs = [
    { key: 'ALL' as FilterType, label: `All (${stats.totalCount})` },
    { key: 'PENDING' as FilterType, label: `Pending (${stats.pendingCount})` },
    { key: 'VERIFIED' as FilterType, label: `Verified (${stats.verifiedCount})` },
  ];

  const renderHeaderSummary = () => (
    <View style={styles.summaryCard}>
      {/* Top Total */}
      <View style={styles.summaryTopRow}>
        <View>
          <Text style={styles.summaryLabel}>TOTAL CASH COLLECTED</Text>
          <Text style={styles.summaryTotalAmount}>₹{fmt(stats.totalAmount)}</Text>
        </View>
        {stats.pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <View style={styles.pendingDot} />
            <Text style={styles.pendingBadgeText}>
              {stats.pendingCount} to verify
            </Text>
          </View>
        ) : (
          <View style={styles.settledBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} />
            <Text style={styles.settledBadgeText}>All Audited</Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.summaryDivider} />

      {/* Breakdown Columns */}
      <View style={styles.summaryCols}>
        <View style={styles.summaryCol}>
          <Text style={styles.colLabel}>Pending Audit</Text>
          <Text
            style={[
              styles.colAmount,
              stats.pendingCount > 0 ? { color: colors.statusPendingText } : { color: colors.textPrimary },
            ]}
          >
            ₹{fmt(stats.pendingAmount)}
          </Text>
          <Text style={styles.colCount}>{stats.pendingCount} handover{stats.pendingCount !== 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.colSeparator} />

        <View style={styles.summaryCol}>
          <Text style={styles.colLabel}>Verified in Safe</Text>
          <Text style={[styles.colAmount, { color: colors.brandGreen }]}>
            ₹{fmt(stats.verifiedAmount)}
          </Text>
          <Text style={styles.colCount}>{stats.verifiedCount} audited</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Header
        title="Cash Settlements"
        subtitle={`${settlements.length} Staff Handovers`}
        showBack={navigation.canGoBack()}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      {/* ── Search & Filter Tabs ─────────────────────────────────── */}
      <View style={styles.controlBar}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search staff, date, remarks..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Segment Tabs */}
        <View style={styles.filterSegment}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Settlements List ─────────────────────────────────────── */}
      <FlatList
        data={filteredSettlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeaderSummary}
        renderItem={({ item }) => {
          const isPending = item.status === 'PENDING_VERIFICATION';
          const handedOver = item.handedOverCash || item.amountHandedOver || 0;
          const expected = item.totalCashCollected || item.amountCollected || 0;
          const variance = item.variance || item.difference || 0;

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedSettlement(item)}
              style={styles.cardWrapper}
            >
              <View style={styles.settlementCard}>
                {/* Row 1: Staff Name + Handed Over Amount */}
                <View style={styles.cardRow1}>
                  <Text style={styles.staffName}>{item.staffName}</Text>
                  <Text style={styles.handoverAmount}>₹{fmt(handedOver)}</Text>
                </View>

                {/* Row 2: Date & Expected vs Variance status */}
                <View style={styles.cardRow2}>
                  <Text style={styles.dateLabel}>{formatDate(item.date)}</Text>
                  <View style={styles.reconciliationGroup}>
                    <Text style={styles.expectedLabel}>Expected: ₹{fmt(expected)}</Text>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text
                      style={[
                        styles.varianceLabel,
                        variance === 0
                          ? { color: colors.brandGreen }
                          : variance > 0
                          ? { color: colors.statusPendingText }
                          : { color: colors.danger },
                      ]}
                    >
                      {variance === 0
                        ? 'Balanced'
                        : variance > 0
                        ? `+₹${fmt(variance)} Excess`
                        : `-₹${fmt(Math.abs(variance))} Short`}
                    </Text>
                  </View>
                </View>

                {/* Row 3: Notes / Bag Tag (if present) */}
                {item.notes ? (
                  <View style={styles.bagNoteRow}>
                    <Ionicons name="bag-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.bagNoteText} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Row 4: Status footer & Actions */}
                <View style={styles.cardFooter}>
                  {isPending ? (
                    <View style={styles.pendingActionRow}>
                      <View style={styles.pendingStatusTextGroup}>
                        <View style={styles.amberDot} />
                        <Text style={styles.pendingStatusText}>Awaiting Verification</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.inlineVerifyBtn}
                        onPress={() => handleVerify(item.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                        <Text style={styles.inlineVerifyText}>Verify Cash</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.verifiedStatusRow}>
                      <Ionicons name="checkmark-done" size={14} color={colors.brandGreen} />
                      <Text style={styles.verifiedByText}>
                        Audited by {item.verifiedBy || 'Admin'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            iconName="cash-outline"
            title={
              search.length > 0 || filter !== 'ALL'
                ? 'No matching settlements'
                : 'No settlements found'
            }
            description={
              search.length > 0 || filter !== 'ALL'
                ? 'Try changing your search keywords or filter tab'
                : 'Submitted staff cash handovers will appear here'
            }
          />
        }
      />

      {/* ── Detail Slip Modal ──────────────────────────────────────── */}
      <SettlementDetailModal
        visible={!!selectedSettlement}
        settlement={selectedSettlement}
        onClose={() => setSelectedSettlement(null)}
        onVerify={handleVerify}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controlBar: {
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
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs + 2,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterSegment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusMd - 2,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // Executive Summary Card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryTotalAmount: {
    ...typography.h1,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
    gap: 5,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusPendingText,
  },
  pendingBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.statusPendingText,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  settledBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm + 2,
  },
  summaryCols: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
  },
  colSeparator: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.sm,
  },
  colLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  colAmount: {
    ...typography.bodyBold,
    fontSize: 15,
    marginTop: 1,
  },
  colCount: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Settlement Card
  cardWrapper: {
    marginBottom: spacing.sm,
  },
  settlementCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  handoverAmount: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  reconciliationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expectedLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dotSeparator: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  varianceLabel: {
    ...typography.captionBold,
    fontSize: 11,
  },
  bagNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.xs + 2,
    gap: 5,
  },
  bagNoteText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  pendingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingStatusTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  amberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  pendingStatusText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.statusPendingText,
  },
  inlineVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
    gap: 4,
  },
  inlineVerifyText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 11,
  },
  verifiedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verifiedByText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.brandGreen,
  },
});
