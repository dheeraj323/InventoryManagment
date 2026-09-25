import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, StaffAdvance } from '../../types';
import { useStaffPayrollStore } from '../../store/useStaffPayrollStore';
import { RecordAdvanceModal } from './RecordAdvanceModal';
import { RepayAdvanceModal } from './RepayAdvanceModal';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface AdvanceRegisterPanelProps {
  staffList: Staff[];
  onOpenStaffProfile?: (staff: Staff) => void;
}

type AdvanceFilter = 'ALL' | 'ACTIVE' | 'REPAID';

export const AdvanceRegisterPanel: React.FC<AdvanceRegisterPanelProps> = ({
  staffList,
  onOpenStaffProfile,
}) => {
  const { advancesList, isAdvancesLoading } = useStaffPayrollStore();

  const [filter, setFilter] = useState<AdvanceFilter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [selectedAdvanceForRepay, setSelectedAdvanceForRepay] = useState<StaffAdvance | null>(null);
  const [expandedAdvanceId, setExpandedAdvanceId] = useState<string | null>(null);

  // Metrics
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let totalDisbursed = 0;
    let totalRepaid = 0;
    let activeStaffWithAdvances = new Set<string>();

    advancesList.forEach((adv) => {
      const amount = Number(adv.amount || 0);
      const repaid = Number(adv.amountRepaid || 0);
      const remaining = adv.remainingAmount ?? (amount - repaid);

      totalDisbursed += amount;
      totalRepaid += repaid;

      if (adv.status === 'ACTIVE' || adv.status === 'PARTIALLY_REPAID') {
        totalOutstanding += remaining;
        activeStaffWithAdvances.add(adv.staffId);
      }
    });

    return {
      totalOutstanding,
      totalDisbursed,
      totalRepaid,
      activeStaffCount: activeStaffWithAdvances.size,
      totalCount: advancesList.length,
    };
  }, [advancesList]);

  // Filter & Search
  const filteredAdvances = useMemo(() => {
    return advancesList.filter((adv) => {
      // Filter status
      if (filter === 'ACTIVE') {
        if (adv.status !== 'ACTIVE' && adv.status !== 'PARTIALLY_REPAID') return false;
      } else if (filter === 'REPAID') {
        if (adv.status !== 'REPAID' && adv.status !== 'DEDUCTED_FROM_SALARY') return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = adv.staffName?.toLowerCase().includes(q);
        const matchNum = adv.advanceNumber?.toLowerCase().includes(q);
        const matchReason = adv.reason?.toLowerCase().includes(q);
        return matchName || matchNum || matchReason;
      }

      return true;
    });
  }, [advancesList, filter, search]);

  const toggleExpand = (id: string) => {
    setExpandedAdvanceId((prev) => (prev === id ? null : id));
  };

  const renderAdvanceCard = ({ item }: { item: StaffAdvance }) => {
    const isCleared = item.status === 'REPAID' || item.status === 'DEDUCTED_FROM_SALARY';
    const isPartial = item.status === 'PARTIALLY_REPAID';
    const remaining = item.remainingAmount ?? (item.amount - (item.amountRepaid || 0));
    const percent = Math.min(100, Math.round(((item.amountRepaid || 0) / (item.amount || 1)) * 100));
    const isExpanded = expandedAdvanceId === item.id;
    const repayments = item.repayments || [];

    return (
      <View style={styles.advanceCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.staffName}>{item.staffName}</Text>
            <View style={styles.numDateRow}>
              <Text style={styles.advNumber}>{item.advanceNumber}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.advDate}>{formatDate(item.date)}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.advMode}>{item.paymentMode}</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isCleared
                ? styles.statusBadgeCleared
                : isPartial
                ? styles.statusBadgePartial
                : styles.statusBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isCleared
                  ? styles.statusTextCleared
                  : isPartial
                  ? styles.statusTextPartial
                  : styles.statusTextActive,
              ]}
            >
              {item.status === 'DEDUCTED_FROM_SALARY'
                ? 'DEDUCTED FROM SALARY'
                : item.status === 'REPAID'
                ? 'CLEARED'
                : item.status === 'PARTIALLY_REPAID'
                ? 'PARTIAL DUE'
                : 'ACTIVE DUE'}
            </Text>
          </View>
        </View>

        {/* Amounts & Progress Bar */}
        <View style={styles.amountBox}>
          <View style={styles.amountCols}>
            <View>
              <Text style={styles.amountLabel}>Total Advance</Text>
              <Text style={styles.amountVal}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.amountLabel}>Repaid / Deducted</Text>
              <Text style={[styles.amountVal, { color: colors.brandGreen }]}>
                ₹{(item.amountRepaid || 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amountLabel}>Remaining Due</Text>
              <Text
                style={[
                  styles.amountVal,
                  { color: isCleared ? colors.textMuted : colors.danger },
                ]}
              >
                ₹{remaining.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${percent}%`,
                  backgroundColor: isCleared ? colors.brandGreen : colors.accent,
                },
              ]}
            />
          </View>
        </View>

        {/* Reason / Notes */}
        {item.reason ? (
          <View style={styles.reasonRow}>
            <Ionicons name="information-circle-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.reasonText} numberOfLines={1}>
              {item.reason} {item.notes ? `• ${item.notes}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Actions Row */}
        <View style={styles.cardActionsRow}>
          {repayments.length > 0 && (
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => toggleExpand(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'time-outline'}
                size={14}
                color={colors.accent}
              />
              <Text style={styles.historyBtnText}>
                {isExpanded ? 'Hide Ledger' : `Repayments (${repayments.length})`}
              </Text>
            </TouchableOpacity>
          )}

          {!isCleared && (
            <TouchableOpacity
              style={styles.repayBtn}
              onPress={() => setSelectedAdvanceForRepay(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="cash-outline" size={14} color={colors.brandGreen} />
              <Text style={styles.repayBtnText}>+ Record Repayment</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Repayment History Dropdown */}
        {isExpanded && repayments.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Repayment & Deduction History:</Text>
            {repayments.map((rep) => (
              <View key={rep.id} style={styles.historyRow}>
                <View style={styles.historyRowLeft}>
                  <Ionicons
                    name={
                      rep.type === 'SALARY_DEDUCTION'
                        ? 'receipt-outline'
                        : 'arrow-down-circle-outline'
                    }
                    size={14}
                    color={rep.type === 'SALARY_DEDUCTION' ? colors.accent : colors.brandGreen}
                  />
                  <View>
                    <Text style={styles.historyTypeText}>
                      {rep.type === 'SALARY_DEDUCTION'
                        ? 'Salary Slip Deduction'
                        : rep.type === 'ONLINE_RETURN'
                        ? 'UPI/Online Return'
                        : 'Cash Return'}
                    </Text>
                    <Text style={styles.historyDateText}>
                      {formatDate(rep.date)} {rep.notes ? `• ${rep.notes}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyAmountText}>
                  -₹{rep.amount.toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Summary Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, styles.kpiCardDue]}>
          <Text style={styles.kpiLabel}>TOTAL ADVANCE DUE</Text>
          <Text style={[styles.kpiValue, { color: colors.danger }]}>
            ₹{metrics.totalOutstanding.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>{metrics.activeStaffCount} staff with active dues</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL REPAID</Text>
          <Text style={[styles.kpiValue, { color: colors.brandGreen }]}>
            ₹{metrics.totalRepaid.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>Disbursed: ₹{metrics.totalDisbursed.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* 2. Filter & Action Bar */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search advances by staff, ID..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.giveAdvBtn}
          onPress={() => setIsGiveModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={16} color={colors.textInverse} />
          <Text style={styles.giveAdvBtnText}>Give Advance</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Filter Pills */}
      <View style={styles.filterPillsRow}>
        {(['ACTIVE', 'ALL', 'REPAID'] as AdvanceFilter[]).map((tab) => {
          const isSelected = filter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterPill, isSelected && styles.filterPillActive]}
              onPress={() => setFilter(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                {tab === 'ACTIVE'
                  ? 'Active Dues'
                  : tab === 'ALL'
                  ? `All (${advancesList.length})`
                  : 'Fully Cleared'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. Advances List */}
      {isAdvancesLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading advance register...</Text>
        </View>
      ) : filteredAdvances.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Advance Records</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? `No advances found matching "${search}"`
              : filter === 'ACTIVE'
              ? 'No outstanding staff advance dues at this moment.'
              : 'No staff advance records found.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAdvances}
          keyExtractor={(item) => item.id}
          renderItem={renderAdvanceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Give Advance Modal */}
      <RecordAdvanceModal
        visible={isGiveModalOpen}
        staffList={staffList}
        onClose={() => setIsGiveModalOpen(false)}
      />

      {/* Repay Advance Modal */}
      <RepayAdvanceModal
        visible={!!selectedAdvanceForRepay}
        advance={selectedAdvanceForRepay}
        onClose={() => setSelectedAdvanceForRepay(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  kpiCardDue: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  kpiLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  kpiValue: {
    ...typography.h2,
    fontSize: 18,
    color: colors.textPrimary,
  },
  kpiSub: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchBarRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  giveAdvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    gap: 4,
  },
  giveAdvBtnText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textInverse,
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: 6,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.xs,
    gap: 12,
  },
  advanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  staffName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  numDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  advNumber: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.accent,
  },
  dotSeparator: {
    color: colors.textMuted,
    fontSize: 10,
  },
  advDate: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  advMode: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.statusCancelledBg,
  },
  statusBadgePartial: {
    backgroundColor: colors.statusPendingBg,
  },
  statusBadgeCleared: {
    backgroundColor: colors.statusDeliveredBg,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 9,
  },
  statusTextActive: {
    color: colors.danger,
  },
  statusTextPartial: {
    color: '#D97706',
  },
  statusTextCleared: {
    color: colors.brandGreen,
  },
  amountBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  amountCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  amountVal: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  reasonText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.accentLight,
    gap: 4,
  },
  historyBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.accent,
  },
  repayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.brandGreenLight,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  repayBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  historySection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceSubtle,
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  historySectionTitle: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTypeText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  historyDateText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  historyAmountText: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.brandGreen,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
