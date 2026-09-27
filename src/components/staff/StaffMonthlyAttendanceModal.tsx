import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, AttendanceStatus, StaffAttendance } from '../../types';
import { useStaffPayrollStore } from '../../store/useStaffPayrollStore';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface StaffMonthlyAttendanceModalProps {
  visible: boolean;
  staff: Staff | null;
  month: string; // YYYY-MM
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_CONFIG: Record<
  AttendanceStatus | 'UNMARKED',
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  PRESENT: { label: 'Present', color: colors.brandGreen, bg: '#DCFCE7', icon: 'checkmark-circle' },
  HALF_DAY: { label: 'Half Day', color: '#D97706', bg: '#FEF3C7', icon: 'pie-chart' },
  ABSENT: { label: 'Absent', color: colors.danger, bg: '#FEE2E2', icon: 'close-circle' },
  LEAVE: { label: 'Leave', color: colors.accent, bg: '#DBEAFE', icon: 'calendar' },
  UNMARKED: { label: 'Not Marked', color: colors.textMuted, bg: colors.surfaceSubtle, icon: 'ellipse-outline' },
};

export const StaffMonthlyAttendanceModal: React.FC<StaffMonthlyAttendanceModalProps> = ({
  visible,
  staff,
  month,
  onClose,
}) => {
  const { monthlyAttendanceRecords } = useStaffPayrollStore();
  const [filter, setFilter] = useState<'ALL' | 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'UNMARKED'>('ALL');

  // Month Display
  const monthTitle = useMemo(() => {
    if (!month) return '';
    const [y, m] = month.split('-');
    const mIdx = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[mIdx] || m} ${y}`;
  }, [month]);

  // Total days in month
  const totalDaysInMonth = useMemo(() => {
    if (!month) return 30;
    const [year, m] = month.split('-').map((x) => parseInt(x, 10));
    return new Date(year, m, 0).getDate();
  }, [month]);

  const staffKey = staff?.staffId || staff?.id || '';

  // Filter records for this staff in this month
  const staffRecordsMap = useMemo(() => {
    const map: Record<string, StaffAttendance> = {};
    monthlyAttendanceRecords.forEach((rec) => {
      if (rec.staffId === staffKey) {
        map[rec.date] = rec;
      }
    });
    return map;
  }, [monthlyAttendanceRecords, staffKey]);

  // Build full day-by-day array for the whole month
  const allDaysList = useMemo(() => {
    if (!month || !staff) return [];
    const [year, m] = month.split('-').map((x) => parseInt(x, 10));
    const days = [];

    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dayStr = String(dayNum).padStart(2, '0');
      const dateStr = `${month}-${dayStr}`;
      const d = new Date(year, m - 1, dayNum);
      const dayOfWeek = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const record = staffRecordsMap[dateStr];
      const status: AttendanceStatus | 'UNMARKED' = record ? record.status : 'UNMARKED';

      days.push({
        dateStr,
        dayNum,
        dayOfWeek,
        record,
        status,
        isSunday: d.getDay() === 0,
      });
    }

    return days;
  }, [month, staff, totalDaysInMonth, staffRecordsMap]);

  // Aggregate stats
  const stats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let leave = 0;
    let unmarked = 0;

    allDaysList.forEach((d) => {
      if (d.status === 'PRESENT') present++;
      else if (d.status === 'HALF_DAY') halfDay++;
      else if (d.status === 'ABSENT') absent++;
      else if (d.status === 'LEAVE') leave++;
      else unmarked++;
    });

    const recordedDays = present + halfDay + absent + leave;
    const payableDays = present + halfDay * 0.5;
    const rate = recordedDays > 0 ? Math.round((payableDays / recordedDays) * 100) : 0;

    return {
      present,
      halfDay,
      absent,
      leave,
      unmarked,
      recordedDays,
      payableDays,
      rate,
    };
  }, [allDaysList]);

  // Filtered day list
  const filteredDays = useMemo(() => {
    if (filter === 'ALL') return allDaysList;
    return allDaysList.filter((d) => d.status === filter);
  }, [allDaysList, filter]);

  if (!staff) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.sheetHandle}>
            <View style={styles.sheetHandleBar} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{staff.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{staff.name}</Text>
              <Text style={styles.staffSub}>
                {staff.assignedRouteName || staff.activeArea || 'No Route'} • {monthTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* KPI Card Grid */}
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
                  <Text style={[styles.kpiNum, { color: colors.brandGreen }]}>{stats.present}</Text>
                  <Text style={styles.kpiLabel}>Present</Text>
                </View>
                <View style={[styles.kpiCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                  <Text style={[styles.kpiNum, { color: '#D97706' }]}>{stats.halfDay}</Text>
                  <Text style={styles.kpiLabel}>Half Day</Text>
                </View>
                <View style={[styles.kpiCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.kpiNum, { color: colors.danger }]}>{stats.absent}</Text>
                  <Text style={styles.kpiLabel}>Absent</Text>
                </View>
              </View>
            </View>

            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {[
                { key: 'ALL', label: `All (${totalDaysInMonth})` },
                { key: 'PRESENT', label: `Present (${stats.present})` },
                { key: 'HALF_DAY', label: `Half Day (${stats.halfDay})` },
                { key: 'ABSENT', label: `Absent (${stats.absent})` },
                { key: 'UNMARKED', label: `Not Marked (${stats.unmarked})` },
              ].map((f) => {
                const isSelected = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                    onPress={() => setFilter(f.key as any)}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Day by Day Log */}
            <View style={styles.dayList}>
              <Text style={styles.sectionTitle}>Daily Attendance Breakdown</Text>

              {filteredDays.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No records matching filter.</Text>
                </View>
              ) : (
                filteredDays.map((d) => {
                  const cfg = STATUS_CONFIG[d.status];

                  return (
                    <View
                      key={d.dateStr}
                      style={[
                        styles.dayRow,
                        d.isSunday && styles.dayRowSunday,
                      ]}
                    >
                      {/* Left: Date info */}
                      <View style={styles.dateInfo}>
                        <Text style={styles.dateNumText}>{d.dayNum}</Text>
                        <View>
                          <Text style={styles.dateMainText}>{formatDate(d.dateStr)}</Text>
                          <Text style={[styles.dateSubText, d.isSunday && { color: colors.danger }]}>
                            {d.dayOfWeek} {d.isSunday ? '• Sunday' : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Middle: Check-in Time & Notes */}
                      {d.record?.checkInTime && (
                        <View style={styles.checkInRow}>
                          <Ionicons name="time-outline" size={11} color={colors.brandGreen} />
                          <Text style={styles.checkInText}>{d.record.checkInTime}</Text>
                        </View>
                      )}

                      {/* Right: Status Badge (Read-only status display) */}
                      <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                        <Text style={[styles.statusChipText, { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    fontSize: 16,
    color: colors.primary,
  },
  staffName: {
    ...typography.h3,
    fontSize: 15,
    color: colors.textPrimary,
  },
  staffSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSubtle,
  },
  body: {
    padding: spacing.md,
  },
  kpiContainer: {
    gap: 8,
    marginBottom: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    ...shadows.sm,
  },
  kpiNum: {
    ...typography.h3,
    fontSize: 16,
  },
  kpiLabel: {
    ...typography.captionBold,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  filterRow: {
    gap: 6,
    paddingBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
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
  dayList: {
    marginTop: spacing.sm,
    gap: 8,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  dayRowSunday: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateNumText: {
    ...typography.h3,
    fontSize: 14,
    color: colors.primary,
    width: 24,
    textAlign: 'center',
  },
  dateMainText: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  dateSubText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 8,
  },
  checkInText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusChipText: {
    ...typography.captionBold,
    fontSize: 11,
  },
  emptyWrap: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
  },
});
