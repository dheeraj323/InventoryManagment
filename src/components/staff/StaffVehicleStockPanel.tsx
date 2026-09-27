import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Staff, StaffDailyStockSession } from '../../types';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { formatDateTime } from '../../utils/dateFormatter';
import { colors, typography, spacing, shadows } from '../../theme';

interface StaffVehicleStockPanelProps {
  staffList: Staff[];
  onOpenStaffProfile?: (staff: Staff) => void;
}

export const StaffVehicleStockPanel: React.FC<StaffVehicleStockPanelProps> = ({
  staffList,
  onOpenStaffProfile,
}) => {
  const { allSessions, subscribeAllSessions, selectedDate, setSelectedDate } =
    useStaffStockStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAllSessions(selectedDate);
    return () => {
      if (unsub) unsub();
    };
  }, [selectedDate]);

  // Map of staffId -> StaffDailyStockSession for the selected date
  const sessionMap = useMemo(() => {
    const map: Record<string, StaffDailyStockSession> = {};
    allSessions.forEach((s) => {
      if (s.date === selectedDate) {
        map[s.staffId] = s;
      }
    });
    return map;
  }, [allSessions, selectedDate]);

  // Overall KPI Metrics for selected date
  const metrics = useMemo(() => {
    let activeVans = 0;
    let settledVans = 0;
    let discrepancyVans = 0;
    let totalLoaded = 0;
    let totalOutForDelivery = 0;
    let totalDelivered = 0;
    let totalInTransit = 0;
    let totalReturned = 0;

    Object.values(sessionMap).forEach((s) => {
      if (s.status === 'ACTIVE') activeVans++;
      if (s.status === 'RETURNED') settledVans++;
      if (s.status === 'DISCREPANCY') discrepancyVans++;

      totalLoaded += s.totalLoadedUnits || 0;
      totalDelivered += s.totalDeliveredUnits || 0;
      totalReturned += s.totalReturnedUnits || 0;

      if (s.status === 'ACTIVE') {
        totalOutForDelivery +=
          s.totalOutForDeliveryUnits ??
          (s.items || []).reduce((sum, it) => sum + (it.outForDeliveryQty || 0), 0);
        const inVan = (s.items || []).reduce((sum, it) => sum + (it.currentStock || 0), 0);
        totalInTransit += inVan;
      }
    });

    return {
      activeVans,
      settledVans,
      discrepancyVans,
      totalLoaded,
      totalOutForDelivery,
      totalDelivered,
      totalInTransit,
      totalReturned,
    };
  }, [sessionMap]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (s.status === 'SUSPENDED' || s.status === 'REJECTED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.phone?.includes(q) ||
          s.activeArea?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staffList, searchQuery]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yr}-${mo}-${day}`);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yr}-${mo}-${day}`);
  };

  const isToday = () => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return selectedDate === `${yr}-${mo}-${day}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Date Header Selector */}
      <View style={styles.dateSelectorRow}>
        <TouchableOpacity style={styles.dateArrowBtn} onPress={handlePrevDay} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.dateDisplayBlock}>
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
          <Text style={styles.dateDisplayText}>
            {selectedDate} {isToday() ? '(Today)' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.dateArrowBtn, isToday() && styles.dateArrowBtnDisabled]}
          onPress={handleNextDay}
          disabled={isToday()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isToday() ? colors.textMuted : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* 2. Top Summary Metrics Grid */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiRow}>
          {/* Active Vans */}
          <View style={styles.kpiTile}>
            <View style={[styles.kpiIconWrap, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="bicycle" size={18} color={colors.accent} />
            </View>
            <View style={styles.kpiInfo}>
              <Text style={styles.kpiValue}>{metrics.activeVans}</Text>
              <Text style={styles.kpiLabel}>Active Vans</Text>
            </View>
          </View>

          {/* On Way Out for Delivery */}
          <View style={styles.kpiTile}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="bicycle" size={18} color="#D97706" />
            </View>
            <View style={styles.kpiInfo}>
              <Text style={[styles.kpiValue, { color: '#D97706' }]}>
                {metrics.totalOutForDelivery}
              </Text>
              <Text style={styles.kpiLabel}>On Way (Out)</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {/* Delivered Units */}
          <View style={styles.kpiTile}>
            <View style={[styles.kpiIconWrap, { backgroundColor: colors.brandGreenLight }]}>
              <Ionicons name="checkmark-done-circle" size={18} color={colors.brandGreen} />
            </View>
            <View style={styles.kpiInfo}>
              <Text style={[styles.kpiValue, { color: colors.brandGreen }]}>
                {metrics.totalDelivered}
              </Text>
              <Text style={styles.kpiLabel}>Delivered Units</Text>
            </View>
          </View>

          {/* Settled / Returned Vans */}
          <View style={styles.kpiTile}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark" size={18} color={colors.brandGreen} />
            </View>
            <View style={styles.kpiInfo}>
              <Text style={styles.kpiValue}>{metrics.settledVans}</Text>
              <Text style={styles.kpiLabel}>Vans Settled</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff by name or area..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 4. Staff Delivery Vehicle Stock List */}
      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.staffId || item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const key = item.staffId || item.id;
          const session = sessionMap[key];
          const isExpanded = expandedStaffId === key;

          const hasSession = !!session;
          const isReturned = session?.status === 'RETURNED';
          const hasDiscrepancy = session?.status === 'DISCREPANCY';
          const isActive = session?.status === 'ACTIVE';

          const currentInVan = isReturned || hasDiscrepancy
            ? 0
            : session
            ? (session.items || []).reduce((sum, it) => sum + (it.currentStock || 0), 0)
            : 0;

          const currentOnWay = isReturned || hasDiscrepancy
            ? 0
            : session?.totalOutForDeliveryUnits ??
              (session?.items || []).reduce((sum, it) => sum + (it.outForDeliveryQty || 0), 0);

          return (
            <View style={styles.staffStockCard}>
              {/* Staff Header Row */}
              <TouchableOpacity
                style={styles.cardHeaderRow}
                onPress={() => setExpandedStaffId(isExpanded ? null : key)}
                activeOpacity={0.7}
              >
                <View style={styles.staffMetaBlock}>
                  <View style={styles.nameRow}>
                    <Text style={styles.staffNameText}>{item.name}</Text>
                    {item.activeArea ? (
                      <View style={styles.areaChip}>
                        <Text style={styles.areaChipText}>{item.activeArea}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.phoneText}>📞 {item.phone}</Text>
                </View>

                {/* Status Badge */}
                <View style={styles.statusBadgeBlock}>
                  <View
                    style={[
                      styles.statusPill,
                      isActive
                        ? styles.statusPillActive
                        : isReturned
                        ? styles.statusPillReturned
                        : hasDiscrepancy
                        ? styles.statusPillDiscrepancy
                        : styles.statusPillEmpty,
                    ]}
                  >
                    <Ionicons
                      name={
                        isActive
                          ? 'bicycle'
                          : isReturned
                          ? 'checkmark-done-circle'
                          : hasDiscrepancy
                          ? 'warning'
                          : 'ellipse-outline'
                      }
                      size={12}
                      color={
                        isActive
                          ? colors.accent
                          : isReturned
                          ? colors.brandGreen
                          : hasDiscrepancy
                          ? colors.danger
                          : colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        isActive
                          ? styles.statusPillTextActive
                          : isReturned
                          ? styles.statusPillTextReturned
                          : hasDiscrepancy
                          ? styles.statusPillTextDiscrepancy
                          : styles.statusPillTextEmpty,
                      ]}
                    >
                      {isActive
                        ? 'On Delivery'
                        : isReturned
                        ? 'Settled'
                        : hasDiscrepancy
                        ? `Variance (±${session.totalVarianceUnits})`
                        : 'Not Loaded'}
                    </Text>
                  </View>

                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                    style={{ marginTop: 4, alignSelf: 'flex-end' }}
                  />
                </View>
              </TouchableOpacity>

              {/* High-Level Stock Summary Chips */}
              {hasSession && (
                <View style={styles.stockSummaryRow}>
                  <View style={styles.stockChip}>
                    <Text style={styles.stockChipLabel}>Loaded</Text>
                    <Text style={styles.stockChipVal}>{session.totalLoadedUnits}</Text>
                  </View>

                  <View style={[styles.stockChip, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={[styles.stockChipLabel, { color: '#B45309' }]}>On Way</Text>
                    <Text style={[styles.stockChipVal, { color: '#D97706' }]}>
                      {currentOnWay}
                    </Text>
                  </View>

                  <View style={styles.stockChip}>
                    <Text style={styles.stockChipLabel}>Delivered</Text>
                    <Text style={[styles.stockChipVal, { color: colors.brandGreen }]}>
                      {session.totalDeliveredUnits}
                    </Text>
                  </View>

                  <View style={[styles.stockChip, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.stockChipLabel, { color: colors.accent }]}>
                      {isReturned || hasDiscrepancy ? 'Returned' : 'In Van'}
                    </Text>
                    <Text style={[styles.stockChipVal, { color: colors.accent }]}>
                      {isReturned || hasDiscrepancy ? session.totalReturnedUnits : currentInVan}
                    </Text>
                  </View>
                </View>
              )}

              {/* Expandable Product Line Items Accordion */}
              {isExpanded && (
                <View style={styles.accordionContent}>
                  <View style={styles.accordionDivider} />

                  {!hasSession ? (
                    <Text style={styles.emptySessionText}>
                      No vehicle stock sessions recorded for this date.
                    </Text>
                  ) : (
                    <>
                      <View style={styles.sessionMetaBanner}>
                        <Text style={styles.sessionMetaText}>
                          Loaded: {formatDateTime(session.loadedAt)}
                          {session.returnedAt ? ` • Returned: ${formatDateTime(session.returnedAt)}` : ''}
                        </Text>
                      </View>

                      {/* Items Header */}
                      <View style={styles.itemHeaderRow}>
                        <Text style={[styles.itemColHeader, { flex: 2.2 }]}>PRODUCT</Text>
                        <Text style={[styles.itemColHeader, styles.itemColRight]}>ROUTE</Text>
                        <Text style={[styles.itemColHeader, styles.itemColRight]}>EXTRA</Text>
                        <Text style={[styles.itemColHeader, styles.itemColRight, { color: '#B45309' }]}>
                          ON WAY
                        </Text>
                        <Text style={[styles.itemColHeader, styles.itemColRight]}>DELIV</Text>
                        <Text style={[styles.itemColHeader, styles.itemColRight]}>
                          {isReturned || hasDiscrepancy ? 'RESTOCK' : 'VAN'}
                        </Text>
                        {(session.totalDamagedUnits || 0) > 0 && (
                          <Text style={[styles.itemColHeader, styles.itemColRight, { color: colors.danger }]}>
                            DMG
                          </Text>
                        )}
                        {(session.totalMissingUnits || 0) > 0 && (
                          <Text style={[styles.itemColHeader, styles.itemColRight, { color: '#B45309' }]}>
                            MISS
                          </Text>
                        )}
                        {hasDiscrepancy && (
                          <Text style={[styles.itemColHeader, styles.itemColRight, { color: colors.danger }]}>
                            DIFF
                          </Text>
                        )}
                      </View>

                      {/* Line Items */}
                      {(session.items || []).map((it) => (
                        <View key={it.productId} style={styles.productLineRow}>
                          <View style={{ flex: 2.2 }}>
                            <Text style={styles.productLineName} numberOfLines={1}>
                              {it.productName}
                            </Text>
                            <Text style={styles.productLineUnit}>{it.unit}</Text>
                          </View>

                          <Text style={[styles.productLineVal, styles.itemColRight, { color: colors.brandGreen }]}>
                            {it.preOrderedQty || 0}
                          </Text>
                          <Text style={[styles.productLineVal, styles.itemColRight, { color: colors.accent }]}>
                            {it.extraLoadedQty || 0}
                          </Text>
                          <Text
                            style={[
                              styles.productLineVal,
                              styles.itemColRight,
                              {
                                color: isReturned || hasDiscrepancy ? colors.textMuted : '#D97706',
                                fontWeight: '600',
                              },
                            ]}
                          >
                            {isReturned || hasDiscrepancy ? 0 : it.outForDeliveryQty || 0}
                          </Text>
                          <Text style={[styles.productLineVal, styles.itemColRight, { color: colors.primary }]}>
                            {it.deliveredQty}
                          </Text>
                          <Text
                            style={[
                              styles.productLineVal,
                              styles.itemColRight,
                              { color: colors.textPrimary, fontWeight: '700' },
                            ]}
                          >
                            {isReturned || hasDiscrepancy ? it.returnedQty || 0 : it.currentStock}
                          </Text>
                          {(session.totalDamagedUnits || 0) > 0 && (
                            <Text
                              style={[
                                styles.productLineVal,
                                styles.itemColRight,
                                { color: it.damagedQty ? colors.danger : colors.textMuted },
                              ]}
                            >
                              {it.damagedQty || 0}
                            </Text>
                          )}
                          {(session.totalMissingUnits || 0) > 0 && (
                            <Text
                              style={[
                                styles.productLineVal,
                                styles.itemColRight,
                                { color: it.missingQty ? '#B45309' : colors.textMuted },
                              ]}
                            >
                              {it.missingQty || 0}
                            </Text>
                          )}
                          {hasDiscrepancy && (
                            <Text
                              style={[
                                styles.productLineVal,
                                styles.itemColRight,
                                {
                                  color:
                                    it.varianceQty && it.varianceQty !== 0
                                      ? colors.danger
                                      : colors.textMuted,
                                },
                              ]}
                            >
                              {it.varianceQty
                                ? it.varianceQty > 0
                                  ? `-${it.varianceQty}`
                                  : `+${Math.abs(it.varianceQty)}`
                                : '-'}
                            </Text>
                          )}
                        </View>
                      ))}

                      {session.notes ? (
                        <View style={styles.sessionNotesBox}>
                          <Text style={styles.sessionNotesText}>Notes: {session.notes}</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Staff Members Found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateArrowBtnDisabled: {
    opacity: 0.35,
  },
  dateDisplayBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateDisplayText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  kpiContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  kpiTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiInfo: {
    flex: 1,
  },
  kpiValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  searchSection: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingHorizontal: spacing.md,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: 40,
  },
  staffStockCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffMetaBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  staffNameText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  areaChip: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  areaChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  phoneText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadgeBlock: {
    alignItems: 'flex-end',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusFull,
    gap: 4,
  },
  statusPillActive: {
    backgroundColor: '#EFF6FF',
  },
  statusPillReturned: {
    backgroundColor: '#DCFCE7',
  },
  statusPillDiscrepancy: {
    backgroundColor: '#FEE2E2',
  },
  statusPillEmpty: {
    backgroundColor: colors.surfaceSubtle,
  },
  statusPillText: {
    ...typography.captionBold,
    fontSize: 10,
  },
  statusPillTextActive: {
    color: colors.accent,
  },
  statusPillTextReturned: {
    color: colors.brandGreen,
  },
  statusPillTextDiscrepancy: {
    color: colors.danger,
  },
  statusPillTextEmpty: {
    color: colors.textMuted,
  },
  stockSummaryRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  stockChip: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusSm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockChipLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  stockChipVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    marginTop: 1,
  },
  accordionContent: {
    marginTop: spacing.sm,
  },
  accordionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptySessionText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  sessionMetaBanner: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: spacing.xs + 2,
  },
  sessionMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  itemColHeader: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  itemColRight: {
    flex: 1,
    textAlign: 'right',
  },
  productLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  productLineName: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 12,
  },
  productLineUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  productLineVal: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 12,
  },
  sessionNotesBox: {
    marginTop: spacing.xs,
    padding: spacing.xs + 2,
    backgroundColor: '#FFFBEB',
    borderRadius: 4,
  },
  sessionNotesText: {
    ...typography.caption,
    color: '#92400E',
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 8,
  },
});
