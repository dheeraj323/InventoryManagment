import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useCashStore } from '../../store/useCashStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { OrderCard } from '../../components/orders/OrderCard';
import { colors, typography, spacing } from '../../theme';

export const StaffDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { currentUser, activeRole, activeStaffId } = useAuthStore();
  const { getOrdersByStaff, orders } = useOrderStore();
  const { settlements, getStaffCashInHand } = useCashStore();

  const staff = {
    id: activeStaffId || currentUser?.staffId || '',
    name: currentUser?.name || 'Delivery Executive',
    cashInHand: getStaffCashInHand(activeStaffId || currentUser?.staffId || '', orders),
  };

  // Get assigned orders (excluding pending approval orders)
  const staffAssigned = getOrdersByStaff(staff.id);
  const assignedOrders = staffAssigned;
  const completedDeliveries = assignedOrders.filter((o) => o.status === 'DELIVERED');
  const pendingDeliveries = assignedOrders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'PENDING'
  );

  const pendingSettlement = settlements.find(
    (s) => s.staffId === staff.id && s.status === 'PENDING_VERIFICATION'
  );

  const isAllCompleted = assignedOrders.length > 0 && pendingDeliveries.length === 0;

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

        {/* 2. Today's Delivery Progress Metric Bar */}
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

        {/* 3. Primary Delivery Action CTA */}
        <View style={styles.actionBox}>
          <Button
            title={
              isAllCompleted
                ? 'All Deliveries Completed'
                : `Start Deliveries (${pendingDeliveries.length} Pending)`
            }
            onPress={() => {
              if (!isAllCompleted) {
                navigation.navigate('TodayDeliveries');
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

        {/* 4. Assigned Delivery Route List */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Assigned Route</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{assignedOrders.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('TodayDeliveries')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {assignedOrders.length === 0 ? (
          <Card variant="flat" style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Deliveries Assigned</Text>
            <Text style={styles.emptyText}>You currently have no delivery route assigned today.</Text>
          </Card>
        ) : (
          assignedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showVendorName
              showDeliverAction
              onPress={() =>
                navigation.navigate('DeliveryDetail', { orderId: order.id })
              }
            />
          ))
        )}
      </ScrollView>
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
    marginBottom: spacing.lg,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  countBadgeText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  seeAllText: {
    ...typography.captionBold,
    color: colors.accent,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});

