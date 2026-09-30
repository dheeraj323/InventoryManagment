import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, AttendanceStatus, StaffAttendance } from '../../types';
import {
  useStaffPayrollStore,
  getTodayDateString,
  getCurrentMonthString,
} from '../../store/useStaffPayrollStore';
import { formatDate } from '../../utils/dateFormatter';
import { StaffMonthlyAttendanceModal } from './StaffMonthlyAttendanceModal';
import { colors, typography, spacing, shadows } from '../../theme';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';

interface DailyAttendancePanelProps {
  staffList: Staff[];
  onOpenStaffProfile?: (staff: Staff) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type AttendanceViewMode = 'DAILY' | 'MONTHLY';

export const DailyAttendancePanel: React.FC<DailyAttendancePanelProps> = ({
  staffList,
  onOpenStaffProfile,
}) => {
  const {
    selectedDate,
    selectedMonth,
    dailyAttendanceMap,
    monthlyAttendanceRecords,
    isAttendanceLoading,
    isMonthlyAttendanceLoading,
    setSelectedDate,
    setSelectedMonth,
    subscribeMonthlyAttendance,
    markAttendance,
    batchMarkAttendance,
  } = useStaffPayrollStore();

  const [viewMode, setViewMode] = useState<AttendanceViewMode>('DAILY');
  const [search, setSearch] = useState('');
  const [markingStaffId, setMarkingStaffId] = useState<string | null>(null);

  // Modal for individual staff monthly breakdown
  const [selectedStaffForMonthly, setSelectedStaffForMonthly] = useState<Staff | null>(null);

  const todayStr = getTodayDateString();
  const isToday = selectedDate === todayStr;
  const currentMonthStr = getCurrentMonthString();
  const isCurrentMonth = selectedMonth === currentMonthStr;

  // Subscribe to monthly records on mount or month change
  useEffect(() => {
    subscribeMonthlyAttendance(selectedMonth);
  }, [selectedMonth]);

  // Active staff filter
  const activeStaff = useMemo(() => {
    return staffList.filter((s) => s.status === 'ACTIVE' || (s.active && s.status !== 'SUSPENDED'));
  }, [staffList]);

  // Filtered by search
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return activeStaff;
    const q = search.toLowerCase().trim();
    return activeStaff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.activeArea?.toLowerCase().includes(q)
    );
  }, [activeStaff, search]);

  // ─── DAILY METRICS ─────────────────────────────────────────────────────────
  const dailyMetrics = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let leave = 0;
    let notMarked = 0;

    activeStaff.forEach((s) => {
      const key = s.staffId || s.id;
      const att = dailyAttendanceMap[key];
      if (!att) {
        notMarked++;
      } else if (att.status === 'PRESENT') {
        present++;
      } else if (att.status === 'HALF_DAY') {
        halfDay++;
      } else if (att.status === 'ABSENT') {
        absent++;
      } else if (att.status === 'LEAVE') {
        leave++;
      } else {
        notMarked++;
      }
    });

    return {
      total: activeStaff.length,
      present,
      halfDay,
      absent,
      leave,
      notMarked,
    };
  }, [activeStaff, dailyAttendanceMap]);

  // ─── MONTHLY AGGREGATIONS ──────────────────────────────────────────────────
  const [monthYear, monthNum] = (selectedMonth || getCurrentMonthString()).split('-');
  const monthNameDisplay = useMemo(() => {
    const mIdx = parseInt(monthNum, 10) - 1;
    return `${MONTH_NAMES[mIdx] || monthNum} ${monthYear}`;
  }, [monthYear, monthNum]);

  const totalDaysInSelectedMonth = useMemo(() => {
    const y = parseInt(monthYear, 10);
    const m = parseInt(monthNum, 10);
    return new Date(y, m, 0).getDate();
  }, [monthYear, monthNum]);

  // Per-staff monthly attendance counts mapping
  const staffMonthlyStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        present: number;
        halfDay: number;
        absent: number;
        leave: number;
        recordedDays: number;
        payableDays: number;
        rate: number;
      }
    > = {};

    activeStaff.forEach((s) => {
      const key = s.staffId || s.id;
      map[key] = {
        present: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        recordedDays: 0,
        payableDays: 0,
        rate: 0,
      };
    });

    monthlyAttendanceRecords.forEach((rec) => {
      const entry = map[rec.staffId];
      if (entry) {
        if (rec.status === 'PRESENT') entry.present++;
        else if (rec.status === 'HALF_DAY') entry.halfDay++;
        else if (rec.status === 'ABSENT') entry.absent++;
        else if (rec.status === 'LEAVE') entry.leave++;
      }
    });

    // Calculate rates and payable days
    Object.keys(map).forEach((k) => {
      const e = map[k];
      e.recordedDays = e.present + e.halfDay + e.absent + e.leave;
      e.payableDays = e.present + e.halfDay * 0.5;
      e.rate = e.recordedDays > 0 ? Math.round((e.payableDays / e.recordedDays) * 100) : 0;
    });

    return map;
  }, [activeStaff, monthlyAttendanceRecords]);

  // Overall monthly total counters
  const monthlyOverallMetrics = useMemo(() => {
    let totalPresent = 0;
    let totalHalfDay = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalPayable = 0;

    Object.values(staffMonthlyStatsMap).forEach((stat) => {
      totalPresent += stat.present;
      totalHalfDay += stat.halfDay;
      totalAbsent += stat.absent;
      totalLeave += stat.leave;
      totalPayable += stat.payableDays;
    });

    const totalRecorded = totalPresent + totalHalfDay + totalAbsent + totalLeave;
    const avgRate = totalRecorded > 0 ? Math.round((totalPayable / totalRecorded) * 100) : 0;

    return {
      totalPresent,
      totalHalfDay,
      totalAbsent,
      totalLeave,
      totalPayable,
      totalRecorded,
      avgRate,
    };
  }, [staffMonthlyStatsMap]);

  // ─── NAVIGATORS ────────────────────────────────────────────────────────────
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

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

  const handleSetCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthString());
  };

  // ─── STATUS MARKING ────────────────────────────────────────────────────────
  const handleMarkStatus = async (staff: Staff, status: AttendanceStatus) => {
    const key = staff.staffId || staff.id;
    setMarkingStaffId(key);
    try {
      await markAttendance({
        staffId: key,
        staffName: staff.name,
        date: selectedDate,
        status,
      });
    } catch (err: any) {
      Alert.alert('Error', getFriendlyErrorMessage(err, 'Failed to update attendance. Please try again.'));
    } finally {
      setMarkingStaffId(null);
    }
  };

  const handleBatchMarkPresent = () => {
    Alert.alert(
      'Mark All Present',
      `Mark all ${activeStaff.length} active staff members as PRESENT for ${formatDate(selectedDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm All Present',
          onPress: async () => {
            try {
              await batchMarkAttendance(activeStaff, 'PRESENT', selectedDate);
              Alert.alert('Success', `All staff marked as present for ${formatDate(selectedDate)}.`);
            } catch (err: any) {
              Alert.alert('Error', getFriendlyErrorMessage(err, 'Failed to batch mark attendance. Please try again.'));
            }
          },
        },
      ]
    );
  };

  // ─── RENDER DAILY STAFF CARD ───────────────────────────────────────────────
  const renderDailyItem = ({ item }: { item: Staff }) => {
    const staffKey = item.staffId || item.id;
    const attRecord: StaffAttendance | undefined = dailyAttendanceMap[staffKey];
    const currentStatus = attRecord?.status;
    const isBusy = markingStaffId === staffKey;

    return (
      <View style={styles.staffCard}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity
            style={styles.cardInfoRow}
            onPress={() => onOpenStaffProfile?.(item)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.staffMeta}>
              <Text style={styles.staffName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.routeRow}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.routeText}>{item.assignedRouteName || item.activeArea || 'No Route'}</Text>
                {attRecord?.checkInTime && (
                  <>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Ionicons name="time-outline" size={11} color={colors.brandGreen} />
                    <Text style={styles.timeText}>{attRecord.checkInTime}</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {isBusy && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} />}
        </View>

        {/* 4 Status Buttons */}
        <View style={styles.statusButtonsRow}>
          {/* Present */}
          <TouchableOpacity
            style={[
              styles.statusBtn,
              styles.presentBtn,
              currentStatus === 'PRESENT' && styles.presentBtnActive,
            ]}
            onPress={() => handleMarkStatus(item, 'PRESENT')}
            activeOpacity={0.7}
            disabled={isBusy}
          >
            <Ionicons
              name={currentStatus === 'PRESENT' ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={14}
              color={currentStatus === 'PRESENT' ? colors.textInverse : colors.brandGreen}
            />
            <Text
              style={[
                styles.statusBtnText,
                styles.presentBtnText,
                currentStatus === 'PRESENT' && styles.statusBtnTextActive,
              ]}
            >
              Present
            </Text>
          </TouchableOpacity>

          {/* Half Day */}
          <TouchableOpacity
            style={[
              styles.statusBtn,
              styles.halfDayBtn,
              currentStatus === 'HALF_DAY' && styles.halfDayBtnActive,
            ]}
            onPress={() => handleMarkStatus(item, 'HALF_DAY')}
            activeOpacity={0.7}
            disabled={isBusy}
          >
            <Ionicons
              name={currentStatus === 'HALF_DAY' ? 'pie-chart' : 'pie-chart-outline'}
              size={13}
              color={currentStatus === 'HALF_DAY' ? colors.textInverse : '#D97706'}
            />
            <Text
              style={[
                styles.statusBtnText,
                styles.halfDayBtnText,
                currentStatus === 'HALF_DAY' && styles.statusBtnTextActive,
              ]}
            >
              Half Day
            </Text>
          </TouchableOpacity>

          {/* Absent */}
          <TouchableOpacity
            style={[
              styles.statusBtn,
              styles.absentBtn,
              currentStatus === 'ABSENT' && styles.absentBtnActive,
            ]}
            onPress={() => handleMarkStatus(item, 'ABSENT')}
            activeOpacity={0.7}
            disabled={isBusy}
          >
            <Ionicons
              name={currentStatus === 'ABSENT' ? 'close-circle' : 'close-circle-outline'}
              size={14}
              color={currentStatus === 'ABSENT' ? colors.textInverse : colors.danger}
            />
            <Text
              style={[
                styles.statusBtnText,
                styles.absentBtnText,
                currentStatus === 'ABSENT' && styles.statusBtnTextActive,
              ]}
            >
              Absent
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── RENDER MONTHLY STAFF CARD ─────────────────────────────────────────────
  const renderMonthlyItem = ({ item }: { item: Staff }) => {
    const staffKey = item.staffId || item.id;
    const stat = staffMonthlyStatsMap[staffKey] || {
      present: 0,
      halfDay: 0,
      absent: 0,
      leave: 0,
      recordedDays: 0,
      payableDays: 0,
      rate: 0,
    };

    return (
      <View style={styles.monthlyStaffCard}>
        {/* Top Info */}
        <View style={styles.monthlyCardHeader}>
          <TouchableOpacity
            style={styles.cardInfoRow}
            onPress={() => onOpenStaffProfile?.(item)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.staffMeta}>
              <Text style={styles.staffName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.routeRow}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.routeText}>{item.assignedRouteName || item.activeArea || 'No Route'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Monthly Breakdown Counters ── */}
        <View style={styles.monthlyCountsGrid}>
          {/* Present */}
          <View style={[styles.miniCountBox, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.miniCountNum, { color: colors.brandGreen }]}>{stat.present}</Text>
            <Text style={styles.miniCountLabel}>Present</Text>
          </View>

          {/* Half Day */}
          <View style={[styles.miniCountBox, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
            <Text style={[styles.miniCountNum, { color: '#D97706' }]}>{stat.halfDay}</Text>
            <Text style={styles.miniCountLabel}>Half Day</Text>
          </View>

          {/* Absent */}
          <View style={[styles.miniCountBox, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.miniCountNum, { color: colors.danger }]}>{stat.absent}</Text>
            <Text style={styles.miniCountLabel}>Absent</Text>
          </View>
        </View>

        {/* Action Button: View Full Calendar / Log */}
        <TouchableOpacity
          style={styles.viewLogBtn}
          onPress={() => setSelectedStaffForMonthly(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar" size={13} color={colors.accent} />
          <Text style={styles.viewLogBtnText}>
            View {monthNameDisplay} Day-by-Day Log
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.accent} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Top View Mode Switcher: [Daily Log] | [Monthly Summary] ── */}
      <View style={styles.modeSegmentWrap}>
        <TouchableOpacity
          style={[styles.modeSegmentBtn, viewMode === 'DAILY' && styles.modeSegmentBtnActive]}
          onPress={() => setViewMode('DAILY')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-clear-outline"
            size={14}
            color={viewMode === 'DAILY' ? colors.textInverse : colors.textSecondary}
          />
          <Text
            style={[
              styles.modeSegmentText,
              viewMode === 'DAILY' && styles.modeSegmentTextActive,
            ]}
          >
            Daily Log
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeSegmentBtn, viewMode === 'MONTHLY' && styles.modeSegmentBtnActive]}
          onPress={() => setViewMode('MONTHLY')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={viewMode === 'MONTHLY' ? colors.textInverse : colors.textSecondary}
          />
          <Text
            style={[
              styles.modeSegmentText,
              viewMode === 'MONTHLY' && styles.modeSegmentTextActive,
            ]}
          >
            Monthly Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══════════════════════════════════════════════════════════
          MODE 1: DAILY VIEW
      ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'DAILY' && (
        <>
          {/* 1. Date Navigator Bar */}
          <View style={styles.dateBar}>
            <TouchableOpacity onPress={handlePrevDay} style={styles.dateNavBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.dateCenter}>
              <Text style={styles.dateTitle}>{formatDate(selectedDate)}</Text>
              <Text style={styles.dateSub}>
                {isToday ? 'Today' : new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long' })}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextDay} style={styles.dateNavBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>

            {!isToday && (
              <TouchableOpacity onPress={handleSetToday} style={styles.todayPill}>
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. Daily KPI Counters */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiPresent]}>
              <Text style={styles.kpiNum}>{dailyMetrics.present}</Text>
              <Text style={styles.kpiTitle}>Present</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiHalfDay]}>
              <Text style={styles.kpiNum}>{dailyMetrics.halfDay}</Text>
              <Text style={styles.kpiTitle}>Half Day</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiAbsent]}>
              <Text style={styles.kpiNum}>{dailyMetrics.absent}</Text>
              <Text style={styles.kpiTitle}>Absent</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiUnmarked]}>
              <Text style={styles.kpiNum}>{dailyMetrics.notMarked}</Text>
              <Text style={styles.kpiTitle}>Pending</Text>
            </View>
          </View>

          {/* 3. Search & Batch Action Bar */}
          <View style={styles.actionBar}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Filter staff by name/area..."
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
              style={styles.batchBtn}
              onPress={handleBatchMarkPresent}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={15} color={colors.brandGreen} />
              <Text style={styles.batchBtnText}>All Present</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Staff Attendance Roster List */}
          {isAttendanceLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Syncing attendance data...</Text>
            </View>
          ) : filteredStaff.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Staff Found</Text>
              <Text style={styles.emptySubtitle}>
                {search ? `No staff matching "${search}"` : 'No active delivery staff roster available.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => item.staffId || item.id}
              renderItem={renderDailyItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODE 2: MONTHLY SUMMARY VIEW
      ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'MONTHLY' && (
        <>
          {/* 1. Month Navigator Bar */}
          <View style={styles.dateBar}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.dateNavBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.dateCenter}>
              <Text style={styles.dateTitle}>{monthNameDisplay}</Text>
              <Text style={styles.dateSub}>
                {totalDaysInSelectedMonth} Total Days • {activeStaff.length} Staff Members
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.dateNavBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>

            {!isCurrentMonth && (
              <TouchableOpacity onPress={handleSetCurrentMonth} style={styles.todayPill}>
                <Text style={styles.todayPillText}>This Month</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. Monthly Team Totals KPI Cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiPresent]}>
              <Text style={styles.kpiNum}>{monthlyOverallMetrics.totalPresent}</Text>
              <Text style={styles.kpiTitle}>Total Present</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiHalfDay]}>
              <Text style={styles.kpiNum}>{monthlyOverallMetrics.totalHalfDay}</Text>
              <Text style={styles.kpiTitle}>Half Days</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiAbsent]}>
              <Text style={styles.kpiNum}>{monthlyOverallMetrics.totalAbsent}</Text>
              <Text style={styles.kpiTitle}>Absents</Text>
            </View>
          </View>

          {/* 3. Staff Monthly Cards List */}
          {isMonthlyAttendanceLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Calculating monthly attendance summaries...</Text>
            </View>
          ) : activeStaff.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Staff</Text>
              <Text style={styles.emptySubtitle}>
                No active staff members found in roster.
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeStaff}
              keyExtractor={(item) => item.staffId || item.id}
              renderItem={renderMonthlyItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* ── Modal for Staff Day-by-Day Monthly Log ── */}
      <StaffMonthlyAttendanceModal
        visible={!!selectedStaffForMonthly}
        staff={selectedStaffForMonthly}
        month={selectedMonth}
        onClose={() => setSelectedStaffForMonthly(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeSegmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  modeSegmentBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  modeSegmentText: {
    ...typography.captionBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modeSegmentTextActive: {
    color: colors.textInverse,
  },
  dateBar: {
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
  dateNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateTitle: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  dateSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  todayPill: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayPillText: {
    ...typography.captionBold,
    fontSize: 10,
    color: colors.accent,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  kpiPresent: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  kpiHalfDay: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  kpiAbsent: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  kpiUnmarked: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kpiNum: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  kpiTitle: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandGreenLight,
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    gap: 4,
  },
  batchBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.xs,
    gap: 10,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    fontSize: 16,
    color: colors.primary,
  },
  staffMeta: {
    flex: 1,
  },
  staffName: {
    ...typography.h3,
    fontSize: 14,
    color: colors.textPrimary,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  routeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dotSeparator: {
    color: colors.textMuted,
    fontSize: 10,
  },
  timeText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.brandGreen,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  presentBtn: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  presentBtnActive: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  halfDayBtn: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  halfDayBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  absentBtn: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  absentBtnActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  statusBtnText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  presentBtnText: {
    color: colors.brandGreen,
  },
  halfDayBtnText: {
    color: '#D97706',
  },
  absentBtnText: {
    color: colors.danger,
  },
  statusBtnTextActive: {
    color: colors.textInverse,
  },
  // ─── Monthly Card Specific Styles ───
  monthlyStaffCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadows.sm,
    gap: 10,
  },
  monthlyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthlyCountsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  miniCountBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniCountNum: {
    ...typography.h3,
    fontSize: 13,
  },
  miniCountLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  viewLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 7,
    gap: 6,
  },
  viewLogBtnText: {
    ...typography.captionBold,
    fontSize: 11,
    color: colors.primary,
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
