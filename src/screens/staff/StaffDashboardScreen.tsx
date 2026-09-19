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
  const { currentUser, switchRole, activeRole, activeStaffId } = useAuthStore();
  const { getOrdersByStaff, orders } = useOrderStore();
  const { settlements } = useCashStore();

  const staff = {
    id: activeStaffId || 'staff-1',
    name: currentUser?.name || 'Suresh Kumar',
    cashInHand: 4200,
  };

  // Get assigned orders (or all active orders if staffId matches)
  const assignedOrders = getOrdersByStaff(staff.id).length > 0 ? getOrdersByStaff(staff.id) : orders;
  const pendingDeliveries = assignedOrders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );

  const pendingSettlement = settlements.find(
    (s) => s.staffId === staff.id && s.status === 'PENDING_VERIFICATION'
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Delivery Operations"
        subtitle={`Staff: ${staff.name}`}
        activeRole={activeRole}
        onRoleSwitch={() => switchRole('ADMIN')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cash In Hand Summary Banner */}
        <Card style={styles.cashCard} outlined elevation="md">
          <View style={styles.cashRow}>
            <View>
              <Text style={styles.cashLabel}>UNSETTLED CASH IN HAND</Text>
              <Text style={styles.cashVal}>₹{staff.cashInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
            <Button
              title="Settle Cash"
              onPress={() => navigation.navigate('CashSettlement')}
              size="sm"
              variant="outline"
              fullWidth={false}
              style={styles.settleBtn}
            />
          </View>
          {pendingSettlement && (
            <View style={styles.pendingSettlementBadge}>
              <Ionicons name="time-outline" size={14} color={colors.statusPendingText} />
              <Text style={styles.pendingSettlementText}>
                Settlement {pendingSettlement.settlementNumber} awaiting Admin verification.
              </Text>
            </View>
          )}
        </Card>

        {/* Primary Delivery Action */}
        <View style={styles.actionBox}>
          <Button
            title={`Start Today's Deliveries (${pendingDeliveries.length} pending)`}
            onPress={() => navigation.navigate('TodayDeliveries')}
            icon={<Ionicons name="bicycle" size={20} color={colors.textInverse} />}
            size="lg"
          />
        </View>

        {/* Assigned Orders List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Delivery Route</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TodayDeliveries')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {assignedOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No delivery routes assigned today.</Text>
          </Card>
        ) : (
          assignedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showVendorName
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
  },
  cashCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cashVal: {
    ...typography.currencyLarge,
    color: colors.credit,
    marginTop: 2,
  },
  settleBtn: {
    borderColor: colors.textInverse,
  },
  pendingSettlementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: spacing.sm,
    borderRadius: spacing.borderRadiusSm,
    marginTop: spacing.md,
  },
  pendingSettlementText: {
    ...typography.caption,
    color: colors.statusPendingBg,
    fontSize: 11,
    marginLeft: spacing.xs,
  },
  actionBox: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  seeAllText: {
    ...typography.captionBold,
    color: colors.accent,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
