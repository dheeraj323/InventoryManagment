import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCashStore } from '../../store/useCashStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useStaffStore } from '../../store/useStaffStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useDebounce } from '../../hooks';
import { Header } from '../../components/common/Header';
import { EmptyState } from '../../components/common/EmptyState';
import { SettlementDetailModal } from '../../components/cash';
import { CashSettlement, Staff } from '../../types';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

type TabType = 'WITH_STAFF' | 'PENDING' | 'VERIFIED' | 'ALL';

interface StaffCashItem {
  staff: Staff;
  key: string;
  cashInHand: number;
  pendingSettlement?: CashSettlement;
}

export const StaffSettlementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settlements, verifySettlement, getStaffCashInHand, subscribeSettlements } = useCashStore();
  const { staffList, subscribeStaff } = useStaffStore();
  const { orders, subscribeToOrders } = useOrderStore();
  const { currentUser } = useAuthStore();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('WITH_STAFF');
  const [selectedSettlement, setSelectedSettlement] = useState<CashSettlement | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const unsubStaff = subscribeStaff();
    const unsubOrders = subscribeToOrders();
    const unsubSettlements = subscribeSettlements();
    return () => {
      if (unsubStaff) unsubStaff();
      if (unsubOrders) unsubOrders();
      if (unsubSettlements) unsubSettlements();
    };
  }, []);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── 1. Live Cash with Active Staff ─────────────────────────────────────────
  const staffCashData = useMemo<StaffCashItem[]>(() => {
    const activeStaff = staffList.filter(
      (s) => s.status === 'ACTIVE' || (s.active && s.status !== 'PENDING_VERIFICATION' && s.status !== 'SUSPENDED')
    );

    return activeStaff.map((s) => {
      const key = s.staffId || s.id;
      const cashInHand = getStaffCashInHand(key, orders);
      const pendingSettlement = settlements.find(
        (set) => set.staffId === key && set.status === 'PENDING_VERIFICATION'
      );
      return {
        staff: s,
        key,
        cashInHand,
        pendingSettlement,
      };
    });
  }, [staffList, orders, settlements, getStaffCashInHand]);

  // Statistics for "With Staff" tab
  const withStaffStats = useMemo(() => {
    let totalCashWithStaff = 0;
    let staffHoldingCashCount = 0;
    let totalPendingHandover = 0;

    staffCashData.forEach((item) => {
      totalCashWithStaff += item.cashInHand;
      if (item.cashInHand > 0) staffHoldingCashCount++;
      if (item.pendingSettlement) {
        totalPendingHandover +=
          item.pendingSettlement.handedOverCash || item.pendingSettlement.amountHandedOver || 0;
      }
    });

    return {
      totalCashWithStaff,
      staffHoldingCashCount,
      totalPendingHandover,
      totalActiveStaff: staffCashData.length,
    };
  }, [staffCashData]);

  // Filtered staff list for search in "With Staff" tab
  const filteredStaffCash = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const sorted = [...staffCashData].sort((a, b) => {
      if (b.cashInHand !== a.cashInHand) return b.cashInHand - a.cashInHand;
      return (a.staff.name || '').localeCompare(b.staff.name || '');
    });

    if (!q) return sorted;
    return sorted.filter((item) => {
      const nameMatch = item.staff.name?.toLowerCase().includes(q);
      const phoneMatch = item.staff.phone?.includes(q);
      const areaMatch = item.staff.activeArea?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || areaMatch;
    });
  }, [staffCashData, debouncedSearch]);

  // ─── 2. Settlements Summary Metrics ──────────────────────────────────────────
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

  // Filtered settlements list
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
      if (activeTab === 'PENDING' && item.status !== 'PENDING_VERIFICATION') return false;
      if (activeTab === 'VERIFIED' && item.status !== 'VERIFIED') return false;

      if (q.length > 0) {
        const staffMatch = item.staffName?.toLowerCase().includes(q) || false;
        const setNumMatch = item.settlementNumber?.toLowerCase().includes(q) || false;
        const notesMatch = item.notes?.toLowerCase().includes(q) || false;
        const dateMatch = item.date?.toLowerCase().includes(q) || false;

        if (!staffMatch && !setNumMatch && !notesMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [settlements, activeTab, debouncedSearch]);

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

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This staff member does not have a registered phone number.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  const handleWhatsApp = (phone?: string, name?: string, amount?: number) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This staff member does not have a registered phone number.');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '');
    const full = clean.startsWith('91') ? clean : `91${clean}`;
    const msg =
      amount && amount > 0
        ? `Hello ${name || 'Team'}, please deposit today's collected cash of ₹${amount.toLocaleString('en-IN')}.`
        : `Hello ${name || 'Team'} from Panihaar DMS.`;
    Linking.openURL(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp.');
    });
  };

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    {
      key: 'WITH_STAFF',
      label: 'With Staff',
      badge: withStaffStats.staffHoldingCashCount > 0 ? withStaffStats.staffHoldingCashCount : undefined,
    },
    {
      key: 'PENDING',
      label: 'Pending Audit',
      badge: stats.pendingCount > 0 ? stats.pendingCount : undefined,
    },
    {
      key: 'VERIFIED',
      label: `Verified (${stats.verifiedCount})`,
    },
    {
      key: 'ALL',
      label: `All (${stats.totalCount})`,
    },
  ];

  // ─── Header Summary for "With Staff" Tab ────────────────────────────────────
  const renderWithStaffHeaderSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View>
          <Text style={styles.summaryLabel}>TOTAL CASH WITH STAFF</Text>
          <Text style={[styles.summaryTotalAmount, { color: colors.brandGreen }]}>
            ₹{fmt(withStaffStats.totalCashWithStaff)}
          </Text>
        </View>
        <View
          style={[
            styles.staffCountBadge,
            withStaffStats.staffHoldingCashCount > 0 ? styles.badgeActive : styles.badgeNeutral,
          ]}
        >
          <Ionicons
            name="wallet"
            size={13}
            color={withStaffStats.staffHoldingCashCount > 0 ? colors.brandGreen : colors.textMuted}
          />
          <Text
            style={[
              styles.staffCountBadgeText,
              { color: withStaffStats.staffHoldingCashCount > 0 ? colors.brandGreen : colors.textMuted },
            ]}
          >
            {withStaffStats.staffHoldingCashCount} of {withStaffStats.totalActiveStaff} holding cash
          </Text>
        </View>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.summaryCols}>
        <View style={styles.summaryCol}>
          <Text style={styles.colLabel}>Pending Handover</Text>
          <Text
            style={[
              styles.colAmount,
              stats.pendingAmount > 0 ? { color: colors.statusPendingText } : { color: colors.textPrimary },
            ]}
          >
            ₹{fmt(stats.pendingAmount)}
          </Text>
          <Text style={styles.colCount}>{stats.pendingCount} slip{stats.pendingCount !== 1 ? 's' : ''} submitted</Text>
        </View>

        <View style={styles.colSeparator} />

        <View style={styles.summaryCol}>
          <Text style={styles.colLabel}>On-Field Unsubmitted</Text>
          <Text style={[styles.colAmount, { color: colors.accent }]}>
            ₹{fmt(Math.max(0, withStaffStats.totalCashWithStaff - stats.pendingAmount))}
          </Text>
          <Text style={styles.colCount}>Yet to submit handover</Text>
        </View>
      </View>
    </View>
  );

  // ─── Header Summary for Settlement Slips Tabs ────────────────────────────────
  const renderSettlementHeaderSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View>
          <Text style={styles.summaryLabel}>TOTAL SETTLED CASH</Text>
          <Text style={styles.summaryTotalAmount}>₹{fmt(stats.totalAmount)}</Text>
        </View>
        {stats.pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <View style={styles.pendingDot} />
            <Text style={styles.pendingBadgeText}>{stats.pendingCount} to verify</Text>
          </View>
        ) : (
          <View style={styles.settledBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} />
            <Text style={styles.settledBadgeText}>All Audited</Text>
          </View>
        )}
      </View>

      <View style={styles.summaryDivider} />

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

  // ─── Render Staff Cash Card ("With Staff" Tab) ──────────────────────────────
  const renderStaffCashCard = ({ item }: { item: StaffCashItem }) => {
    const { staff, cashInHand, pendingSettlement } = item;
    const hasCash = cashInHand > 0;
    const pendingAmount = pendingSettlement
      ? pendingSettlement.handedOverCash || pendingSettlement.amountHandedOver || 0
      : 0;

    const initials = staff.name
      ? staff.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'ST';

    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.staffCashCard, hasCash && styles.staffCashCardActive]}>
          {/* Top Row: Avatar, Name, Area & Live Cash */}
          <View style={styles.cardTopRow}>
            <View
              style={[
                styles.staffAvatar,
                hasCash ? styles.avatarWithCash : styles.avatarNoCash,
              ]}
            >
              <Text
                style={[
                  styles.staffAvatarText,
                  hasCash ? { color: colors.brandGreen } : { color: colors.textMuted },
                ]}
              >
                {initials}
              </Text>
            </View>

            <View style={styles.staffMainInfo}>
              <Text style={styles.staffNameText} numberOfLines={1}>
                {staff.name}
              </Text>
              <View style={styles.staffSubRow}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.staffAreaText} numberOfLines={1}>
                  {staff.activeArea || 'No Route'}
                </Text>
                {staff.phone ? (
                  <>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.staffPhoneText}>{staff.phone}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* Cash in Hand Badge */}
            <View style={styles.cashAmountBlock}>
              <Text style={styles.cashAmountLabel}>CASH IN HAND</Text>
              <Text
                style={[
                  styles.cashAmountValue,
                  hasCash ? { color: colors.brandGreen } : { color: colors.textMuted },
                ]}
              >
                ₹{cashInHand.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Pending Settlement Notice banner */}
          {pendingSettlement && (
            <View style={styles.staffPendingSettlementNotice}>
              <View style={styles.pendingNoticeLeft}>
                <Ionicons name="time" size={14} color="#B45309" />
                <Text style={styles.pendingNoticeText}>
                  Handover slip of <Text style={{ fontWeight: '700' }}>₹{fmt(pendingAmount)}</Text> submitted
                </Text>
              </View>
              <TouchableOpacity
                style={styles.verifySlipBtn}
                onPress={() => setSelectedSettlement(pendingSettlement)}
                activeOpacity={0.8}
              >
                <Text style={styles.verifySlipBtnText}>Audit</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.staffCardActions}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => handleCall(staff.phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={14} color={colors.accent} />
              <Text style={styles.contactBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => handleWhatsApp(staff.phone, staff.name, cashInHand)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={14} color={colors.brandGreen} />
              <Text style={[styles.contactBtnText, { color: colors.brandGreen }]}>
                WhatsApp Reminder
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── Render Settlement Card (Slips Tabs) ────────────────────────────────────
  const renderSettlementCard = ({ item }: { item: CashSettlement }) => {
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
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.textMuted}
                  style={{ marginLeft: 'auto' }}
                />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Header
        title="Cash Settlements"
        subtitle={`Live cash tracking & handover ledger`}
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
            placeholder={
              activeTab === 'WITH_STAFF'
                ? 'Search staff by name, area, phone...'
                : 'Search settlements by staff, date, notes...'
            }
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
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {tab.badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      {activeTab === 'WITH_STAFF' ? (
        <FlatList
          data={filteredStaffCash}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderWithStaffHeaderSummary}
          renderItem={renderStaffCashCard}
          ListEmptyComponent={
            <EmptyState
              iconName="people-outline"
              title="No Staff Found"
              description={
                search.length > 0
                  ? `No active delivery staff matching "${search}"`
                  : 'No active delivery staff members found.'
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredSettlements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderSettlementHeaderSummary}
          renderItem={renderSettlementCard}
          ListEmptyComponent={
            <EmptyState
              iconName="cash-outline"
              title={
                search.length > 0 || activeTab !== 'ALL'
                  ? 'No matching settlements'
                  : 'No settlements found'
              }
              description={
                search.length > 0 || activeTab !== 'ALL'
                  ? 'Try changing your search keywords or filter tab'
                  : 'Submitted staff cash handovers will appear here'
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusMd - 2,
    gap: 4,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  segmentText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  tabBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    ...typography.captionBold,
    fontSize: 9,
    color: '#92400E',
  },
  tabBadgeTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.sm,
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
  staffCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  badgeActive: {
    backgroundColor: colors.brandGreenLight,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceSubtle,
  },
  staffCountBadgeText: {
    ...typography.captionBold,
    fontSize: 11,
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

  // ── Staff Cash Card ("With Staff" Tab) ──
  cardWrapper: {
    marginBottom: spacing.sm,
  },
  staffCashCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  staffCashCardActive: {
    borderColor: '#BBF7D0',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWithCash: {
    backgroundColor: colors.brandGreenLight,
  },
  avatarNoCash: {
    backgroundColor: colors.surfaceSubtle,
  },
  staffAvatarText: {
    ...typography.h3,
    fontSize: 15,
  },
  staffMainInfo: {
    flex: 1,
  },
  staffNameText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  staffSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  staffAreaText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  staffPhoneText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  cashAmountBlock: {
    alignItems: 'flex-end',
  },
  cashAmountLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  cashAmountValue: {
    ...typography.h3,
    fontSize: 16,
    marginTop: 1,
  },
  staffPendingSettlementNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: spacing.borderRadiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  pendingNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pendingNoticeText: {
    ...typography.caption,
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  verifySlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 2,
  },
  verifySlipBtnText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.primary,
  },
  staffCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 7,
    borderRadius: spacing.borderRadiusSm,
    gap: 5,
  },
  contactBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.accent,
  },

  // ── Settlement Card (Slips Tabs) ──
  settlementCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
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
