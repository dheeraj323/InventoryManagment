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
import { useLedgerStore } from '../../store/useLedgerStore';
import { useCartStore } from '../../store/useCartStore';
import { useVendorStore } from '../../store/useVendorStore';
import { BUSINESS_RULES } from '../../constants/rules';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { OrderCard } from '../../components/orders/OrderCard';
import { LedgerSummaryCard } from '../../components/ledger/LedgerSummaryCard';
import { colors, typography, spacing } from '../../theme';

export const VendorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { switchRole, activeRole, activeVendorId } = useAuthStore();
  const { getOrdersByVendor } = useOrderStore();
  const { getPartyRunningBalance } = useLedgerStore();
  const { getItemCount } = useCartStore();
  const { getVendorById } = useVendorStore();

  const vendor = getVendorById(activeVendorId) || {
    id: activeVendorId || 'vendor-1',
    name: 'Amit Patel',
    shopName: 'Apex Supermarket',
    phone: '',
    address: '',
    area: '',
    creditLimit: 10000,
    currentBalance: 0,
    payLaterEligible: true,
    preferredPaymentMode: 'PAY_LATER' as const,
  };

  const runningBalance = getPartyRunningBalance(vendor.id);
  const remainingCredit = Math.max(0, vendor.creditLimit - runningBalance);
  const creditUsedPct = Math.min(100, (runningBalance / vendor.creditLimit) * 100);
  const vendorOrders = getOrdersByVendor(vendor.id);
  const recentOrders = vendorOrders.slice(0, 3);
  const cartCount = getItemCount();

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={vendor.shopName}
        subtitle={`Welcome, ${vendor.name}`}
        activeRole={activeRole}
        onRoleSwitch={() => switchRole('STAFF')}
        rightAction={
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart-outline" size={22} color={colors.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Zone 1: Order window notice ─────────────────────────────── */}
        <View style={styles.noticePill}>
          <Ionicons name="time-outline" size={14} color={colors.statusPendingText} />
          <Text style={styles.noticeText}>{BUSINESS_RULES.ORDER_CUTOFF_LABEL}</Text>
        </View>

        {/* ── Zone 2: Ledger Balance (hero section) ────────────────────── */}
        <TouchableOpacity onPress={() => navigation.navigate('VendorLedger')} activeOpacity={0.9}>
          <LedgerSummaryCard
            currentBalance={runningBalance}
            partyName={`${vendor.shopName} · Khata`}
          />
        </TouchableOpacity>

        {/* ── Zone 3: Credit Line ──────────────────────────────────────── */}
        <View style={styles.creditSection}>
          <View style={styles.creditTopRow}>
            <Text style={styles.creditTitle}>Credit Line</Text>
            <Text style={styles.creditValues}>
              ₹{fmt(remainingCredit)} available
              <Text style={styles.creditOf}> / ₹{fmt(vendor.creditLimit)}</Text>
            </Text>
          </View>
          <View style={styles.trackBg}>
            <View style={[styles.trackFill, {
              width: `${creditUsedPct}%` as any,
              backgroundColor: creditUsedPct > 80 ? colors.danger : colors.accent,
            }]} />
          </View>
          {creditUsedPct > 80 && (
            <Text style={styles.creditWarning}>
              ⚠ Credit almost exhausted — pay outstanding dues to reorder
            </Text>
          )}
        </View>

        {/* ── Zone 4: Primary CTA ──────────────────────────────────────── */}
        <View style={styles.ctaContainer}>
          <Button
            title="Browse Catalogue & Place Order"
            onPress={() => navigation.navigate('ProductCatalog')}
            icon={<Ionicons name="storefront-outline" size={18} color={colors.textInverse} />}
            size="lg"
          />
        </View>

        {/* ── Zone 5: Recent Orders ────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VendorOrders')}>
            <Text style={styles.seeAll}>See all ({vendorOrders.length})</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Your orders will appear here once placed</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              showVendorName={false}
              onPress={() =>
                navigation.navigate('VendorOrderDetail', { orderId: order.id })
              }
            />
          ))
        )}

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

  // Notice pill
  noticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadiusFull,
    gap: 5,
    marginBottom: spacing.xl,
  },
  noticeText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    fontSize: 11,
  },

  // Credit section
  creditSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  creditTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  creditTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  creditValues: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  creditOf: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  trackBg: {
    height: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  creditWarning: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },

  // CTA
  ctaContainer: {
    marginTop: spacing.sectionGap,
    marginBottom: spacing.sectionGap,
  },

  // Section header
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
  seeAll: {
    ...typography.captionBold,
    color: colors.accent,
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },

  // Cart button
  cartBtn: {
    padding: 6,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: colors.danger,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    ...typography.captionBold,
    color: colors.textInverse,
    fontSize: 9,
  },
});
