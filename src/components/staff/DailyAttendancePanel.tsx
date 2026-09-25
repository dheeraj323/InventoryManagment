import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, AttendanceStatus, StaffAttendance } from '../../types';
import { useStaffPayrollStore, getTodayDateString } from '../../store/useStaffPayrollStore';
import { formatDate } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface DailyAttendancePanelProps {
  staffList: Staff[];
  onOpenStaffProfile?: (staff: Staff) => void;
}

export const DailyAttendancePanel: React.FC<DailyAttendancePanelProps> = ({
  staffList,
  onOpenStaffProfile,
}) => {
  const {
    selectedDate,
    dailyAttendanceMap,
    isAttendanceLoading,
    setSelectedDate,
    markAttendance,
    batchMarkAttendance,
  } = useStaffPayrollStore();

  const [search, setSearch] = useState('');
  const [markingStaffId, setMarkingStaffId] = useState<string | null>(null);

  const todayStr = getTodayDateString();
  const isToday = selectedDate === todayStr;

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

  // Attendance metrics for the selected date
  const metrics = useMemo(() => {
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

  // Date Navigator handlers
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

  // Status marking
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
      Alert.alert('Error', err.message || 'Failed to update attendance.');
    } finally {
      setMarkingStaffId(null);
    }
  };

  // Batch mark all active staff as present
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
              Alert.alert('Error', err.message || 'Failed to batch mark attendance.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Staff }) => {
    const staffKey = item.staffId || item.id;
    const attRecord: StaffAttendance | undefined = dailyAttendanceMap[staffKey];
    const currentStatus = attRecord?.status;
    const isBusy = markingStaffId === staffKey;

    return (
      <View style={styles.staffCard}>
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

          {isBusy && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
        </TouchableOpacity>

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

          {/* Leave */}
          <TouchableOpacity
            style={[
              styles.statusBtn,
              styles.leaveBtn,
              currentStatus === 'LEAVE' && styles.leaveBtnActive,
            ]}
            onPress={() => handleMarkStatus(item, 'LEAVE')}
            activeOpacity={0.7}
            disabled={isBusy}
          >
            <Ionicons
              name={currentStatus === 'LEAVE' ? 'calendar' : 'calendar-outline'}
              size={13}
              color={currentStatus === 'LEAVE' ? colors.textInverse : colors.accent}
            />
            <Text
              style={[
                styles.statusBtnText,
                styles.leaveBtnText,
                currentStatus === 'LEAVE' && styles.statusBtnTextActive,
              ]}
            >
              Leave
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
          <Text style={styles.kpiNum}>{metrics.present}</Text>
          <Text style={styles.kpiTitle}>Present</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiHalfDay]}>
          <Text style={styles.kpiNum}>{metrics.halfDay}</Text>
          <Text style={styles.kpiTitle}>Half Day</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiAbsent]}>
          <Text style={styles.kpiNum}>{metrics.absent}</Text>
          <Text style={styles.kpiTitle}>Absent</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiLeave]}>
          <Text style={styles.kpiNum}>{metrics.leave}</Text>
          <Text style={styles.kpiTitle}>Leave</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiUnmarked]}>
          <Text style={styles.kpiNum}>{metrics.notMarked}</Text>
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
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  kpiLeave: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
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
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  leaveBtn: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  leaveBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
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
  leaveBtnText: {
    color: colors.accent,
  },
  statusBtnTextActive: {
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
