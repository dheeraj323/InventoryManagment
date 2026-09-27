import React, { useState, useEffect } from 'react';
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

        {/* 2. Daily Delivery Vehicle Stock Tracker Card */}
        <View style={styles.stockCard}>
          {/* Header row */}
          <View style={styles.stockHeaderRow}>
            <View style={styles.stockTitleWrap}>
              <View
                style={[
                  styles.stockIconCircle,
                  hasActiveUnsettledSession
                    ? { backgroundColor: colors.accentLight }
                    : { backgroundColor: '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name={hasActiveUnsettledSession ? 'bicycle' : 'cube-outline'}
                  size={16}
                  color={hasActiveUnsettledSession ? colors.accent : '#D97706'}
                />
              </View>
              <View>
                <Text style={styles.stockCardTitle}>VEHICLE STOCK TRACKER</Text>
                <Text style={styles.stockCardSubtitle}>
                  {hasActiveUnsettledSession
                    ? isOutForDelivery
                      ? 'Out for delivery • Live transit tracking'
                      : 'Morning stock loaded • Ready for trip'
                    : 'Morning stock loading required'}
                </Text>
              </View>
            </View>

            {hasActiveUnsettledSession && (
              <TouchableOpacity
                style={styles.viewInventoryBtn}
                onPress={() => setIsViewStockModalOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewInventoryBtnText}>View Van</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Metric Tiles - Resets to 0 when settled or not loaded */}
          <View style={styles.stockMetricGrid}>
            <View style={styles.stockMetricTile}>
              <Text style={styles.stockMetricLabel}>LOADED</Text>
              <Text style={styles.stockMetricVal}>{totalLoaded}</Text>
              <Text style={styles.stockMetricSub}>Morning take</Text>
            </View>

            <View style={[styles.stockMetricTile, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Text style={[styles.stockMetricLabel, { color: '#B45309' }]}>ON WAY</Text>
              <Text style={[styles.stockMetricVal, { color: '#D97706' }]}>
                {totalOutForDelivery}
              </Text>
              <Text style={styles.stockMetricSub}>Out delivery</Text>
            </View>

            <View style={styles.stockMetricTile}>
              <Text style={styles.stockMetricLabel}>DELIVERED</Text>
              <Text style={[styles.stockMetricVal, { color: colors.brandGreen }]}>
                {totalDelivered}
              </Text>
              <Text style={styles.stockMetricSub}>Fulfilled</Text>
            </View>

            <View
              style={[
                styles.stockMetricTile,
                { backgroundColor: '#EFF6FF' },
              ]}
            >
              <Text
                style={[
                  styles.stockMetricLabel,
                  { color: colors.accent },
                ]}
              >
                IN VAN
              </Text>
              <Text
                style={[
                  styles.stockMetricVal,
                  { color: colors.accent },
                ]}
              >
                {totalInVehicle}
              </Text>
              <Text style={styles.stockMetricSub}>
                Live bal
              </Text>
            </View>
          </View>

          {/* Action Triggers */}
          <View style={styles.stockActionRow}>
            {/* Morning Load Button - Shows default "Load Morning Stock" when not active or after stock is settled */}
            {!hasActiveUnsettledSession ? (
              <TouchableOpacity
                style={[styles.stockActionBtn, styles.stockActionBtnPrimary]}
                onPress={() => setIsLoadModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="sunny-outline" size={16} color={colors.textInverse} />
                <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextPrimary]}>
                  Load Morning Stock
                </Text>
              </TouchableOpacity>
            ) : !isOutForDelivery ? (
              <>
                {/* 1. Load Extra Button */}
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

                {/* 2. Out for Delivery Button */}
                <TouchableOpacity
                  style={[styles.stockActionBtn, styles.stockActionBtnPrimary]}
                  onPress={handleStartDeliveryTrip}
                  disabled={isDispatchingAll}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bicycle" size={16} color={colors.textInverse} />
                  <Text style={[styles.stockActionBtnText, styles.stockActionBtnTextPrimary]}>
                    {isDispatchingAll ? 'Starting Trip...' : 'Out for Delivery'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* After Out for Delivery chosen: Return Stock ONLY */
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
            )}
          </View>

          {/* Out for Delivery Status Banner */}
          {hasActiveUnsettledSession && isOutForDelivery && (
            <View style={styles.tripActiveBanner}>
              <Ionicons name="bicycle" size={16} color="#0284C7" />
              <Text style={styles.tripActiveBannerText}>
                {outForDeliveryOrders.length > 0
                  ? `All ${outForDeliveryOrders.length} assigned ${outForDeliveryOrders.length === 1 ? 'order is' : 'orders are'} Out for Delivery (On Way)`
                  : 'All deliveries completed. Return remaining stock when finished.'}
              </Text>
            </View>
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
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  stockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stockTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockCardTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  stockCardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  viewInventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: spacing.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  viewInventoryBtnText: {
    ...typography.captionBold,
    color: colors.primary,
    fontSize: 11,
  },
  stockMetricGrid: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  stockMetricTile: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: spacing.borderRadiusMd,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockMetricLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  stockMetricVal: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
    marginVertical: 1,
  },
  stockMetricSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
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
    backgroundColor: colors.accent,
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
  dispatchTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  dispatchTripIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTripTitle: {
    ...typography.bodyBold,
    color: colors.textInverse,
    fontSize: 13,
  },
  dispatchTripSub: {
    ...typography.caption,
    color: '#E0F2FE',
    fontSize: 11,
    marginTop: 2,
  },
  tripActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: spacing.md,
    gap: 8,
  },
  tripActiveBannerText: {
    ...typography.captionBold,
    color: '#0369A1',
    fontSize: 12,
    flex: 1,
  },
});
