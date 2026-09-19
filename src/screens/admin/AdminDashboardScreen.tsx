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
import { colors, typography, spacing } from '../../theme';

type Module = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  route: string;
  badge?: number;
};

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

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const operationsModules: Module[] = [
    {
      icon: 'storefront-outline',
      iconColor: colors.accent,
      iconBg: colors.accentLight,
      title: 'Vendors',
      subtitle: 'Vendor directory & Khata accounts',
      route: 'VendorList',
    },
    {
      icon: 'receipt-outline',
      iconColor: colors.statusApprovedText,
      iconBg: colors.statusApprovedBg,
      title: 'Orders',
      subtitle: 'Approve, assign & track',
      route: 'AdminOrders',
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      icon: 'cube-outline',
      iconColor: colors.statusPendingText,
      iconBg: colors.statusPendingBg,
      title: 'Inventory',
      subtitle: 'Stock levels & prices',
      route: 'Inventory',
      badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
    },
  ];

  const financeModules: Module[] = [
    {
      icon: 'cash-outline',
      iconColor: colors.statusDeliveredText,
      iconBg: colors.statusDeliveredBg,
      title: 'Cash Settlements',
      subtitle: 'Verify staff daily cash handover',
      route: 'StaffSettlements',
      badge: pendingSettlements.length > 0 ? pendingSettlements.length : undefined,
    },
    {
      icon: 'trending-up-outline',
      iconColor: colors.debit,
      iconBg: colors.debitLight,
      title: 'Finance & Ledgers',
      subtitle: 'Receivables & payables overview',
      route: 'AdminFinance',
    },
    {
      icon: 'shield-checkmark-outline',
      iconColor: colors.primary,
      iconBg: colors.surfaceSubtle,
      title: 'Audit Trail',
      subtitle: 'Immutable adjustment history',
      route: 'AuditHistory',
    },
  ];

  const renderModule = (mod: Module) => (
    <TouchableOpacity
      key={mod.route}
      style={styles.moduleRow}
      onPress={() => navigation.navigate(mod.route)}
      activeOpacity={0.7}
    >
      <View style={[styles.moduleIcon, { backgroundColor: mod.iconBg }]}>
        <Ionicons name={mod.icon} size={20} color={mod.iconColor} />
      </View>
      <View style={styles.moduleText}>
        <Text style={styles.moduleTitle}>{mod.title}</Text>
        <Text style={styles.moduleSub}>{mod.subtitle}</Text>
      </View>
      <View style={styles.moduleRight}>
        {mod.badge !== undefined && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{mod.badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Dashboard"
        subtitle={`${currentUser?.name || 'Administrator'} · Admin`}
        activeRole={activeRole}
        onRoleSwitch={() => switchRole('VENDOR')}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Alerts strip ─────────────────────────────────────────────── */}
        {(pendingSettlements.length > 0 || lowStockItems.length > 0) && (
          <View style={styles.alertsContainer}>
            {pendingSettlements.length > 0 && (
              <TouchableOpacity
                style={[styles.alertRow, { borderLeftColor: colors.warning }]}
                onPress={() => navigation.navigate('StaffSettlements')}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={15} color={colors.statusPendingText} />
                <Text style={[styles.alertText, { color: colors.statusPendingText }]}>
                  {pendingSettlements.length} cash settlement{pendingSettlements.length > 1 ? 's' : ''} pending verification
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.statusPendingText} />
              </TouchableOpacity>
            )}
            {lowStockItems.length > 0 && (
              <TouchableOpacity
                style={[styles.alertRow, { borderLeftColor: colors.danger }]}
                onPress={() => navigation.navigate('Inventory')}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={[styles.alertText, { color: colors.danger }]}>
                  {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} below reorder level
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Quick stat grid ───────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statCard, { borderTopColor: colors.debit }]}
            onPress={() => navigation.navigate('AdminFinance')}
            activeOpacity={0.8}
          >
            <Text style={styles.statLabel}>Vendor Receivables</Text>
            <Text style={[styles.statValue, { color: colors.debit }]}>₹{fmt(totalReceivables)}</Text>
            <Text style={styles.statLink}>View ledgers →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderTopColor: colors.accent }]}
            onPress={() => navigation.navigate('AdminOrders')}
            activeOpacity={0.8}
          >
            <Text style={styles.statLabel}>Pending Orders</Text>
            <Text style={[styles.statValue, { color: colors.accent }]}>{pendingOrdersCount}</Text>
            <Text style={styles.statLink}>Manage →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Operations modules ────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>Operations</Text>
        <View style={styles.moduleGroup}>
          {operationsModules.map((mod, idx) => (
            <View key={mod.route}>
              {renderModule(mod)}
              {idx < operationsModules.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* ── Finance modules ───────────────────────────────────────────── */}
        <Text style={[styles.groupLabel, { marginTop: spacing.sectionGap }]}>Finance & Compliance</Text>
        <View style={styles.moduleGroup}>
          {financeModules.map((mod, idx) => (
            <View key={mod.route}>
              {renderModule(mod)}
              {idx < financeModules.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },

  // Alerts
  alertsContainer: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: spacing.borderRadiusMd,
    borderLeftWidth: 3,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertText: {
    ...typography.captionBold,
    flex: 1,
    fontSize: 12,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h2,
    marginBottom: 4,
  },
  statLink: {
    ...typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },

  // Module groups
  groupLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingLeft: 2,
  },
  moduleGroup: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  moduleText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  moduleTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  moduleSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  moduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: spacing.borderRadiusFull,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 10,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: 40 + spacing.md + spacing.lg, // align with text, past icon
  },
});
