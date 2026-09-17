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
import { useLedgerStore } from '../../store/useLedgerStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useCashStore } from '../../store/useCashStore';
import { useOrderStore } from '../../store/useOrderStore';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { colors, typography, spacing } from '../../theme';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { switchRole, activeRole, currentUser } = useAuthStore();
  const { entries } = useLedgerStore();
  const { getLowStockProducts } = useInventoryStore();
  const { getPendingSettlements } = useCashStore();
  const { orders } = useOrderStore();

  const pendingSettlements = getPendingSettlements();
  const lowStockItems = getLowStockProducts();
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;

  const totalReceivables = entries
    .filter((e) => e.partyType === 'VENDOR' && e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Control Center"
        subtitle={`Welcome, ${currentUser?.name || 'Administrator'}`}
        activeRole={activeRole}
        onRoleSwitch={() => switchRole('VENDOR')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Urgent Action Badges Bar */}
        {pendingSettlements.length > 0 && (
          <TouchableOpacity
            style={styles.alertBannerWarning}
            onPress={() => navigation.navigate('StaffSettlements')}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={18} color={colors.statusPendingText} />
            <Text style={styles.alertBannerText}>
              {pendingSettlements.length} Staff Cash Settlement
              {pendingSettlements.length > 1 ? 's' : ''} awaiting Admin verification.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.statusPendingText} />
          </TouchableOpacity>
        )}

        {lowStockItems.length > 0 && (
          <TouchableOpacity
            style={styles.alertBannerDanger}
            onPress={() => navigation.navigate('Inventory')}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.alertBannerDangerText}>
              {lowStockItems.length} Product
              {lowStockItems.length > 1 ? 's' : ''} below reorder threshold.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}

        {/* Financial Overview Grid (No Overcrowded Cards) */}
        <View style={styles.metricsGrid}>
          <Card style={[styles.metricCard, styles.cardReceivable]} outlined elevation="sm">
            <Text style={styles.metricLabel}>TOTAL VENDOR RECEIVABLES</Text>
            <Text style={styles.metricVal}>${totalReceivables.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdminFinance')}>
              <Text style={styles.metricAction}>View Ledgers →</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.metricCard} outlined elevation="sm">
            <Text style={styles.metricLabel}>PENDING ORDERS</Text>
            <Text style={styles.metricVal}>{pendingOrdersCount}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdminOrders')}>
              <Text style={styles.metricAction}>Manage Orders →</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Key Operational Modules Grid */}
        <Text style={styles.sectionTitle}>Distributor Management Modules</Text>

        <Card
          style={styles.moduleCard}
          onPress={() => navigation.navigate('VendorList')}
          outlined
          elevation="sm"
        >
          <View style={styles.moduleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="storefront-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.moduleTextCol}>
              <Text style={styles.moduleTitle}>Vendor Directory & Credit Lines</Text>
              <Text style={styles.moduleSub}>
                Manage shops, credit limits, Pay Later eligibility, and individual ledgers.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>

        <Card
          style={styles.moduleCard}
          onPress={() => navigation.navigate('AdminOrders')}
          outlined
          elevation="sm"
        >
          <View style={styles.moduleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.statusApprovedBg }]}>
              <Ionicons name="receipt-outline" size={22} color={colors.statusApprovedText} />
            </View>
            <View style={styles.moduleTextCol}>
              <Text style={styles.moduleTitle}>Order Approval & Status Control</Text>
              <Text style={styles.moduleSub}>
                Approve, reject, assign staff delivery routes, and track fulfillment.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>

        <Card
          style={styles.moduleCard}
          onPress={() => navigation.navigate('Inventory')}
          outlined
          elevation="sm"
        >
          <View style={styles.moduleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.statusPendingBg }]}>
              <Ionicons name="cube-outline" size={22} color={colors.statusPendingText} />
            </View>
            <View style={styles.moduleTextCol}>
              <Text style={styles.moduleTitle}>Stock & Product Inventory</Text>
              <Text style={styles.moduleSub}>
                Update stock on hand, track low stock alerts, and product prices.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>

        <Card
          style={styles.moduleCard}
          onPress={() => navigation.navigate('StaffSettlements')}
          outlined
          elevation="sm"
        >
          <View style={styles.moduleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.statusDeliveredBg }]}>
              <Ionicons name="cash-outline" size={22} color={colors.statusDeliveredText} />
            </View>
            <View style={styles.moduleTextCol}>
              <Text style={styles.moduleTitle}>Staff Cash Settlement Verification</Text>
              <Text style={styles.moduleSub}>
                Verify daily cash handed over by delivery executives & variance logs.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>

        <Card
          style={styles.moduleCard}
          onPress={() => navigation.navigate('AuditHistory')}
          outlined
          elevation="sm"
        >
          <View style={styles.moduleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.moduleTextCol}>
              <Text style={styles.moduleTitle}>Immutable Audit Trail</Text>
              <Text style={styles.moduleSub}>
                View complete history of manual ledger adjustments and credit line changes.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>
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
  alertBannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.sm,
  },
  alertBannerText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    marginLeft: spacing.sm,
    flex: 1,
  },
  alertBannerDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.md,
    borderRadius: spacing.borderRadiusMd,
    marginBottom: spacing.md,
  },
  alertBannerDangerText: {
    ...typography.captionBold,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  cardReceivable: {
    borderLeftWidth: 4,
    borderLeftColor: colors.debit,
  },
  metricLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricVal: {
    ...typography.currencyLarge,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  metricAction: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  moduleCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleTextCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  moduleTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  moduleSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
  },
});
