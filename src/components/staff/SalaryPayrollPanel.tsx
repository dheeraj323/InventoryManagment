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
import { Staff, StaffSalarySlip } from '../../types';
import { useStaffPayrollStore, getCurrentMonthString } from '../../store/useStaffPayrollStore';
import { SalarySlipModal } from './SalarySlipModal';
import { DisburseSalaryModal } from './DisburseSalaryModal';
import { SalaryConfigModal } from './SalaryConfigModal';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface SalaryPayrollPanelProps {
  staffList: Staff[];
  onOpenStaffProfile?: (staff: Staff) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const SalaryPayrollPanel: React.FC<SalaryPayrollPanelProps> = ({
  staffList,
  onOpenStaffProfile,
}) => {
  const {
    selectedMonth,
    salarySlipsList,
    isPayrollLoading,
    setSelectedMonth,
  } = useStaffPayrollStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  // Modals state
  const [selectedStaffForSlip, setSelectedStaffForSlip] = useState<Staff | null>(null);
  const [selectedSlipForEdit, setSelectedSlipForEdit] = useState<StaffSalarySlip | null>(null);
  const [selectedSlipForPay, setSelectedSlipForPay] = useState<StaffSalarySlip | null>(null);
  const [selectedStaffForConfig, setSelectedStaffForConfig] = useState<Staff | null>(null);

  // Month navigation
  const currentMonthDisplay = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const mIndex = parseInt(monthStr, 10) - 1;
    return `${MONTH_NAMES[mIndex] || monthStr} ${yearStr}`;
  }, [selectedMonth]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map((x) => parseInt(x, 10));
    let newY = y;
    let newM = m - 1;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    const formattedM = String(newM).padStart(2, '0');
    setSelectedMonth(`${newY}-${formattedM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map((x) => parseInt(x, 10));
    let newY = y;
    let newM = m + 1;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    const formattedM = String(newM).padStart(2, '0');
    setSelectedMonth(`${newY}-${formattedM}`);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthString());
  };

  // Map existing salary slips by staffId
  const slipsMap = useMemo(() => {
    const map: Record<string, StaffSalarySlip> = {};
    salarySlipsList.forEach((s) => {
      map[s.staffId] = s;
    });
    return map;
  }, [salarySlipsList]);

  // Active delivery staff
  const activeStaff = useMemo(() => {
    return staffList.filter((s) => s.status === 'ACTIVE' || (s.active && s.status !== 'SUSPENDED'));
  }, [staffList]);

  // Payroll Metrics
  const metrics = useMemo(() => {
    let totalNetPayable = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalAdvanceDeductions = 0;
    let paidCount = 0;
    let pendingCount = 0;

    activeStaff.forEach((s) => {
      const key = s.staffId || s.id;
      const slip = slipsMap[key];
      if (slip) {
        totalNetPayable += slip.netPayableSalary;
        totalPaid += slip.paidAmount || 0;
        totalAdvanceDeductions += slip.advanceDeducted || 0;
        if (slip.status === 'PAID') {
          paidCount++;
        } else {
          totalPending += Math.max(0, slip.netPayableSalary - (slip.paidAmount || 0));
          pendingCount++;
        }
      } else {
        const estSalary = s.monthlySalary || 0;
        totalNetPayable += estSalary;
        totalPending += estSalary;
        pendingCount++;
      }
    });

    return {
      totalNetPayable,
      totalPaid,
      totalPending,
      totalAdvanceDeductions,
      paidCount,
      pendingCount,
    };
  }, [activeStaff, slipsMap]);

  // Filtered staff roster
  const filteredStaff = useMemo(() => {
    return activeStaff.filter((s) => {
      const key = s.staffId || s.id;
      const slip = slipsMap[key];
      const isPaid = slip?.status === 'PAID';

      if (filter === 'PAID' && !isPaid) return false;
      if (filter === 'PENDING' && isPaid) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchPhone = s.phone?.includes(q);
        const matchArea = s.activeArea?.toLowerCase().includes(q);
        return matchName || matchPhone || matchArea;
      }

      return true;
    });
  }, [activeStaff, slipsMap, filter, search]);

  const renderStaffPayrollCard = ({ item }: { item: Staff }) => {
    const key = item.staffId || item.id;
    const slip = slipsMap[key];
    const hasSlip = !!slip;
    const isPaid = slip?.status === 'PAID';
    const isPartial = slip?.status === 'PARTIAL';
    const monthlyBase = slip?.baseSalary ?? item.monthlySalary ?? 0;
    const netSalary = slip?.netPayableSalary ?? monthlyBase;

    return (
      <View style={styles.payrollCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.nameRow}>
              <Text style={styles.staffName}>{item.name}</Text>
              <TouchableOpacity
                onPress={() => setSelectedStaffForConfig(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <Text style={styles.baseSalaryText}>
              Base: {monthlyBase > 0 ? `₹${monthlyBase.toLocaleString('en-IN')}/mo` : 'Salary Not Set'}
            </Text>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isPaid
                ? styles.statusBadgePaid
                : isPartial
                ? styles.statusBadgePartial
                : styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPaid
                  ? styles.statusTextPaid
                  : isPartial
                  ? styles.statusTextPartial
                  : styles.statusTextPending,
              ]}
            >
              {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : hasSlip ? 'CALCULATED' : 'NOT CALCULATED'}
            </Text>
          </View>
        </View>

        {/* Salary Breakdown Row */}
        <View style={styles.breakdownBox}>
          {hasSlip ? (
            <>
              <View style={styles.breakdownRow}>
                <View>
                  <Text style={styles.bdLabel}>Attendance</Text>
                  <Text style={styles.bdVal}>
                    {slip.payableDays}/{slip.totalWorkingDays} Days
                  </Text>
                </View>

                {slip.bonusOrIncentive > 0 && (
                  <View>
                    <Text style={styles.bdLabel}>Bonus</Text>
                    <Text style={[styles.bdVal, { color: colors.brandGreen }]}>
                      +₹{slip.bonusOrIncentive.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}

                {slip.advanceDeducted > 0 && (
                  <View>
                    <Text style={styles.bdLabel}>Adv Recovered</Text>
                    <Text style={[styles.bdVal, { color: colors.danger }]}>
                      -₹{slip.advanceDeducted.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bdLabel}>Net Payable</Text>
                  <Text style={[styles.bdVal, styles.bdValNet]}>
                    ₹{netSalary.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {isPaid && (
                <View style={styles.paidInfoRow}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.brandGreen} />
                  <Text style={styles.paidInfoText}>
                    Disbursed ₹{(slip.paidAmount || netSalary).toLocaleString('en-IN')} on{' '}
                    {formatDate(slip.paymentDate)} ({slip.paymentMode || 'CASH'})
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noSlipPrompt}>
              <Ionicons name="calculator-outline" size={16} color={colors.textMuted} />
              <Text style={styles.noSlipText}>
                No slip calculated yet for this month. Tap below to compute attendance & advances.
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.calcBtn}
            onPress={() => {
              setSelectedStaffForSlip(item);
              setSelectedSlipForEdit(slip || null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={14} color={colors.primary} />
            <Text style={styles.calcBtnText}>
              {hasSlip ? 'Edit Slip' : 'Calculate & Generate'}
            </Text>
          </TouchableOpacity>

          {hasSlip && !isPaid && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => setSelectedSlipForPay(slip)}
              activeOpacity={0.8}
            >
              <Ionicons name="cash-outline" size={14} color={colors.textInverse} />
              <Text style={styles.payBtnText}>Pay Salary (₹{netSalary.toLocaleString('en-IN')})</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Month Navigator Bar */}
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <Text style={styles.monthTitle}>{currentMonthDisplay}</Text>
          <Text style={styles.monthSub}>Monthly Payroll Cycle</Text>
        </View>

        <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {selectedMonth !== getCurrentMonthString() && (
          <TouchableOpacity onPress={handleCurrentMonth} style={styles.currentMonthPill}>
            <Text style={styles.currentMonthPillText}>This Month</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Payroll Summary Cards */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL PAYROLL</Text>
          <Text style={styles.kpiValue}>₹{metrics.totalNetPayable.toLocaleString('en-IN')}</Text>
          <Text style={styles.kpiSub}>Total Net Wages</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardPaid]}>
          <Text style={styles.kpiLabel}>DISBURSED</Text>
          <Text style={[styles.kpiValue, { color: colors.brandGreen }]}>
            ₹{metrics.totalPaid.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>{metrics.paidCount} staff paid</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardPending]}>
          <Text style={styles.kpiLabel}>PENDING</Text>
          <Text style={[styles.kpiValue, { color: '#D97706' }]}>
            ₹{metrics.totalPending.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiSub}>{metrics.pendingCount} unpaid</Text>
        </View>
      </View>

      {/* 3. Search & Filter Bar */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff payroll roster..."
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

        <View style={styles.filterPills}>
          {(['ALL', 'PENDING', 'PAID'] as const).map((tab) => {
            const isSelected = filter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setFilter(tab)}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. Staff Payroll List */}
      {isPayrollLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payroll records...</Text>
        </View>
      ) : filteredStaff.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cash-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Staff Members Found</Text>
          <Text style={styles.emptySubtitle}>
            {search ? `No staff matching "${search}"` : 'No delivery staff in this filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStaff}
          keyExtractor={(item) => item.staffId || item.id}
          renderItem={renderStaffPayrollCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modals */}
      <SalarySlipModal
        visible={!!selectedStaffForSlip}
        staff={selectedStaffForSlip}
        month={selectedMonth}
        existingSlip={selectedSlipForEdit}
        onClose={() => {
          setSelectedStaffForSlip(null);
          setSelectedSlipForEdit(null);
        }}
      />

      <DisburseSalaryModal
        visible={!!selectedSlipForPay}
        slip={selectedSlipForPay}
        onClose={() => setSelectedSlipForPay(null)}
      />

      <SalaryConfigModal
        visible={!!selectedStaffForConfig}
        staff={selectedStaffForConfig}
        onClose={() => setSelectedStaffForConfig(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
  },
  monthCenter: {
    alignItems: 'center',
  },
  monthTitle: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  monthSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  currentMonthPill: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentMonthPillText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.accent,
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
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  kpiCardPaid: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  kpiCardPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  kpiLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 2,
  },
  kpiValue: {
    ...typography.h3,
    fontSize: 14,
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
  filterPills: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
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
  payrollCard: {
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  baseSalaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgePaid: {
    backgroundColor: colors.statusDeliveredBg,
  },
  statusBadgePartial: {
    backgroundColor: colors.statusPendingBg,
  },
  statusBadgePending: {
    backgroundColor: colors.surfaceSubtle,
  },
  statusBadgeText: {
    ...typography.captionBold,
    fontSize: 9,
  },
  statusTextPaid: {
    color: colors.brandGreen,
  },
  statusTextPartial: {
    color: '#D97706',
  },
  statusTextPending: {
    color: colors.textMuted,
  },
  breakdownBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bdLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
  bdVal: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 1,
  },
  bdValNet: {
    fontSize: 14,
    color: colors.brandGreen,
  },
  paidInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  paidInfoText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  noSlipPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  noSlipText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 11,
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
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
    gap: 4,
  },
  calcBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.primary,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.brandGreen,
    gap: 4,
  },
  payBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.textInverse,
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
