import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useCashStore } from '../../store/useCashStore';
import { useStaffStockStore } from '../../store/useStaffStockStore';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import {
  MorningStockLoadModal,
  EveningStockReturnModal,
  StaffVehicleStockModal,
  StaffLoadPlanModal,
} from '../../components/staff';
import { colors, typography, spacing, shadows } from '../../theme';

export const StaffDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser, activeRole, activeStaffId } = useAuthStore();
  const { getOrdersByStaff, orders, dispatchAllStaffOrders } = useOrderStore();
  const { settlements, getStaffCashInHand } = useCashStore();
  const { todaySession, subscribeTodaySession } = useStaffStockStore();

  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isViewStockModalOpen, setIsViewStockModalOpen] = useState(false);
  const [isLoadPlanModalOpen, setIsLoadPlanModalOpen] = useState(false);
  const [isDispatchingAll, setIsDispatchingAll] = useState(false);

  const staff = {
    id: activeStaffId || currentUser?.staffId || currentUser?.id || '',
    name: currentUser?.name || 'Delivery Executive',
    cashInHand: getStaffCashInHand(activeStaffId || currentUser?.staffId || '', orders),
  };

  useEffect(() => {
    if (staff.id) {
      const unsub = subscribeTodaySession(staff.id);
      return () => {
        if (unsub) unsub();
      };
    }
  }, [staff.id]);

  // Get assigned orders (excluding pending approval orders)
  const staffAssigned = getOrdersByStaff(staff.id);
  const assignedOrders = staffAssigned;
  const isDeliveryCompleted = (status: string) =>
    status === 'DELIVERED' || status === 'PARTIALLY_DELIVERED';
  const isDeliveryPending = (status: string) =>
    status !== 'DELIVERED' &&
    status !== 'PARTIALLY_DELIVERED' &&
    status !== 'CANCELLED' &&
    status !== 'PENDING';

  const completedDeliveries = assignedOrders.filter((o) => isDeliveryCompleted(o.status));
  const pendingDeliveries = assignedOrders.filter((o) => isDeliveryPending(o.status));
  const approvedPendingOrders = assignedOrders.filter(
    (o) => o.status === 'APPROVED' || o.status === 'PENDING'
  );
  const outForDeliveryOrders = assignedOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY');

  const pendingSettlement = settlements.find(
    (s) => s.staffId === staff.id && s.status === 'PENDING_VERIFICATION'
  );

  const isAllCompleted = assignedOrders.length > 0 && pendingDeliveries.length === 0;

  const handleStartDeliveryTrip = async () => {
    if (isDispatchingAll || !staff.id) return;
    setIsDispatchingAll(true);
    try {
      await dispatchAllStaffOrders(staff.id);
    } catch (err) {
      console.warn('Error starting delivery trip:', err);
    } finally {
      setIsDispatchingAll(false);
    }
  };

  // Stock Session Metrics
  const hasActiveSession = !!todaySession;
  const isStockReturned = todaySession?.status === 'RETURNED' || todaySession?.status === 'DISCREPANCY';
  const hasActiveUnsettledSession = hasActiveSession && !isStockReturned;
  const isOutForDelivery =
    hasActiveUnsettledSession &&
    (outForDeliveryOrders.length > 0 ||
      (todaySession?.totalOutForDeliveryUnits || 0) > 0 ||
      (completedDeliveries.length > 0 && approvedPendingOrders.length === 0));

  const totalLoaded = hasActiveUnsettledSession
    ? (todaySession?.items || []).reduce((sum, it) => sum + (it.loadedQty || 0), 0)
    : 0;
  const totalDelivered = hasActiveUnsettledSession
    ? (todaySession?.items || []).reduce((sum, it) => sum + (it.deliveredQty || 0), 0)
    : 0;
  const totalOutForDelivery = hasActiveUnsettledSession
    ? outForDeliveryOrders.reduce(
        (sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.orderedQty || 0), 0),
        0
      )
    : 0;
  const totalInVehicle = hasActiveUnsettledSession
    ? (todaySession?.items || []).reduce(
        (sum, it) => sum + Math.max(0, it.currentStock ?? (it.loadedQty - (it.deliveredQty || 0))),
        0
      )
    : 0;

  // ── Load Plan Calculation (Pre-calculated morning requirements) ──
  const { loadPlanItems, totalPlanUnits, totalPlanOrders } = useMemo(() => {
    const unfulfilledOrders = orders.filter(
      (o) =>
        o.assignedStaffId === staff.id &&
        o.status !== 'CANCELLED' &&
        o.status !== 'DELIVERED' &&
        o.status !== 'PARTIALLY_DELIVERED'
    );

    const map: Record<string, { productId: string; productName: string; unit: string; totalQty: number; orderCount: number }> = {};
    unfulfilledOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item.productId) return;
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            unit: item.unit || 'units',
            totalQty: 0,
            orderCount: 0,
          };
        }
        map[item.productId].totalQty += item.orderedQty || 0;
        map[item.productId].orderCount += 1;
      });
    });

    const items = Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
    const sumUnits = items.reduce((sum, item) => sum + item.totalQty, 0);

    return {
      loadPlanItems: items,
      totalPlanUnits: sumUnits,
      totalPlanOrders: unfulfilledOrders.length,
    };
  }, [orders, staff.id]);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Delivery Operations"
        subtitle={`Staff: ${staff.name}`}
        activeRole={activeRole}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Refined Unsettled Cash In Hand Card */}
        <View style={styles.cashCard}>
          <View style={styles.cashTopRow}>
            <View style={styles.cashLeftBlock}>
              <View style={styles.cashLabelRow}>
                <View style={styles.walletIconCircle}>
                  <Ionicons name="wallet-outline" size={14} color="#94A3B8" />
                </View>
                <Text style={styles.cashLabel}>UNSETTLED CASH IN HAND</Text>
              </View>
              <Text style={styles.cashVal}>
                ₹{staff.cashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.settleCashButton}
              onPress={() => navigation.navigate('CashSettlement')}
              activeOpacity={0.8}
            >
              <Text style={styles.settleCashButtonText}>Settle Cash</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textInverse} />
            </TouchableOpacity>
          </View>

          {pendingSettlement && (
            <View style={styles.pendingSettlementBadge}>
              <Ionicons name="time" size={14} color="#F59E0B" />
              <Text style={styles.pendingSettlementText} numberOfLines={1}>
                {pendingSettlement.settlementNumber} awaiting Admin audit verification
              </Text>
            </View>
          )}
        </View>

        {/* 2. Unified Vehicle Stock & Loading Hub */}
        <View style={styles.stockCard}>
          {!hasActiveUnsettledSession ? (
            /* ── PRE-LOAD STATE: Focus on Morning Packing & Loading ── */
            <>
              {/* Header Row */}
              <View style={styles.stockHeaderRow}>
                <View style={styles.stockTitleWrap}>
                  <View style={[styles.stockIconCircle, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Ionicons name="cube" size={17} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.stockCardTitle}>Morning Van Loading</Text>
                    <View style={styles.sessionStatusPill}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: totalPlanUnits > 0 ? '#F59E0B' : '#94A3B8' },
                        ]}
                      />
                      <Text style={styles.sessionStatusText}>
                        {totalPlanUnits > 0
                          ? `${totalPlanUnits} Units Required (${totalPlanOrders} Deliveries)`
                          : 'Stock Not Loaded'}
                      </Text>
                    </View>
                  </View>
                </View>

                {totalPlanUnits > 0 && (
                  <TouchableOpacity
                    style={styles.viewInventoryBtn}
                    onPress={() => setIsLoadPlanModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkbox-outline" size={13} color={colors.primary} />
                    <Text style={styles.viewInventoryBtnText}>Checklist</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Requirement Summary & Item Chips */}
              {loadPlanItems.length > 0 ? (
                <View style={styles.morningLoadBox}>
                  <View style={styles.morningLoadTopRow}>
                    <Text style={styles.morningLoadLabel}>PACKING REQUIREMENT</Text>
                    <Text style={styles.morningLoadBadge}>
                      {loadPlanItems.length} Products • {totalPlanUnits} Units
                    </Text>
                  </View>

                  <View style={styles.morningChipsGrid}>
                    {loadPlanItems.slice(0, 4).map((item) => (
                      <View key={item.productId} style={styles.morningItemChip}>
                        <Text style={styles.morningChipName} numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <View style={styles.morningChipQtyBadge}>
                          <Text style={styles.morningChipQty}>
                            {item.totalQty} {item.unit}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {loadPlanItems.length > 4 && (
                    <TouchableOpacity
                      style={styles.morningMoreBtn}
                      onPress={() => setIsLoadPlanModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.morningMoreText}>
                        + {loadPlanItems.length - 4} more products • View Interactive Packing Checklist
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.emptyRequirementBox}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.emptyRequirementText}>
                    No unfulfilled route deliveries found. Extra stock can be loaded for direct spot sales.
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.stockActionRow}>
                <TouchableOpacity
                  style={[styles.stockActionBtn, styles.stockActionBtnPrimary, { flex: 2 }]}
                  onPress={() => setIsLoadModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sunny-outline" size={16} color={colors.textInverse} />
                  <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextPrimary]}>
                    {totalPlanUnits > 0
                      ? `Load Van Stock (${totalPlanUnits} Units)`
                      : 'Load Morning Stock'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.stockActionBtn, styles.stockActionBtnSecondary, { flex: 1 }]}
                  onPress={() => navigation.navigate('DirectDelivery')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash-outline" size={15} color={colors.primary} />
                  <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextSecondary]}>
                    Spot Sale
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ── ACTIVE SESSION: Stock Loaded / Live Van Stock Tracking ── */
            <>
              {/* Header Row */}
              <View style={styles.stockHeaderRow}>
                <View style={styles.stockTitleWrap}>
                  <View
                    style={[
                      styles.stockIconCircle,
                      { backgroundColor: isOutForDelivery ? '#E0F2FE' : '#DCFCE7' },
                    ]}
                  >
                    <Ionicons
                      name={isOutForDelivery ? 'bicycle' : 'checkmark-done'}
                      size={17}
                      color={isOutForDelivery ? '#0284C7' : colors.brandGreen}
                    />
                  </View>
                  <View>
                    <Text style={styles.stockCardTitle}>
                      {isOutForDelivery ? 'Vehicle Stock Tracker' : 'Vehicle Stock Ready'}
                    </Text>
                    <View style={styles.sessionStatusPill}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isOutForDelivery ? '#0284C7' : colors.brandGreen },
                        ]}
                      />
                      <Text style={styles.sessionStatusText}>
                        {isOutForDelivery ? 'Trip in Progress' : `${totalInVehicle} Units in Van`}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.headerRightActions}>
                  {totalPlanUnits > 0 && (
                    <TouchableOpacity
                      style={styles.planReviewBtn}
                      onPress={() => setIsLoadPlanModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="clipboard-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.planReviewBtnText}>Plan</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.viewInventoryBtn}
                    onPress={() => setIsViewStockModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewInventoryBtnText}>Van Stock</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unified Stat Metric Bar */}
              <View style={styles.stockMetricContainer}>
                <View style={styles.stockMetricColumn}>
                  <Text style={styles.stockMetricLabel}>LOADED</Text>
                  <Text style={styles.stockMetricVal}>{totalLoaded}</Text>
                  <Text style={styles.stockMetricSub}>morning units</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.stockMetricColumn}>
                  <Text style={styles.stockMetricLabel}>DELIVERED</Text>
                  <Text style={[styles.stockMetricVal, { color: colors.brandGreen }]}>
                    {totalDelivered}
                  </Text>
                  <Text style={styles.stockMetricSub}>fulfilled</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.stockMetricColumn}>
                  <Text style={styles.stockMetricLabel}>IN VAN</Text>
                  <Text style={[styles.stockMetricVal, { color: colors.primary }]}>
                    {totalInVehicle}
                  </Text>
                  <Text style={styles.stockMetricSub}>on-hand</Text>
                </View>
              </View>

              {/* Action Row */}
              <View style={styles.stockActionRow}>
                {!isOutForDelivery ? (
                  <>
                    {/* Load Extra */}
                    <TouchableOpacity
                      style={[styles.stockActionBtn, styles.stockActionBtnSecondary]}
                      onPress={() => setIsLoadModalOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextSecondary]}>
                        Load Extra
                      </Text>
                    </TouchableOpacity>

                    {/* Spot Sale */}
                    <TouchableOpacity
                      style={[styles.stockActionBtn, styles.stockActionBtnSecondary]}
                      onPress={() => navigation.navigate('DirectDelivery')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash-outline" size={16} color={colors.accent} />
                      <Text style={[styles.stockActionBtnText, { color: colors.accent, fontWeight: '700' }]}>
                        Spot Sale
                      </Text>
                    </TouchableOpacity>

                    {/* Start Trip Button */}
                    <TouchableOpacity
                      style={[styles.stockActionBtn, styles.stockActionBtnPrimary]}
                      onPress={handleStartDeliveryTrip}
                      disabled={isDispatchingAll}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="bicycle" size={16} color={colors.textInverse} />
                      <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextPrimary]}>
                        {isDispatchingAll ? 'Starting...' : 'Start Trip'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Spot Delivery on Route */}
                    <TouchableOpacity
                      style={[styles.stockActionBtn, styles.stockActionBtnPrimary, { backgroundColor: colors.accent }]}
                      onPress={() => navigation.navigate('DirectDelivery')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={16} color={colors.textInverse} />
                      <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextPrimary]}>
                        Spot Delivery
                      </Text>
                    </TouchableOpacity>

                    {/* Return Stock Button */}
                    <TouchableOpacity
                      style={[styles.stockActionBtn, styles.stockActionBtnEvening]}
                      onPress={() => setIsReturnModalOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="moon-outline" size={16} color={colors.textInverse} />
                      <Text style={[styles.stockActionBtnText, { color: colors.textInverse }]}>
                        Return Stock
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>

        {/* 3. Today's Delivery Progress Metric Bar */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionHeaderLabel}>TODAY'S DISPATCH PROGRESS</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <View style={[styles.metricIconWrap, { backgroundColor: colors.brandGreenLight }]}>
                <Ionicons name="checkmark-done-outline" size={18} color={colors.brandGreen} />
              </View>
              <Text style={styles.metricCount}>{completedDeliveries.length}</Text>
              <Text style={styles.metricSubLabel}>Delivered</Text>
            </View>

            <View style={styles.metricTile}>
              <View style={[styles.metricIconWrap, { backgroundColor: colors.statusPendingBg }]}>
                <Ionicons name="time-outline" size={18} color="#D97706" />
              </View>
              <Text style={styles.metricCount}>{pendingDeliveries.length}</Text>
              <Text style={styles.metricSubLabel}>Pending</Text>
            </View>

            <View style={styles.metricTile}>
              <View style={[styles.metricIconWrap, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="map-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.metricCount}>{assignedOrders.length}</Text>
              <Text style={styles.metricSubLabel}>Total Route</Text>
            </View>
          </View>
        </View>

        {/* 4. Primary Delivery Action CTA */}
        <View style={styles.actionBox}>
          <Button
            title={
              isAllCompleted
                ? 'All Deliveries Completed'
                : `Start Deliveries (${pendingDeliveries.length} Pending)`
            }
            onPress={async () => {
              if (!isAllCompleted) {
                if (approvedPendingOrders.length > 0 && staff.id) {
                  dispatchAllStaffOrders(staff.id).catch(console.warn);
                }
                navigation.navigate('TodayDeliveries', { filter: 'PENDING', timestamp: Date.now() });
              }
            }}
            icon={
              <Ionicons
                name={isAllCompleted ? 'checkmark-done-outline' : 'bicycle-outline'}
                size={20}
                color={colors.textInverse}
              />
            }
            size="lg"
            disabled={assignedOrders.length === 0 || isAllCompleted}
            style={{
              ...styles.primaryCtaBtn,
              ...(isAllCompleted ? { backgroundColor: colors.brandGreen, opacity: 0.85 } : {}),
            }}
          />
        </View>
      </ScrollView>

      {/* ── Modals ── */}
      <MorningStockLoadModal
        visible={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        staffId={staff.id}
        staffName={staff.name}
      />

      <EveningStockReturnModal
        visible={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        staffId={staff.id}
        session={todaySession}
      />

      <StaffVehicleStockModal
        visible={isViewStockModalOpen}
        onClose={() => setIsViewStockModalOpen(false)}
        session={todaySession}
        staffName={staff.name}
      />

      <StaffLoadPlanModal
        visible={isLoadPlanModalOpen}
        onClose={() => setIsLoadPlanModalOpen(false)}
        orders={orders}
        staffId={staff.id}
        staffName={staff.name}
        onProceedToLoadStock={() => setIsLoadModalOpen(true)}
      />
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
    paddingBottom: 40,
  },
  cashCard: {
    backgroundColor: colors.navy,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cashTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashLeftBlock: {
    flex: 1,
  },
  cashLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  walletIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashLabel: {
    ...typography.label,
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  cashVal: {
    ...typography.hero,
    color: '#FFFFFF',
    fontSize: 26,
    marginTop: 2,
  },
  settleCashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.borderRadiusMd,
    gap: 4,
  },
  settleCashButtonText: {
    ...typography.captionBold,
    color: colors.textInverse,
  },
  pendingSettlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.md,
    gap: 6,
  },
  pendingSettlementText: {
    ...typography.caption,
    color: '#FDE68A',
    fontSize: 12,
    flex: 1,
  },
  stockCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  stockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stockTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockCardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sessionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionStatusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  viewInventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  viewInventoryBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  stockMetricContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  stockMetricColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },
  stockMetricLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  stockMetricVal: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 17,
    marginTop: 1,
  },
  stockMetricSub: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  stockActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stockActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    gap: 6,
  },
  stockActionBtnPrimary: {
    backgroundColor: colors.navy,
  },
  stockActionBtnSecondary: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockActionBtnEvening: {
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockActionBtnDisabled: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  stockActionBtnText: {
    ...typography.captionBold,
    fontSize: 12,
  },
  stockActionBtnTextPrimary: {
    color: colors.textInverse,
  },
  stockActionBtnTextSecondary: {
    color: colors.primary,
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  sectionHeaderLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.5,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricTile: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricCount: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  metricSubLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  actionBox: {
    marginBottom: spacing.xl,
  },
  primaryCtaBtn: {
    backgroundColor: colors.navy,
    borderRadius: spacing.borderRadiusXl,
  },
  morningLoadBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  morningLoadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  morningLoadLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  morningLoadBadge: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  morningChipsGrid: {
    gap: 6,
  },
  morningItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  morningChipName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  morningChipQtyBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  morningChipQty: {
    ...typography.captionBold,
    color: colors.navy,
    fontSize: 12,
  },
  morningMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 4,
  },
  morningMoreText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  emptyRequirementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyRequirementText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  planReviewBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
